import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { mountShareDir } from '@/app/lib/gocryptfs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { token, password } = await request.json();

  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { media: { include: { user: true } } },
  });

  if (!shareLink) {
    return NextResponse.json({ error: '共有リンクが見つかりません' }, { status: 404 });
  }

  // パスワード検証
  if (shareLink.password !== null) {
    if (!password || password !== shareLink.password) {
      return NextResponse.json({ error: 'パスワードが正しくありません' }, { status: 401 });
    }
  }

  const ownerId = shareLink.media.userId;
  const ownerPassword = shareLink.media.user.password; // bcrypt hash

  // 閲覧者用マウント（/share/{ownerId}/）
  try {
    mountShareDir(ownerId, ownerPassword);
  } catch (error) {
    console.error('共有マウントエラー:', error);
    return NextResponse.json({ error: 'コンテンツにアクセスできません' }, { status: 500 });
  }

  // ViewerSession作成
  const session = await prisma.viewerSession.create({
    data: { ownerId },
  });

  // Cookie設定
  const cookieStore = await cookies();
  cookieStore.set('viewer_session', session.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24時間
  });

  // メディアパスを/content/→/share/に変換
  const media = shareLink.media;
  const sharePath = media.path.replace('/content/', '/share/');
  const shareThumbnail = media.thumbnailPath?.replace('/content/', '/share/') || null;

  return NextResponse.json({
    media: {
      id: media.id,
      type: media.type,
      name: media.name,
      path: sharePath,
      thumbnailPath: shareThumbnail,
      status: media.status,
    },
  });
}
