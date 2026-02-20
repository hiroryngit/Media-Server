'use client';

import { useState } from 'react';
import { Bookmark, Share2 } from 'lucide-react';
import styles from './dashboard.module.scss';

type Media = {
  id: string;
  type: string;
  name: string;
  path: string;
  isBookmarked: boolean;
  isShared: boolean;
};

export default function MediaCard({ media }: { media: Media }) {
  const [isBookmarked, setIsBookmarked] = useState(media.isBookmarked);
  const [isShared, setIsShared] = useState(media.isShared);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className={styles.mediaCard}>
      {media.type === 'image' ? (
        <img src={media.path} alt={media.name} className={styles.mediaThumbnail} />
      ) : (
        <video src={media.path} className={styles.mediaThumbnail} />
      )}
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
