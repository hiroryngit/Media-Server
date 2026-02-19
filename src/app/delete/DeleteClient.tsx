'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './delete.module.scss';

type Media = {
  id: string;
  type: string;
  name: string;
  path: string;
};

export default function DeleteClient({ mediaList }: { mediaList: Media[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(mediaList.map((m) => m.id)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;

    const confirmed = window.confirm(`${selected.size}件のコンテンツを削除しますか？この操作は取り消せません。`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '削除に失敗しました');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      alert('削除中にエラーが発生しました');
    } finally {
      setDeleting(false);
    }
  };

  if (mediaList.length === 0) {
    return (
      <main className={styles.main}>
        <div className={styles.emptyState}>
          <p className={styles.emptyMessage}>削除するコンテンツがありません</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.toolbar}>
        <button className={styles.toolbarButton} onClick={selectAll}>
          全選択
        </button>
        <button className={styles.toolbarButton} onClick={deselectAll}>
          全解除
        </button>
      </div>

      <div className={styles.mediaGrid}>
        {mediaList.map((media) => (
          <div
            key={media.id}
            className={`${styles.mediaCard} ${selected.has(media.id) ? styles.mediaCardSelected : ''}`}
            onClick={() => toggleSelect(media.id)}
          >
            <div className={styles.checkboxOverlay}>
              <input
                type="checkbox"
                checked={selected.has(media.id)}
                onChange={() => toggleSelect(media.id)}
                onClick={(e) => e.stopPropagation()}
                className={styles.checkbox}
              />
            </div>
            {media.type === 'image' ? (
              <img src={media.path} alt={media.name} className={styles.mediaThumbnail} />
            ) : (
              <video src={media.path} className={styles.mediaThumbnail} />
            )}
            <p className={styles.mediaName}>{media.name}</p>
          </div>
        ))}
      </div>

      <div className={styles.bottomBar}>
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          disabled={selected.size === 0 || deleting}
        >
          {deleting ? '削除中...' : `${selected.size}件削除`}
        </button>
      </div>
    </main>
  );
}
