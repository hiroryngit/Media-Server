import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { destroyEncryptedDir } from '@/app/lib/gocryptfs';
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

  // CAPTCHA検証
  const captchaCode = cookieStore.get('captcha_code')?.value;
  const body = await request.json();
  const { password, captcha } = body;

  if (!captcha || !captchaCode) {
    return NextResponse.json({ error: 'CAPTCHAを入力してください' }, { status: 400 });
  }

  if (captcha !== captchaCode) {
    // 使用済みのCAPTCHAを無効化（リトライ時は再取得が必要）
    cookieStore.delete('captcha_code');
    return NextResponse.json({ error: 'CAPTCHAが正しくありません' }, { status: 400 });
  }

  // CAPTCHA使用済み → 削除
  cookieStore.delete('captcha_code');

  // パスワード確認
  if (!password) {
    return NextResponse.json({ error: 'パスワードを入力してください' }, { status: 400 });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return NextResponse.json({ error: 'パスワードが正しくありません' }, { status: 403 });
  }

  try {
    // 1. ユーザーの全Mediaレコードを削除
    await prisma.media.deleteMany({ where: { userId } });

    // 2. gocryptfsの暗号化ディレクトリを破棄（アンマウント→ディレクトリ削除）
    destroyEncryptedDir(userId);

    // 3. ユーザーレコードを削除
    await prisma.user.delete({ where: { id: userId } });

    // 4. セッションCookieを削除
    cookieStore.delete('session_id');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('アカウント削除エラー:', error);
    return NextResponse.json(
      { error: 'アカウントの削除に失敗しました。管理者に連絡してください。' },
      { status: 500 }
    );
  }
}