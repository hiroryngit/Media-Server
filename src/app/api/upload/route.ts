import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

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

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: '対応していないファイル形式です（画像: jpg/png/gif/webp、動画: mp4/webm/mov）' },
      { status: 400 }
    );
  }

  const type = ALLOWED_IMAGE_TYPES.includes(file.type) ? 'image' : 'video';

  const ext = path.extname(file.name);
  const baseName = path.basename(file.name, ext);
  const uniqueName = `${baseName}-${Date.now()}${ext}`;

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', userId);
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const dbPath = `/uploads/${userId}/${uniqueName}`;
  await prisma.media.create({
    data: {
      type,
      name: file.name,
      fileSize: file.size,
      path: dbPath,
      userId,
    },
  });

  return NextResponse.json({ success: true });
}
