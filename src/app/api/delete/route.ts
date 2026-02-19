import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { unlink } from 'fs/promises';
import path from 'path';
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
  const ids: string[] = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '削除対象が指定されていません' }, { status: 400 });
  }

  const mediaItems = await prisma.media.findMany({
    where: {
      id: { in: ids },
      userId,
    },
  });

  if (mediaItems.length === 0) {
    return NextResponse.json({ error: '削除対象が見つかりません' }, { status: 404 });
  }

  // Delete files from filesystem
  for (const media of mediaItems) {
    const filePath = path.join(process.cwd(), 'public', media.path);
    try {
      await unlink(filePath);
    } catch {
      // File may already be missing, continue
    }
  }

  // Delete DB records
  await prisma.media.deleteMany({
    where: {
      id: { in: mediaItems.map((m) => m.id) },
    },
  });

  return NextResponse.json({ success: true, deleted: mediaItems.length });
}
