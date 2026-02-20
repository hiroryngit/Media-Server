import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function generateToken(): string {
  return randomBytes(16).toString('hex');
}

function generatePassword(): string {
  return randomBytes(4).toString('hex'); // 8文字のランダムパスワード
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  const { mediaId } = await request.json();

  const media = await prisma.media.findFirst({
    where: { id: mediaId, userId },
    include: { shareLink: true },
  });

  if (!media) {
    return NextResponse.json({ error: 'メディアが見つかりません' }, { status: 404 });
  }

  if (media.isShared) {
    // 共有OFF: ShareLink削除
    if (media.shareLink) {
      await prisma.shareLink.delete({ where: { id: media.shareLink.id } });
    }
    await prisma.media.update({
      where: { id: mediaId },
      data: { isShared: false },
    });
    return NextResponse.json({ isShared: false });
  } else {
    // 共有ON: 既存ShareLinkがあれば再利用、なければ新規作成
    let shareLink = media.shareLink;

    if (!shareLink) {
      const token = generateToken();
      const password = generatePassword();
      shareLink = await prisma.shareLink.create({
        data: { mediaId, token, password },
      });
    }

    await prisma.media.update({
      where: { id: mediaId },
      data: { isShared: true },
    });
    return NextResponse.json({ isShared: true, token: shareLink.token, password: shareLink.password });
  }
}
