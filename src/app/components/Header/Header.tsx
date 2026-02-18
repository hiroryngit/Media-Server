'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PanelLeft, ArrowLeftFromLine, Bookmark, Share2, Settings, LogOut } from 'lucide-react';
import { logout } from '@/app/actions/logout';
import styles from './Header.module.scss';

export default function Header() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleBack = () => {
    // window.history の前のページがログイン画面(/)ならログアウト
    // navigation API が使えない場合のフォールバックとして、
    // history.length が 1 以下なら直接ログアウト
    if (window.history.length <= 1) {
      logout();
      return;
    }

    // referrer でログインページからの遷移かチェック
    const referrer = document.referrer;
    const origin = window.location.origin;
    if (
      referrer === origin + '/' ||
      referrer === origin
    ) {
      logout();
      return;
    }

    router.back();
  };

  const menuItems = [
    { label: 'ブックマーク', icon: Bookmark, onClick: () => setMenuOpen(false) },
    { label: '共有', icon: Share2, onClick: () => setMenuOpen(false) },
    { label: '管理', icon: Settings, onClick: () => setMenuOpen(false) },
    {
      label: 'ログアウト',
      icon: LogOut,
      onClick: () => {
        setMenuOpen(false);
        logout();
      },
    },
  ];

  return (
    <>
      <header className={styles.header}>
        <button
          className={styles.iconButton}
          onClick={handleBack}
          aria-label="戻る"
        >
          <ArrowLeftFromLine size={24} />
        </button>
        <button
          className={styles.iconButton}
          onClick={() => setMenuOpen(true)}
          aria-label="メニューを開く"
        >
          <PanelLeft size={24} />
        </button>
      </header>

      {/* オーバーレイ */}
      <div
        className={`${styles.overlay} ${menuOpen ? styles.overlayVisible : ''}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* スライドメニュー */}
      <nav className={`${styles.menu} ${menuOpen ? styles.menuOpen : ''}`}>
        <ul className={styles.menuList}>
          {menuItems.map((item) => (
            <li key={item.label}>
              <button className={styles.menuItem} onClick={item.onClick}>
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
