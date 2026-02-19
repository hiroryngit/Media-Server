'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PanelLeft, ArrowLeftFromLine, Bookmark, Share2, Settings, LogOut, Upload, Trash2 } from 'lucide-react';
import { logout } from '@/app/actions/logout';
import styles from './Header.module.scss';

export default function Header() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleBack = () => {
    if (window.history.length <= 1) {
      logout();
      return;
    }

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
    { label: 'アップロード', icon: Upload, onClick: () => { setMenuOpen(false); router.push('/upload'); } },
    { label: 'ブックマーク', icon: Bookmark, onClick: () => setMenuOpen(false) },
    { label: '共有', icon: Share2, onClick: () => setMenuOpen(false) },
    { label: 'コンテンツ削除', icon: Trash2, onClick: () => { setMenuOpen(false); router.push('/delete'); } },
    { label: '管理', icon: Settings, onClick: () => { setMenuOpen(false); router.push('/settings'); } },
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
