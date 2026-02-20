'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import styles from './view.module.scss';

type Media = {
  id: string;
  type: string;
  name: string;
  path: string;
  thumbnailPath: string | null;
  status: string;
};

export default function ViewerClient({ media }: { media: Media }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (media.type !== 'video') return;

    const isHls = media.path.endsWith('.m3u8');

    if (isHls) {
      // HLS再生
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari: ネイティブHLS対応
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
      // 変換中: mp4直接再生
      video.src = media.path;
    }
  }, [media.path, media.type]);

  if (media.type === 'image') {
    return (
      <main className={styles.main}>
        <h2 className={styles.title}>{media.name}</h2>
        <div className={styles.imageContainer}>
          <img src={media.path} alt={media.name} className={styles.image} />
        </div>
      </main>
    );
  }

  // 動画
  return (
    <main className={styles.main}>
      <h2 className={styles.title}>{media.name}</h2>
      <div className={styles.videoContainer}>
        <video
          ref={videoRef}
          className={styles.video}
          controls
          playsInline
          poster={media.thumbnailPath || undefined}
        />
      </div>
    </main>
  );
}
