import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { redirect } from 'next/navigation';
import HeaderServer from '@/app/components/Header/HeaderServer';
import ViewerClient from './ViewerClient';

export default async function ViewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  if (!userId) redirect('/');

  const params = await searchParams;
  const mediaId = params.id;

  if (!mediaId) redirect('/dashboard');

  const media = await prisma.media.findFirst({
    where: { id: mediaId, userId },
  });

  if (!media) redirect('/dashboard');

  return (
    <>
      <HeaderServer />
      <ViewerClient media={media} />
    </>
  );
}
