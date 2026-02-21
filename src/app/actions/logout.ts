'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unmountEncryptedDir } from '@/app/lib/gocryptfs';
import { prisma } from '@/app/lib/db';
import { readdir } from 'fs/promises';
import path from 'path';

export async function logout() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  if (userId) {
    // 1. ffmpeg処理中か確認
    const processingCount = await prisma.media.count({
      where: { userId, status: 'processing' },
    });

    // 2. チャンクアップロード中か確認（_chunks/ にディレクトリがあるか）
    let hasActiveUpload = false;
    try {
      const chunksDir = path.join(process.cwd(), 'upload', userId, '_chunks');
      const entries = await readdir(chunksDir);
      hasActiveUpload = entries.length > 0;
    } catch {
      // _chunks が存在しない → アップロード中ではない
    }

    const shouldUnmountUpload = processingCount === 0 && !hasActiveUpload;

    try {
      unmountEncryptedDir(userId, shouldUnmountUpload);
    } catch {
      console.error(`ログアウト時のアンマウントに失敗: userId=${userId}`);
    }
  }

  cookieStore.delete('session_id');
  redirect('/');
}
