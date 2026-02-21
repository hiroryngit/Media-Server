import { prisma } from '@/app/lib/db';
import { mkdir, readFile, readdir, rm, appendFile, unlink } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { processImage, processVideo } from '@/app/lib/media-processing';
import { unmountUploadDir } from '@/app/lib/gocryptfs';
import { shouldUnmountUpload } from '@/app/lib/upload-mount-state';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * uploadId から userId を解決する
 */
async function resolveUserId(uploadId: string): Promise<string | null> {
  try {
    const metaPath = path.join(process.cwd(), 'upload', '_meta', uploadId);
    return (await readFile(metaPath, 'utf-8')).trim();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { uploadId } = await request.json();

  if (!uploadId) {
    return NextResponse.json({ error: 'アップロードIDが必要です' }, { status: 400 });
  }

  // uploadId から userId を解決（クッキー不要）
  const userId = await resolveUserId(uploadId);
  if (!userId) {
    return NextResponse.json({ error: '無効なアップロードIDです' }, { status: 400 });
  }

  const chunkDir = path.join(process.cwd(), 'upload', userId, '_chunks', uploadId);

  // メタデータ読み込み
  let meta: { name: string; type: string; size: number; userId: string };
  try {
    meta = JSON.parse(await readFile(path.join(chunkDir, 'meta.json'), 'utf-8'));
  } catch {
    return NextResponse.json({ error: '無効なアップロードIDです' }, { status: 400 });
  }

  // チャンクファイル一覧（meta.json以外）を番号順にソート
  const allFiles = await readdir(chunkDir);
  const chunkFiles = allFiles.filter((f) => f !== 'meta.json').sort((a, b) => Number(a) - Number(b));

  if (chunkFiles.length === 0) {
    return NextResponse.json({ error: 'チャンクが見つかりません' }, { status: 400 });
  }

  // 結合先ファイルパスを準備（upload/マウントポイント経由で書き込み）
  const ext = path.extname(meta.name);
  const baseName = `${path.basename(meta.name, ext)}-${Date.now()}`;
  const tempName = `${baseName}${ext}`;
  const outputDir = path.join(process.cwd(), 'upload', userId);
  const tempPath = path.join(outputDir, tempName);

  // チャンクを順番にファイルに追記して結合
  for (const chunkFile of chunkFiles) {
    const chunkPath = path.join(chunkDir, chunkFile);
    const chunkData = await readFile(chunkPath);
    await appendFile(tempPath, chunkData);
  }

  // チャンクディレクトリ削除
  await rm(chunkDir, { recursive: true, force: true });

  // ルックアップファイル削除
  await unlink(path.join(process.cwd(), 'upload', '_meta', uploadId)).catch(() => {});

  // DB登録（配信用パスは /content/ を使用）
  const type = ALLOWED_IMAGE_TYPES.includes(meta.type) ? 'image' : 'video';
  const tempDbPath = `/content/${userId}/${tempName}`;
  const media = await prisma.media.create({
    data: {
      type,
      name: meta.name,
      fileSize: meta.size,
      path: tempDbPath,
      status: 'processing',
      userId,
    },
  });

  // レスポンス送信後にffmpeg処理を実行
  after(async () => {
    try {
      if (type === 'image') {
        await processImage(media.id, tempPath, outputDir, baseName, userId);
      } else {
        await processVideo(media.id, tempPath, outputDir, baseName, userId);
      }
    } catch (error) {
      console.error('メディア処理エラー:', error);
    } finally {
      // DB・マウント状態を確認し、アンマウントすべきならする
      if (await shouldUnmountUpload(userId)) {
        try {
          unmountUploadDir(userId);
        } catch {
          console.error('uploadディレクトリのアンマウントに失敗');
        }
      }
    }
  });

  return NextResponse.json({ success: true, mediaId: media.id });
}
