// src/app/user_signup/actions.ts
'use server'; // これを書くとサーバー側で実行される

import { prisma } from '../lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { initEncryptedDir } from '../lib/gocryptfs';

export async function registerUser(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  // 1. パスワードを暗号化（ハッシュ化）する
  // 10は「ソルト」と呼ばれる、解析を難しくするための複雑さの度合いです
  const hashedPassword = await bcrypt.hash(password, 10);

  let user;
  try {
    // 2. データベースに保存
    user = await prisma.user.create({
      data: {
        username: username,
        password: hashedPassword,
      },
    });
  } catch (error) {
    // ユーザー名が既に使われている場合などはここに来る
    return { error: 'このユーザー名は既に使用されています。' };
  }

  // 3. gocryptfsの暗号化ディレクトリを初期化
  try {
    initEncryptedDir(user.id, hashedPassword);
  } catch (error) {
    // 初期化失敗時はユーザーレコードを削除
    await prisma.user.delete({ where: { id: user.id } });
    return { error: '暗号化ディレクトリの初期化に失敗しました。' };
  }

  // 4. セッションCookieを設定（ログイン状態にする）
  const cookieStore = await cookies();
  cookieStore.set('session_id', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  // 5. 成功したらダッシュボードへ飛ばす
  redirect('/dashboard');
}