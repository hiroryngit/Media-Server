import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/db';
import { mountUploadDir } from '@/app/lib/gocryptfs';
import HeaderServer from '@/app/components/Header/HeaderServer';
import UploadClient from './UploadClient';

export default async function UploadPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  if (!userId) {
    redirect('/');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect('/');
  }

  // アップロードページアクセス時にuploadディレクトリをマウント
  mountUploadDir(userId, user.password);

  // 処理中のメディアを取得
  const processingMedia = await prisma.media.findMany({
    where: { userId, status: 'processing' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, type: true, status: true, thumbnailPath: true },
  });

  return (
    <>
      <HeaderServer />
      <UploadClient initialProcessing={processingMedia} />
    </>
  );
}
