'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Share2, Loader, AlertCircle } from 'lucide-react';
import styles from '../dashboard/dashboard.module.scss';
import bookmarkStyles from './bookmarks.module.scss';

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

type UndoItem = {
  mediaId: string;
  mediaName: string;
  timerId: ReturnType<typeof setTimeout>;
};

const UNDO_DURATION = 5000;

export default function BookmarksClient({ mediaList }: { mediaList: Media[] }) {
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [sharedState, setSharedState] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const m of mediaList) map[m.id] = m.isShared;
    return map;
  });
  const [undoItems, setUndoItems] = useState<UndoItem[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const undoItemsRef = useRef(undoItems);
  undoItemsRef.current = undoItems;

  // クリーンアップ
  useEffect(() => {
    return () => {
      for (const item of undoItemsRef.current) {
        clearTimeout(item.timerId);
      }
    };
  }, []);

  const handleUnbookmark = useCallback(async (mediaId: string, mediaName: string) => {
    if (loading) return;
    setLoading(mediaId);

    try {
      const res = await fetch('/api/media/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId }),
      });

      if (!res.ok) return;

      // 一覧から非表示にする
      setHiddenIds((prev) => new Set(prev).add(mediaId));

      // undo用タイマー
      const timerId = setTimeout(() => {
        setUndoItems((prev) => prev.filter((item) => item.mediaId !== mediaId));
      }, UNDO_DURATION);

      setUndoItems((prev) => [...prev, { mediaId, mediaName, timerId }]);
    } finally {
      setLoading(null);
    }
  }, [loading]);

  const handleUndo = useCallback(async (mediaId: string) => {
    // タイマーをクリア
    setUndoItems((prev) => {
      const item = prev.find((i) => i.mediaId === mediaId);
      if (item) clearTimeout(item.timerId);
      return prev.filter((i) => i.mediaId !== mediaId);
    });

    // APIでブックマーク復元
    const res = await fetch('/api/media/bookmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId }),
    });

    if (res.ok) {
      // 一覧に戻す
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    }
  }, []);

  const toggleShare = useCallback(async (e: React.MouseEvent, mediaId: string) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(mediaId);
    try {
      const res = await fetch('/api/media/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSharedState((prev) => ({ ...prev, [mediaId]: data.isShared }));
      }
    } finally {
      setLoading(null);
    }
  }, [loading]);

  const handleCardClick = (mediaId: string) => {
    router.push(`/view?id=${mediaId}`);
  };

  const visibleMedia = mediaList.filter((m) => !hiddenIds.has(m.id));

  const renderThumbnail = (media: Media) => {
    if (media.status === 'processing') {
      return (
        <div className={styles.mediaPlaceholder}>
          <Loader size={32} className={styles.spinner} />
        </div>
      );
    }
    if (media.status === 'error') {
      return (
        <div className={styles.mediaPlaceholder}>
          <AlertCircle size={32} className={styles.errorIcon} />
        </div>
      );
    }
    if (media.type === 'video' && media.thumbnailPath) {
      return <img src={media.thumbnailPath} alt={media.name} className={styles.mediaThumbnail} />;
    }
    if (media.type === 'image') {
      return <img src={media.path} alt={media.name} className={styles.mediaThumbnail} />;
    }
    return (
      <div className={styles.mediaPlaceholder}>
        <span className={styles.placeholderText}>No Preview</span>
      </div>
    );
  };

  return (
    <main className={styles.main}>
      {visibleMedia.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyMessage}>ブックマークがありません</p>
        </div>
      ) : (
        <div className={styles.mediaGrid}>
          {visibleMedia.map((media) => (
            <div
              key={media.id}
              className={styles.mediaCard}
              onClick={() => handleCardClick(media.id)}
              style={{ cursor: 'pointer' }}
            >
              {renderThumbnail(media)}
              <div className={styles.mediaFooter}>
                <p className={styles.mediaName}>{media.name}</p>
                <div className={styles.mediaActions}>
                  <button
                    className={`${styles.actionButton} ${styles.bookmarked}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnbookmark(media.id, media.name);
                    }}
                    aria-label="ブックマーク解除"
                  >
                    <Bookmark size={16} fill="currentColor" />
                  </button>
                  <button
                    className={`${styles.actionButton} ${sharedState[media.id] ? styles.shared : ''}`}
                    onClick={(e) => toggleShare(e, media.id)}
                    aria-label="共有"
                  >
                    <Share2 size={16} fill={sharedState[media.id] ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Undo トースト */}
      {undoItems.length > 0 && (
        <div className={bookmarkStyles.undoContainer}>
          {undoItems.map((item) => (
            <div key={item.mediaId} className={bookmarkStyles.undoToast}>
              <span className={bookmarkStyles.undoText}>
                ブックマークを解除しました
              </span>
              <button
                className={bookmarkStyles.undoButton}
                onClick={() => handleUndo(item.mediaId)}
              >
                元に戻す
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
