'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Share2, Loader, AlertCircle } from 'lucide-react';
import styles from './dashboard.module.scss';

type Media = {
  id: string;
  type: string;
  name: string;
  path: string;
  thumbnailPath: string | null;
  status: string;
  isBookmarked: boolean;
  isShared: boolean;
};

export default function MediaCard({ media }: { media: Media }) {
  const router = useRouter();
  const [isBookmarked, setIsBookmarked] = useState(media.isBookmarked);
  const [isShared, setIsShared] = useState(media.isShared);
  const [loading, setLoading] = useState(false);

  const handleCardClick = () => {
    router.push(`/view?id=${media.id}`);
  };

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/media/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: media.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsBookmarked(data.isBookmarked);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/media/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: media.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsShared(data.isShared);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderThumbnail = () => {
    if (media.status === 'processing') {
      return (
        <div className={styles.mediaPlaceholder}>
          <Loader size={32} className={styles.spinner} />
          <span className={styles.placeholderText}>変換中...</span>
        </div>
      );
    }

    if (media.status === 'error') {
      return (
        <div className={styles.mediaPlaceholder}>
          <AlertCircle size={32} className={styles.errorIcon} />
          <span className={styles.placeholderText}>変換失敗</span>
        </div>
      );
    }

    if (media.type === 'video' && media.thumbnailPath) {
      return <img src={media.thumbnailPath} alt={media.name} className={styles.mediaThumbnail} />;
    }

    if (media.type === 'image') {
      return <img src={media.path} alt={media.name} className={styles.mediaThumbnail} />;
    }

    // 動画でサムネイルがない場合
    return (
      <div className={styles.mediaPlaceholder}>
        <span className={styles.placeholderText}>No Preview</span>
      </div>
    );
  };

  return (
    <div className={styles.mediaCard} onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      {renderThumbnail()}
      <div className={styles.mediaFooter}>
        <p className={styles.mediaName}>{media.name}</p>
        <div className={styles.mediaActions}>
          <button
            className={`${styles.actionButton} ${isBookmarked ? styles.bookmarked : ''}`}
            onClick={toggleBookmark}
            aria-label="ブックマーク"
          >
            <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
          <button
            className={`${styles.actionButton} ${isShared ? styles.shared : ''}`}
            onClick={toggleShare}
            aria-label="共有"
          >
            <Share2 size={16} fill={isShared ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </div>
  );
}
