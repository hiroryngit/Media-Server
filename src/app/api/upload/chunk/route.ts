import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
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

  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('id');
  const index = searchParams.get('index');

  if (!uploadId || index === null) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
  }

  // チャンクディレクトリの存在確認（uploadIdの検証）
  const chunkDir = path.join(process.cwd(), 'upload', userId, '_chunks', uploadId);
  try {
    await stat(chunkDir);
  } catch {
    return NextResponse.json({ error: '無効なアップロードIDです' }, { status: 400 });
  }

  if (!request.body) {
    return NextResponse.json({ error: 'リクエストボディがありません' }, { status: 400 });
  }

  // ストリーミングでチャンクをディスクに書き込み
  const chunkPath = path.join(chunkDir, index);
  const bodyStream = Readable.fromWeb(request.body as import('stream/web').ReadableStream);
  await pipeline(bodyStream, createWriteStream(chunkPath));

  return NextResponse.json({ ok: true });
}
