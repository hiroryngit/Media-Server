'use client';
import { registerUser } from './actions';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from "./signup.module.scss"; // 専用のSassを読み込む

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (formData: FormData) => {
    const username = formData.get('username');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    // パスワード一致チェック
    if (password !== confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }

    // ここで保存処理（今はログ出すだけ）
    console.log("登録データ:", { username, password });
    
    // 成功したらログイン（トップ）へ
    router.push('/');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>新規アカウント作成</h1>

        {error && <p className={styles.errorMessage}>{error}</p>}

        <form action={registerUser}>
          <div className={styles.formGroup}>
            <label htmlFor="username">ユーザーネーム</label>
            <input type="text" id="username" name="username" placeholder="ニックネームなど" required />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">パスワード</label>
            <input type="password" id="password" name="password" placeholder="6文字以上" required />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">パスワード（確認）</label>
            <input type="password" id="confirmPassword" name="confirmPassword" placeholder="もう一度入力" required />
          </div>

          <button type="submit" className={styles.submitButton}>
            アカウントを作成する
          </button>

          <Link href="/" className={styles.backLink}>
            ログイン画面に戻る
          </Link>
        </form>
      </div>
    </div>
  );
}