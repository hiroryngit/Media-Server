import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import Header from '@/app/components/Header/Header';
import UploadButton from '@/app/components/UploadButton/UploadButton';
import Pagination from './Pagination';
import styles from './dashboard.module.scss';

const ITEMS_PER_PAGE = 10;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('session_id')?.value;

  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page) || 1);

  const [mediaList, totalCount] = userId
    ? await Promise.all([
        prisma.media.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: (currentPage - 1) * ITEMS_PER_PAGE,
          take: ITEMS_PER_PAGE,
        }),
        prisma.media.count({ where: { userId } }),
      ])
    : [[], 0];

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <>
      <Header />
      <main className={styles.main}>
        {mediaList.length === 0 && currentPage === 1 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyMessage}>コンテンツがありません</p>
            <UploadButton />
          </div>
        ) : (
          <>
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
            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} />
            )}
          </>
        )}
      </main>
    </>
  );
}
