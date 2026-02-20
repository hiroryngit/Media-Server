'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import styles from './upload.module.scss';

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export default function UploadClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((selected: File) => {
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('対応していないファイル形式です（画像: jpg/png/gif/webp、動画: mp4/webm/mov）');
      return;
    }
    setError(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  };

  const handleUpload = () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        router.push('/dashboard');
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          setError(res.error || 'アップロードに失敗しました');
        } catch {
          setError('アップロードに失敗しました');
        }
        setUploading(false);
      }
    });

    xhr.addEventListener('error', () => {
      setError('ネットワークエラーが発生しました');
      setUploading(false);
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  };

  const isImage = file && ALLOWED_IMAGE_TYPES.includes(file.type);

  return (
    <main className={styles.main}>
        <div
          className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={48} className={styles.dropzoneIcon} />
          <p className={styles.dropzoneText}>
            ドラッグ&ドロップ または クリックしてファイルを選択
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileInput}
            hidden
          />
        </div>

        {error && <p style={{ color: '#e74c3c', marginTop: '1rem' }}>{error}</p>}

        {file && previewUrl && (
          <div className={styles.previewArea}>
            {isImage ? (
              <img src={previewUrl} alt={file.name} className={styles.previewMedia} />
            ) : (
              <video src={previewUrl} controls className={styles.previewMedia} />
            )}
            <p className={styles.fileName}>{file.name}</p>

            {uploading ? (
              <div className={styles.progressArea}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                </div>
                <span className={styles.progressText}>{progress}%</span>
              </div>
            ) : (
              <button className={styles.uploadButton} onClick={handleUpload}>
                <Upload size={20} />
                <span>アップロード</span>
              </button>
            )}
          </div>
        )}
    </main>
  );
}
