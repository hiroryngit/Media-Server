// src/app/user_signup/actions.ts
'use server'; // これを書くとサーバー側で実行される

import { prisma } from '../lib/db';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';

export async function registerUser(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  // 1. パスワードを暗号化（ハッシュ化）する
  // 10は「ソルト」と呼ばれる、解析を難しくするための複雑さの度合いです
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // 2. データベースに保存
    await prisma.user.create({
      data: {
        username: username,
        password: hashedPassword,
      },
    });
  } catch (error) {
    // ユーザー名が既に使われている場合などはここに来る
    return { error: 'このユーザー名は既に使用されています。' };
  }

  // 3. 成功したらログインページへ飛ばす
  redirect('/dashboard');
}