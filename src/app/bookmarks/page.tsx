import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { redirect } from 'next/navigation';
import HeaderServer from '@/app/components/Header/HeaderServer';
import BookmarksClient from './BookmarksClient';

export default async function BookmarksPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  if (!userId) redirect('/');

  const mediaList = await prisma.media.findMany({
    where: { userId, isBookmarked: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <HeaderServer />
      <BookmarksClient mediaList={mediaList} />
    </>
  );
}
