import { createWriteStream } from 'fs';
import { readFile, stat } from 'fs/promises';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

/**
 * uploadId から userId を解決する
 * init 時に保存した upload/_meta/{uploadId} ファイルを参照
 */
async function resolveUserId(uploadId: string): Promise<string | null> {
  try {
    const metaPath = path.join(process.cwd(), 'upload', '_meta', uploadId);
    return (await readFile(metaPath, 'utf-8')).trim();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('id');
  const index = searchParams.get('index');

  if (!uploadId || index === null) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
  }

  // uploadId から userId を解決（クッキー不要）
  const userId = await resolveUserId(uploadId);
  if (!userId) {
    return NextResponse.json({ error: '無効なアップロードIDです' }, { status: 400 });
  }

  // チャンクディレクトリの存在確認
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
