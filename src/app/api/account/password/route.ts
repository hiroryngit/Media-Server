import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { changeEncryptedDirPassword } from '@/app/lib/gocryptfs';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

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

  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '現在のパスワードと新しいパスワードを入力してください' }, { status: 400 });
  }

  // 現在のパスワードを確認
  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return NextResponse.json({ error: '現在のパスワードが正しくありません' }, { status: 403 });
  }

  // 新しいパスワードをハッシュ化
  const newHashedPassword = await bcrypt.hash(newPassword, 10);

  try {
    // 1. gocryptfsのパスワードを変更（旧hash → 新hash）
    changeEncryptedDirPassword(userId, user.password, newHashedPassword);

    // 2. DBのパスワードを更新
    await prisma.user.update({
      where: { id: userId },
      data: { password: newHashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('パスワード変更エラー:', error);
    return NextResponse.json(
      { error: 'パスワードの変更に失敗しました。' },
      { status: 500 }
    );
  }
}
