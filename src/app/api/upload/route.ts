import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { convertToHls, generateThumbnail, optimizeImage } from '@/app/lib/ffmpeg';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

/**
 * バックグラウンドで画像を最適化する
 */
async function processImage(mediaId: string, tempPath: string, uploadDir: string, baseName: string) {
  try {
    const optimizedName = `${baseName}.webp`;
    const optimizedPath = path.join(uploadDir, optimizedName);
    const userId = path.basename(uploadDir);

    await optimizeImage(tempPath, optimizedPath);

    // 一時ファイル削除
    await unlink(tempPath).catch(() => {});

    const dbPath = `/uploads/${userId}/${optimizedName}`;
    await prisma.media.update({
      where: { id: mediaId },
      data: { path: dbPath, status: 'ready' },
    });
  } catch (error) {
    console.error('画像最適化エラー:', error);
    // 失敗時: 元ファイルをそのまま使用してready扱い
    await prisma.media.update({
      where: { id: mediaId },
      data: { status: 'ready' },
    });
  }
}

/**
 * バックグラウンドで動画をHLS変換+サムネイル生成する
 */
async function processVideo(mediaId: string, tempPath: string, uploadDir: string, baseName: string) {
  try {
    const userId = path.basename(uploadDir);

    // HLS用ディレクトリ: /uploads/{userId}/{baseName}/
    const hlsDir = path.join(uploadDir, baseName);
    await mkdir(hlsDir, { recursive: true });

    // HLS変換
    await convertToHls(tempPath, hlsDir);

    // サムネイル生成
    const thumbnailName = `${baseName}-thumb.jpg`;
    const thumbnailPath = path.join(uploadDir, thumbnailName);
    await generateThumbnail(tempPath, thumbnailPath).catch(() => {});

    // 一時ファイル削除
    await unlink(tempPath).catch(() => {});

    const dbPath = `/uploads/${userId}/${baseName}/index.m3u8`;
    const dbThumbnail = `/uploads/${userId}/${thumbnailName}`;

    await prisma.media.update({
      where: { id: mediaId },
      data: {
        path: dbPath,
        thumbnailPath: dbThumbnail,
        status: 'ready',
      },
    });
  } catch (error) {
    console.error('動画変換エラー:', error);
    await prisma.media.update({
      where: { id: mediaId },
      data: { status: 'error' },
    });
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: '対応していないファイル形式です（画像: jpg/png/gif/webp、動画: mp4/webm/mov）' },
      { status: 400 }
    );
  }

  const type = ALLOWED_IMAGE_TYPES.includes(file.type) ? 'image' : 'video';

  const ext = path.extname(file.name);
  const baseName = `${path.basename(file.name, ext)}-${Date.now()}`;
  const tempName = `${baseName}${ext}`;

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', userId);
  await mkdir(uploadDir, { recursive: true });

  // 一時ファイルとして元ファイルを保存
  const tempPath = path.join(uploadDir, tempName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tempPath, buffer);

  // DBにprocessing状態で即登録（一時パスを仮設定）
  const tempDbPath = `/uploads/${userId}/${tempName}`;
  const media = await prisma.media.create({
    data: {
      type,
      name: file.name,
      fileSize: file.size,
      path: tempDbPath,
      status: 'processing',
      userId,
    },
  });

  // バックグラウンドでffmpeg処理（レスポンスとは切り離す）
  if (type === 'image') {
    processImage(media.id, tempPath, uploadDir, baseName).catch(console.error);
  } else {
    processVideo(media.id, tempPath, uploadDir, baseName).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
