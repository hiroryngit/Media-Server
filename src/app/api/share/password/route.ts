import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  const { shareLinkId, mode, customPassword } = await request.json();
  // mode: "random" | "custom" | "none"

  const shareLink = await prisma.shareLink.findUnique({
    where: { id: shareLinkId },
    include: { media: true },
  });

  if (!shareLink || shareLink.media.userId !== userId) {
    return NextResponse.json({ error: '共有リンクが見つかりません' }, { status: 404 });
  }

  let newPassword: string | null = null;

  if (mode === 'random') {
    newPassword = randomBytes(4).toString('hex');
  } else if (mode === 'custom') {
    if (!customPassword || customPassword.length < 1) {
      return NextResponse.json({ error: 'パスワードを入力してください' }, { status: 400 });
    }
    newPassword = customPassword;
  }
  // mode === 'none' → newPassword remains null

  await prisma.shareLink.update({
    where: { id: shareLinkId },
    data: { password: newPassword },
  });

  return NextResponse.json({ password: newPassword });
}
