/**
 * upload/{userId}/ のアンマウント判定
 *
 * shouldUnmount := !isLoggedIn && !isProcessing && !isUploading
 *
 * isLoggedIn:   content/{userId}/ がマウント中（= ユーザーがログイン中）
 * isProcessing: DBに status='processing' のメディアが存在する
 * isUploading:  upload/{userId}/_chunks/ にディレクトリが存在する
 */

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import path from 'path';
import { prisma } from '@/app/lib/db';

const MOUNT_DIR = path.join(process.cwd(), 'public', 'content');
const UPLOAD_DIR = path.join(process.cwd(), 'upload');

function isContentMounted(userId: string): boolean {
  try {
    execSync(`mountpoint -q "${path.join(MOUNT_DIR, userId)}" 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

function hasActiveChunks(userId: string): boolean {
  try {
    const chunksDir = path.join(UPLOAD_DIR, userId, '_chunks');
    const entries = readdirSync(chunksDir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function isProcessing(userId: string): Promise<boolean> {
  const count = await prisma.media.count({
    where: { userId, status: 'processing' },
  });
  return count > 0;
}

/**
 * uploadディレクトリをアンマウントすべきか判定する
 * ffmpeg処理完了時に呼ぶ
 */
export async function shouldUnmountUpload(userId: string): Promise<boolean> {
  const loggedIn = isContentMounted(userId);
  const processing = await isProcessing(userId);
  const uploading = hasActiveChunks(userId);
  return !loggedIn && !processing && !uploading;
}
