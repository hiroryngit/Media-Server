import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import Header from '@/app/components/Header/Header';
import DeleteClient from './DeleteClient';

export default async function DeletePage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  const mediaList = userId
    ? await prisma.media.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <>
      <Header />
      <DeleteClient mediaList={mediaList} />
    </>
  );
}
