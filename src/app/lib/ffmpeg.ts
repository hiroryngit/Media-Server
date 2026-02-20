import { exec } from 'child_process';
import { mkdir } from 'fs/promises';
import path from 'path';

function run(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 600_000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/**
 * 動画をHLS形式に変換する
 * 出力: outputDir/index.m3u8 + segment000.ts, segment001.ts, ...
 */
export async function convertToHls(inputPath: string, outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const m3u8Path = path.join(outputDir, 'index.m3u8');
  const segmentPattern = path.join(outputDir, 'segment%03d.ts');

  await run(
    `ffmpeg -i "${inputPath}" ` +
    `-c:v libx264 -preset fast -crf 23 ` +
    `-c:a aac -b:a 128k ` +
    `-f hls -hls_time 6 -hls_list_size 0 ` +
    `-hls_segment_filename "${segmentPattern}" ` +
    `"${m3u8Path}"`
  );
}

/**
 * 動画の先頭フレームからサムネイル画像を生成する
 */
export async function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await run(
    `ffmpeg -i "${inputPath}" -ss 00:00:01 -vframes 1 -q:v 2 "${outputPath}"`
  );
}

/**
 * 画像をwebpに変換・最適化する（最大幅1920px）
 */
export async function optimizeImage(inputPath: string, outputPath: string): Promise<void> {
  await run(
    `ffmpeg -i "${inputPath}" -vf "scale='min(1920,iw)':-1" -quality 80 "${outputPath}"`
  );
}
