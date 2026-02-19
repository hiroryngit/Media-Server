'use client';

import Link from 'next/link';
import { Upload } from 'lucide-react';
import styles from './UploadButton.module.scss';

export default function UploadButton() {
  return (
    <Link href="/upload" className={styles.uploadButton}>
      <Upload size={20} />
      <span>アップロード</span>
    </Link>
  );
}
