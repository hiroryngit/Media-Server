import { prisma } from '@/app/lib/db';
import { convertToHls, generateThumbnail, optimizeImage } from '@/app/lib/ffmpeg';
import { mkdir, unlink } from 'fs/promises';
import path from 'path';

/**
 * バックグラウンドで画像を最適化する
 * outputDir: upload/{userId}/ マウントポイント経由で書き込み（content側からも見える）
 */
export async function processImage(mediaId: string, tempPath: string, outputDir: string, baseName: string, userId: string) {
  try {
    const optimizedName = `${baseName}.webp`;
    const optimizedPath = path.join(outputDir, optimizedName);

    await optimizeImage(tempPath, optimizedPath);

    // 一時ファイル削除
    await unlink(tempPath).catch(() => {});

    const dbPath = `/content/${userId}/${optimizedName}`;
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
 * outputDir: upload/{userId}/ マウントポイント経由で書き込み（content側からも見える）
 */
export async function processVideo(mediaId: string, tempPath: string, outputDir: string, baseName: string, userId: string) {
  try {
    // HLS用ディレクトリ
    const hlsDir = path.join(outputDir, baseName);
    await mkdir(hlsDir, { recursive: true });

    // HLS変換
    await convertToHls(tempPath, hlsDir);

    // サムネイル生成
    const thumbnailName = `${baseName}-thumb.jpg`;
    const thumbnailPath = path.join(outputDir, thumbnailName);
    await generateThumbnail(tempPath, thumbnailPath).catch(() => {});

    // 一時ファイル削除
    await unlink(tempPath).catch(() => {});

    const dbPath = `/content/${userId}/${baseName}/index.m3u8`;
    const dbThumbnail = `/content/${userId}/${thumbnailName}`;

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
