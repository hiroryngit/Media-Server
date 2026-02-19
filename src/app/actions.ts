// src/app/actions.ts
'use server';
import { prisma } from './lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers'; // クッキー操作用
import { redirect } from 'next/navigation';
import { mountEncryptedDir } from './lib/gocryptfs';

export async function loginUser(prevState: any,formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  // 1. ユーザーをDBから探す
  const user = await prisma.user.findUnique({
    where: { username },
  });

  // 2. ユーザーがいない、またはパスワードが合わない場合はエラー
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: 'ユーザー名またはパスワードが違います' };
  }

  // 3. gocryptfsの暗号化ディレクトリをマウント
  try {
    mountEncryptedDir(user.id, user.password);
  } catch (error) {
    console.error('ログイン時のマウントに失敗:', error);
    return { error: '暗号化ディレクトリのマウントに失敗しました' };
  }

  // 4. ログインの証明書（セッション）をクッキーに保存
  const cookieStore = await cookies();
  cookieStore.set('session_id', user.id, {
    httpOnly: true,    // JavaScriptから盗まれないようにする（重要！）
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1週間有効
    path: '/',
  });

  // 5. ログイン後のメイン画面（例：/dashboard）へ飛ばす
  redirect('/dashboard');
}