// src/app/page.tsx
'use client'; // エラー表示のアニメーションや状態管理のために必要

import { useActionState } from 'react';
import styles from './page.module.scss';
import { loginUser } from './actions';
import Link from 'next/link';

export default function LoginPage() {
  // useActionStateでサーバーアクションの結果を受け取る
  // [現在の状態, アクションを実行する関数]
  const [state, formAction, isPending] = useActionState(loginUser, null);

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1>Login</h1>

        {/* サーバーからエラーが返ってきたら表示 */}
        {state?.error && (
          <div className={styles.errorMessage}>
            {state.error}
          </div>
        )}

        <form action={formAction}>
          <div className={styles.formGroup}>
            <label htmlFor="username">ユーザー名</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              placeholder="ユーザー名を入力"
              autoComplete="username"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="パスワードを入力"
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className={styles.loginButton}
            disabled={isPending}
          >
            {isPending ? 'ログイン中...' : 'ログイン'}
          </button>

          <Link href="/signup" className={styles.registerButton}>
            新規登録はこちら
          </Link>
        </form>
      </div>
    </div>
  );
}