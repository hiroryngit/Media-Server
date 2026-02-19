import Link from 'next/link';
import styles from './dashboard.module.scss';

export default function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  return (
    <nav className={styles.pagination}>
      {currentPage > 1 ? (
        <Link href={`/dashboard?page=${currentPage - 1}`} className={styles.pageLink}>
          &lt; 前へ
        </Link>
      ) : (
        <span className={styles.pageLinkDisabled}>&lt; 前へ</span>
      )}

      <span className={styles.pageInfo}>
        {currentPage} / {totalPages}
      </span>

      {currentPage < totalPages ? (
        <Link href={`/dashboard?page=${currentPage + 1}`} className={styles.pageLink}>
          次へ &gt;
        </Link>
      ) : (
        <span className={styles.pageLinkDisabled}>次へ &gt;</span>
      )}
    </nav>
  );
}
