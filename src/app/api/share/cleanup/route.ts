import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { unmountShareDir } from '@/app/lib/gocryptfs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('viewer_session')?.value;

  if (!sessionId) {
    return NextResponse.json({ ok: true });
  }

  const session = await prisma.viewerSession.findUnique({
    where: { id: sessionId },
  });

  if (session) {
    // セッション削除
    await prisma.viewerSession.delete({ where: { id: sessionId } });

    // このオーナーの他の閲覧者セッションがなければアンマウント
    const remaining = await prisma.viewerSession.count({
      where: { ownerId: session.ownerId },
    });

    if (remaining === 0) {
      try {
        unmountShareDir(session.ownerId);
      } catch (error) {
        console.error('共有アンマウントエラー:', error);
      }
    }
  }

  cookieStore.delete('viewer_session');
  return NextResponse.json({ ok: true });
}
