'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, Loader } from 'lucide-react';
import styles from './upload.module.scss';

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
const POLL_INTERVAL = 3000;

type FileEntry = {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
};

/** DBから渡される処理中メディア */
export type ProcessingMedia = {
  id: string;
  name: string;
  type: string;
  status: string;
  thumbnailPath: string | null;
};

export default function UploadClient({
  initialProcessing,
}: {
  initialProcessing: ProcessingMedia[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState<ProcessingMedia[]>(initialProcessing);

  // 処理中ファイルのステータスをポーリング
  useEffect(() => {
    if (processing.length === 0) return;

    const poll = async () => {
      const ids = processing.filter((p) => p.status === 'processing').map((p) => p.id).join(',');
      if (!ids) return;

      try {
        const res = await fetch(`/api/upload/status?ids=${ids}`);
        if (!res.ok) return;
        const data = await res.json();

        setProcessing((prev) =>
          prev.map((p) => {
            const updated = data.statuses?.[p.id];
            if (updated) {
              return { ...p, status: updated.status, thumbnailPath: updated.thumbnailPath };
            }
            return p;
          })
        );
      } catch {
        // ネットワークエラー時は無視
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [processing]);

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
      const initData = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initData.error || 'アップロードの初期化に失敗しました');
      }
      const { uploadId } = initData;

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
      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completeData.error || 'アップロードの完了処理に失敗しました');
      }

      // 完了したファイルをprocessingリストに追加（ステータスポーリング対象にする）
      const { mediaId } = completeData;
      if (mediaId) {
        setProcessing((prev) => [
          ...prev,
          {
            id: mediaId,
            name: entry.file.name,
            type: ALLOWED_IMAGE_TYPES.includes(entry.file.type) ? 'image' : 'video',
            status: 'processing',
            thumbnailPath: null,
          },
        ]);
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
  const stillProcessingCount = processing.filter((p) => p.status === 'processing').length;

  // 全ファイルアップロード完了（エラーなし）かつ全処理完了で自動遷移
  useEffect(() => {
    if (
      files.length > 0 &&
      !uploading &&
      pendingCount === 0 &&
      errorCount === 0 &&
      doneCount === files.length &&
      stillProcessingCount === 0
    ) {
      router.push('/dashboard');
    }
  }, [files, uploading, pendingCount, errorCount, doneCount, stillProcessingCount, router]);

  return (
    <main className={styles.main}>
      {/* 処理中ファイル一覧 */}
      {processing.length > 0 && (
        <div className={styles.processingSection}>
          <h3 className={styles.processingSectionTitle}>
            {stillProcessingCount > 0
              ? `${stillProcessingCount}件のファイルを処理中`
              : '全ての処理が完了しました'}
          </h3>
          <div className={styles.fileList}>
            {processing.map((media) => (
              <div key={media.id} className={styles.fileItem}>
                <div className={styles.fileThumbnail}>
                  {media.thumbnailPath ? (
                    <img src={media.thumbnailPath} alt={media.name} />
                  ) : (
                    <div className={styles.processingPlaceholder}>
                      {media.status === 'processing' ? (
                        <Loader size={20} className={styles.spinner} />
                      ) : (
                        <span className={styles.placeholderIcon}>
                          {media.type === 'video' ? '🎬' : '🖼'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.fileInfo}>
                  <p className={styles.fileName}>{media.name}</p>
                  {media.status === 'processing' && (
                    <p className={styles.statusProcessing}>処理中...</p>
                  )}
                  {media.status === 'ready' && (
                    <p className={styles.statusDone}>完了</p>
                  )}
                  {media.status === 'error' && (
                    <p className={styles.statusError}>エラー</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            {pendingCount === 0 && errorCount === 0 && doneCount > 0 && stillProcessingCount === 0 && (
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
