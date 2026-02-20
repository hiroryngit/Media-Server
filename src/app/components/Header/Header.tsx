'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PanelLeft, ArrowLeftFromLine, Bookmark, Share2, Settings, LogOut, Upload, Trash2, UserCircle } from 'lucide-react';
import { logout } from '@/app/actions/logout';
import styles from './Header.module.scss';

export default function Header({ username }: { username: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleBack = () => {
    // /dashboardからの「戻る」はログアウト（ログイン画面に戻る）
    if (pathname === '/dashboard') {
      logout();
      return;
    }

    router.back();
  };

  const menuItems = [
    { label: 'アップロード', icon: Upload, onClick: () => { setMenuOpen(false); router.push('/upload'); } },
    { label: 'ブックマーク', icon: Bookmark, onClick: () => { setMenuOpen(false); router.push('/bookmarks'); } },
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
        <div className={styles.userInfo}>
          <UserCircle size={22} className={styles.userIcon} />
          <span className={styles.username}>{username}</span>
        </div>
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
        <div className={styles.menuProfile}>
          <UserCircle size={36} className={styles.menuProfileIcon} />
          <span className={styles.menuProfileName}>{username}</span>
        </div>
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
