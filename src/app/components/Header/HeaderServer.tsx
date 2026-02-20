import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import Header from './Header';

export default async function HeaderServer() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  let username = '';
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    username = user?.username ?? '';
  }

  return <Header username={username} />;
}
