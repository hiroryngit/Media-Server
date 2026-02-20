import { prisma } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 });
  }

  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { media: { select: { name: true, type: true } } },
  });

  if (!shareLink) {
    return NextResponse.json({ error: '共有リンクが見つかりません' }, { status: 404 });
  }

  return NextResponse.json({
    needsPassword: shareLink.password !== null,
    mediaName: shareLink.media.name,
    mediaType: shareLink.media.type,
  });
}
