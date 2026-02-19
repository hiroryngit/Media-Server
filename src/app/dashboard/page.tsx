import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import Header from '@/app/components/Header/Header';
import UploadButton from '@/app/components/UploadButton/UploadButton';
import styles from './dashboard.module.scss';

export default async function Dashboard() {
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
      <main className={styles.main}>
        {mediaList.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyMessage}>コンテンツがありません</p>
            <UploadButton />
          </div>
        ) : (
          <div className={styles.mediaGrid}>
            {mediaList.map((media) => (
              <div key={media.id} className={styles.mediaCard}>
                {media.type === 'image' ? (
                  <img src={media.path} alt={media.name} className={styles.mediaThumbnail} />
                ) : (
                  <video src={media.path} className={styles.mediaThumbnail} />
                )}
                <p className={styles.mediaName}>{media.name}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
