import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

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

  const { name, type, size } = await request.json();

  if (!name || !type || !size) {
    return NextResponse.json({ error: 'ファイル情報が不足しています' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: '対応していないファイル形式です（画像: jpg/png/gif/webp、動画: mp4/webm/mov）' },
      { status: 400 }
    );
  }

  const uploadId = crypto.randomUUID();
  const chunkDir = path.join(process.cwd(), 'upload', userId, '_chunks', uploadId);
  await mkdir(chunkDir, { recursive: true });

  // メタデータを保存
  const meta = { name, type, size, userId };
  await writeFile(path.join(chunkDir, 'meta.json'), JSON.stringify(meta));

  // uploadId → userId のルックアップを保存（クッキー不要で認証するため）
  const metaDir = path.join(process.cwd(), 'upload', '_meta');
  await mkdir(metaDir, { recursive: true });
  await writeFile(path.join(metaDir, uploadId), userId);

  return NextResponse.json({ uploadId });
}
