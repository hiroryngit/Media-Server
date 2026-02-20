import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { redirect } from 'next/navigation';
import HeaderServer from '@/app/components/Header/HeaderServer';
import SharedClient from './SharedClient';

export default async function SharedPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  if (!userId) redirect('/');

  const mediaList = await prisma.media.findMany({
    where: { userId, isShared: true },
    orderBy: { createdAt: 'desc' },
    include: { shareLink: true },
  });

  return (
    <>
      <HeaderServer />
      <SharedClient mediaList={mediaList} />
    </>
  );
}
