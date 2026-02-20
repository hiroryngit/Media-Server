'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import styles from './settings.module.scss';

export default function SettingsClient() {
  const router = useRouter();

  // パスワード変更
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // アカウント削除
  const [deletePassword, setDeletePassword] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const refreshCaptcha = useCallback(() => {
    // タイムスタンプでキャッシュ回避
    setCaptchaUrl(`/api/captcha?t=${Date.now()}`);
    setCaptchaInput('');
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('すべての項目を入力してください');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('新しいパスワードが一致しません');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('新しいパスワードは6文字以上にしてください');
      return;
    }

    setChangingPassword(true);

    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || 'パスワードの変更に失敗しました');
        return;
      }

      setPasswordSuccess('パスワードを変更しました');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPasswordError('パスワード変更中にエラーが発生しました');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('パスワードを入力してください');
      return;
    }
    if (!captchaInput) {
      setDeleteError('画像に表示されている文字を入力してください');
      return;
    }

    const confirmed = window.confirm(
      '本当にアカウントを削除しますか？\nアップロードしたすべてのデータが完全に失われます。この操作は取り消せません。'
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError('');

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword, captcha: captchaInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error || 'アカウントの削除に失敗しました');
        refreshCaptcha();
        return;
      }

      router.push('/');
    } catch {
      setDeleteError('削除中にエラーが発生しました');
      refreshCaptcha();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>アカウント管理</h1>

      {/* パスワード変更セクション */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>パスワード変更</h2>

        <div className={styles.inputGroup}>
          <label htmlFor="currentPassword" className={styles.label}>
            現在のパスワード
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="現在のパスワード"
            className={styles.input}
            disabled={changingPassword}
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="newPassword" className={styles.label}>
            新しいパスワード
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="新しいパスワード（6文字以上）"
            className={styles.input}
            disabled={changingPassword}
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="confirmPassword" className={styles.label}>
            新しいパスワード（確認）
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="新しいパスワードを再入力"
            className={styles.input}
            disabled={changingPassword}
          />
        </div>

        {passwordError && <p className={styles.error}>{passwordError}</p>}
        {passwordSuccess && <p className={styles.success}>{passwordSuccess}</p>}

        <button
          className={styles.primaryButton}
          onClick={handleChangePassword}
          disabled={!currentPassword || !newPassword || !confirmPassword || changingPassword}
        >
          {changingPassword ? '変更中...' : 'パスワードを変更'}
        </button>
      </section>

      {/* アカウント削除セクション */}
      <section className={styles.dangerSection}>
        <h2 className={styles.dangerTitle}>アカウント削除</h2>
        <p className={styles.dangerDescription}>
          アカウントを削除すると、アップロードしたすべてのコンテンツとデータが完全に削除されます。この操作は取り消せません。
        </p>

        <div className={styles.inputGroup}>
          <label htmlFor="deletePassword" className={styles.label}>
            パスワードを入力して確認
          </label>
          <input
            id="deletePassword"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="パスワード"
            className={styles.input}
            disabled={deleting}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>
            下の画像に表示されている文字を入力
          </label>
          <div className={styles.captchaRow}>
            {captchaUrl && (
              <img
                src={captchaUrl}
                alt="CAPTCHA"
                className={styles.captchaImage}
                draggable={false}
              />
            )}
            <button
              className={styles.captchaRefresh}
              onClick={refreshCaptcha}
              type="button"
              aria-label="CAPTCHAを更新"
              disabled={deleting}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          <input
            id="captchaInput"
            type="text"
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
            placeholder="画像の文字を入力"
            className={styles.input}
            autoComplete="off"
            disabled={deleting}
          />
        </div>

        {deleteError && <p className={styles.error}>{deleteError}</p>}

        <button
          className={styles.deleteButton}
          onClick={handleDeleteAccount}
          disabled={!deletePassword || !captchaInput || deleting}
        >
          {deleting ? '削除中...' : 'アカウントを削除'}
        </button>
      </section>
    </main>
  );
}
