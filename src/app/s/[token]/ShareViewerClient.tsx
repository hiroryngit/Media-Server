'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import styles from './shareview.module.scss';

type Media = {
  id: string;
  type: string;
  name: string;
  path: string;
  thumbnailPath: string | null;
  status: string;
};

export default function ShareViewerClient({ token }: { token: string }) {
  const [phase, setPhase] = useState<'loading' | 'password' | 'viewer' | 'error'>('loading');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [mediaName, setMediaName] = useState('');
  const [password, setPassword] = useState('');
  const [media, setMedia] = useState<Media | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cleanedUp = useRef(false);

  // 共有リンク情報取得
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/share/info?token=${token}`);
        if (!res.ok) {
          setErrorMsg('この共有リンクは無効です');
          setPhase('error');
          return;
        }
        const data = await res.json();
        setMediaName(data.mediaName);
        setNeedsPassword(data.needsPassword);

        if (data.needsPassword) {
          setPhase('password');
        } else {
          // パスワード不要 → 直接認証
          await authenticate('');
        }
      } catch {
        setErrorMsg('読み込みに失敗しました');
        setPhase('error');
      }
    })();
  }, [token]);

  const authenticate = useCallback(async (pw: string) => {
    setAuthenticating(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/share/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || '認証に失敗しました');
        setAuthenticating(false);
        return;
      }

      const data = await res.json();
      setMedia(data.media);
      setPhase('viewer');
    } catch {
      setErrorMsg('認証中にエラーが発生しました');
    } finally {
      setAuthenticating(false);
    }
  }, [token]);

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    authenticate(password);
  };

  // クリーンアップ（ページ離脱時）
  const cleanup = useCallback(() => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    navigator.sendBeacon('/api/share/cleanup');
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [cleanup]);

  // HLS / 動画再生
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media || media.type !== 'video') return;

    const isHls = media.path.endsWith('.m3u8');

    if (isHls) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = media.path;
      } else if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(media.path);
        hls.attachMedia(video);
        return () => {
          hls.destroy();
        };
      }
    } else {
      video.src = media.path;
    }
  }, [media]);

  if (phase === 'loading') {
    return (
      <main className={styles.main}>
        <p className={styles.loadingText}>読み込み中...</p>
      </main>
    );
  }

  if (phase === 'error') {
    return (
      <main className={styles.main}>
        <div className={styles.errorBox}>
          <p>{errorMsg}</p>
        </div>
      </main>
    );
  }

  if (phase === 'password') {
    return (
      <main className={styles.main}>
        <div className={styles.authCard}>
          <h2 className={styles.authTitle}>{mediaName}</h2>
          <p className={styles.authSubtitle}>このコンテンツにはパスワードが必要です</p>
          <form onSubmit={handleSubmitPassword} className={styles.authForm}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className={styles.authInput}
              autoFocus
              disabled={authenticating}
            />
            {errorMsg && <p className={styles.authError}>{errorMsg}</p>}
            <button
              type="submit"
              className={styles.authButton}
              disabled={authenticating || !password}
            >
              {authenticating ? '確認中...' : 'アクセス'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // viewer phase
  if (!media) return null;

  return (
    <main className={styles.main}>
      <h2 className={styles.viewerTitle}>{media.name}</h2>
      {media.type === 'image' ? (
        <div className={styles.imageContainer}>
          <img src={media.path} alt={media.name} className={styles.image} />
        </div>
      ) : (
        <div className={styles.videoContainer}>
          <video
            ref={videoRef}
            className={styles.video}
            controls
            playsInline
            poster={media.thumbnailPath || undefined}
          />
        </div>
      )}
    </main>
  );
}
