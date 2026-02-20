import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  const { mediaId } = await request.json();

  const media = await prisma.media.findFirst({
    where: { id: mediaId, userId },
  });

  if (!media) {
    return NextResponse.json({ error: 'メディアが見つかりません' }, { status: 404 });
  }

  const updated = await prisma.media.update({
    where: { id: mediaId },
    data: { isBookmarked: !media.isBookmarked },
  });

  return NextResponse.json({ isBookmarked: updated.isBookmarked });
}
