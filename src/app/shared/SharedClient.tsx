'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Loader, AlertCircle, Key, KeyRound, LockOpen, Share2 } from 'lucide-react';
import dashStyles from '../dashboard/dashboard.module.scss';
import styles from './shared.module.scss';

type ShareLink = {
  id: string;
  token: string;
  password: string | null;
};

type Media = {
  id: string;
  type: string;
  name: string;
  path: string;
  thumbnailPath: string | null;
  status: string;
  shareLink: ShareLink | null;
};

export default function SharedClient({ mediaList }: { mediaList: Media[] }) {
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {};
    for (const m of mediaList) {
      if (m.shareLink) map[m.shareLink.id] = m.shareLink.password;
    }
    return map;
  });
  const [customInput, setCustomInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const getShareUrl = (token: string) => {
    return `${window.location.origin}/s/${token}`;
  };

  const copyLink = useCallback(async (token: string, mediaId: string) => {
    await navigator.clipboard.writeText(getShareUrl(token));
    setCopiedId(mediaId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const toggleShare = useCallback(async (e: React.MouseEvent, mediaId: string) => {
    e.stopPropagation();
    if (toggling) return;
    setToggling(mediaId);
    try {
      const res = await fetch('/api/media/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.isShared) {
          // 共有OFF → 一覧から消す
          setHiddenIds((prev) => new Set(prev).add(mediaId));
          setExpandedId((prev) => (prev === mediaId ? null : prev));
        }
      }
    } finally {
      setToggling(null);
    }
  }, [toggling]);

  const updatePassword = useCallback(async (shareLinkId: string, mode: 'random' | 'custom' | 'none', customPassword?: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/share/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareLinkId, mode, customPassword }),
      });
      if (res.ok) {
        const data = await res.json();
        setPasswords((prev) => ({ ...prev, [shareLinkId]: data.password }));
        setCustomInput('');
      }
    } finally {
      setSaving(false);
    }
  }, []);

  const renderThumbnail = (media: Media) => {
    if (media.status === 'processing') {
      return (
        <div className={dashStyles.mediaPlaceholder}>
          <Loader size={32} className={dashStyles.spinner} />
        </div>
      );
    }
    if (media.status === 'error') {
      return (
        <div className={dashStyles.mediaPlaceholder}>
          <AlertCircle size={32} className={dashStyles.errorIcon} />
        </div>
      );
    }
    if (media.type === 'video' && media.thumbnailPath) {
      return <img src={media.thumbnailPath} alt={media.name} className={dashStyles.mediaThumbnail} />;
    }
    if (media.type === 'image') {
      return <img src={media.path} alt={media.name} className={dashStyles.mediaThumbnail} />;
    }
    return (
      <div className={dashStyles.mediaPlaceholder}>
        <span className={dashStyles.placeholderText}>No Preview</span>
      </div>
    );
  };

  const visibleMedia = mediaList.filter((m) => !hiddenIds.has(m.id));

  return (
    <main className={dashStyles.main}>
      {visibleMedia.length === 0 ? (
        <div className={dashStyles.emptyState}>
          <p className={dashStyles.emptyMessage}>共有中のコンテンツがありません</p>
        </div>
      ) : (
        <div className={dashStyles.mediaGrid}>
          {visibleMedia.map((media) => {
            const sl = media.shareLink;
            const isExpanded = expandedId === media.id;
            const currentPassword = sl ? passwords[sl.id] : null;

            return (
              <div key={media.id} className={dashStyles.mediaCard}>
                <div
                  onClick={() => router.push(`/view?id=${media.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  {renderThumbnail(media)}
                </div>
                <div className={dashStyles.mediaFooter}>
                  <p className={dashStyles.mediaName}>{media.name}</p>
                  <div className={dashStyles.mediaActions}>
                    <button
                      className={`${dashStyles.actionButton} ${dashStyles.shared}`}
                      onClick={(e) => toggleShare(e, media.id)}
                      aria-label="共有解除"
                    >
                      <Share2 size={16} fill="currentColor" />
                    </button>
                    {sl && (
                      <>
                        <button
                          className={dashStyles.actionButton}
                          onClick={() => copyLink(sl.token, media.id)}
                          aria-label="リンクをコピー"
                        >
                          {copiedId === media.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                        <button
                          className={dashStyles.actionButton}
                          onClick={() => setExpandedId(isExpanded ? null : media.id)}
                          aria-label="パスワード管理"
                        >
                          {currentPassword === null ? <LockOpen size={16} /> : <Key size={16} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* パスワード管理パネル（共有リンクがある場合のみ） */}
                {isExpanded && sl && (
                  <div className={styles.panel}>
                    <div className={styles.panelRow}>
                      <span className={styles.panelLabel}>
                        {currentPassword === null ? 'パスワードなし' : `パスワード: ${currentPassword}`}
                      </span>
                    </div>
                    <div className={styles.panelActions}>
                      <button
                        className={styles.panelButton}
                        onClick={() => updatePassword(sl.id, 'random')}
                        disabled={saving}
                      >
                        <KeyRound size={14} />
                        ランダム
                      </button>
                      <button
                        className={styles.panelButton}
                        onClick={() => {
                          if (currentPassword !== null) {
                            updatePassword(sl.id, 'none');
                          } else {
                            updatePassword(sl.id, 'random');
                          }
                        }}
                        disabled={saving}
                      >
                        <LockOpen size={14} />
                        {currentPassword !== null ? 'パスワードなし' : 'パスワードあり'}
                      </button>
                    </div>
                    <div className={styles.customRow}>
                      <input
                        type="text"
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="カスタムパスワード"
                        className={styles.customInput}
                        disabled={saving}
                      />
                      <button
                        className={styles.panelButton}
                        onClick={() => updatePassword(sl.id, 'custom', customInput)}
                        disabled={saving || !customInput}
                      >
                        設定
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
