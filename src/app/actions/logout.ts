'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unmountEncryptedDir } from '@/app/lib/gocryptfs';

export async function logout() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  // アンマウント → rmdir（この順番は絶対）
  if (userId) {
    try {
      unmountEncryptedDir(userId);
    } catch {
      // アンマウント失敗してもログアウト自体は続行する
      console.error(`ログアウト時のアンマウントに失敗: userId=${userId}`);
    }
  }

  cookieStore.delete('session_id');
  redirect('/');
}
