import { prisma } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 処理中メディアのステータスを返す（認証不要）
 * mediaIdのUUID自体が推測困難なトークンとして機能する
 *
 * GET /api/upload/status?ids=id1,id2,id3
 */
export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids');
  if (!ids) {
    return NextResponse.json({ error: 'ids parameter is required' }, { status: 400 });
  }

  const mediaIds = ids.split(',').filter(Boolean).slice(0, 50); // 最大50件
  if (mediaIds.length === 0) {
    return NextResponse.json({ statuses: {} });
  }

  const mediaList = await prisma.media.findMany({
    where: { id: { in: mediaIds } },
    select: { id: true, status: true, thumbnailPath: true },
  });

  const statuses: Record<string, { status: string; thumbnailPath: string | null }> = {};
  for (const media of mediaList) {
    statuses[media.id] = {
      status: media.status,
      thumbnailPath: media.thumbnailPath,
    };
  }

  return NextResponse.json({ statuses });
}
