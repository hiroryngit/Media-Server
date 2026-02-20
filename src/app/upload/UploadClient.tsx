'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X } from 'lucide-react';
import styles from './upload.module.scss';

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB

type FileEntry = {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
};

export default function UploadClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback((selected: FileList | File[]) => {
    const newEntries: FileEntry[] = [];
    for (const file of Array.from(selected)) {
      if (!ALLOWED_TYPES.includes(file.type)) continue;
      newEntries.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
      });
    }
    if (newEntries.length === 0) return;
    setFiles((prev) => [...prev, ...newEntries]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const entry = prev.find((f) => f.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

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
    addFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const uploadOne = async (entry: FileEntry): Promise<void> => {
    setFiles((prev) =>
      prev.map((f) => (f.id === entry.id ? { ...f, status: 'uploading' } : f))
    );

    try {
      // 1. アップロード初期化
      const initRes = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: entry.file.name,
          type: entry.file.type,
          size: entry.file.size,
        }),
      });
      if (!initRes.ok) {
        const data = await initRes.json();
        throw new Error(data.error || 'アップロードの初期化に失敗しました');
      }
      const { uploadId } = await initRes.json();

      // 2. チャンク送信
      const totalChunks = Math.ceil(entry.file.size / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, entry.file.size);
        const chunk = entry.file.slice(start, end);

        const chunkRes = await fetch(`/api/upload/chunk?id=${uploadId}&index=${i}`, {
          method: 'POST',
          body: chunk,
        });
        if (!chunkRes.ok) {
          throw new Error('チャンクのアップロードに失敗しました');
        }

        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setFiles((prev) =>
          prev.map((f) => (f.id === entry.id ? { ...f, progress } : f))
        );
      }

      // 3. アップロード完了
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
      });
      if (!completeRes.ok) {
        const data = await completeRes.json();
        throw new Error(data.error || 'アップロードの完了処理に失敗しました');
      }

      setFiles((prev) =>
        prev.map((f) => (f.id === entry.id ? { ...f, status: 'done', progress: 100 } : f))
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'ネットワークエラー';
      setFiles((prev) =>
        prev.map((f) => (f.id === entry.id ? { ...f, status: 'error', error: errorMsg } : f))
      );
    }
  };

  const handleUpload = async () => {
    const pending = files.filter((f) => f.status === 'pending');
    if (pending.length === 0) return;

    setUploading(true);
    for (const entry of pending) {
      await uploadOne(entry);
    }
    setUploading(false);
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const doneCount = files.filter((f) => f.status === 'done').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  // 全ファイルアップロード完了（エラーなし）で自動遷移
  useEffect(() => {
    if (files.length > 0 && !uploading && pendingCount === 0 && errorCount === 0 && doneCount === files.length) {
      router.push('/dashboard');
    }
  }, [files, uploading, pendingCount, errorCount, doneCount, router]);

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
          ドラッグ&ドロップ または クリックしてファイルを選択（複数可）
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          onChange={handleFileInput}
          hidden
        />
      </div>

      {files.length > 0 && (
        <>
          <div className={styles.fileList}>
            {files.map((entry) => (
              <div key={entry.id} className={styles.fileItem}>
                <div className={styles.fileThumbnail}>
                  {ALLOWED_IMAGE_TYPES.includes(entry.file.type) ? (
                    <img src={entry.previewUrl} alt={entry.file.name} />
                  ) : (
                    <video src={entry.previewUrl} />
                  )}
                </div>
                <div className={styles.fileInfo}>
                  <p className={styles.fileName}>{entry.file.name}</p>
                  {entry.status === 'uploading' && (
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${entry.progress}%` }} />
                    </div>
                  )}
                  {entry.status === 'done' && (
                    <p className={styles.statusDone}>完了</p>
                  )}
                  {entry.status === 'error' && (
                    <p className={styles.statusError}>{entry.error}</p>
                  )}
                </div>
                {entry.status === 'pending' && (
                  <button
                    className={styles.removeButton}
                    onClick={() => removeFile(entry.id)}
                    aria-label="削除"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className={styles.uploadActions}>
            {errorCount > 0 && doneCount > 0 && (
              <p className={styles.statusSummary}>
                {doneCount}件完了 / {errorCount}件失敗
              </p>
            )}
            {pendingCount > 0 && (
              <button
                className={styles.uploadButton}
                onClick={handleUpload}
                disabled={uploading}
              >
                <Upload size={20} />
                <span>{uploading ? 'アップロード中...' : `${pendingCount}件アップロード`}</span>
              </button>
            )}
            {pendingCount === 0 && errorCount === 0 && doneCount > 0 && (
              <button
                className={styles.uploadButton}
                onClick={() => router.push('/dashboard')}
              >
                ダッシュボードへ
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
