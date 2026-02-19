import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'encrypted');
const MOUNT_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * gocryptfsの暗号化ディレクトリを初期化し、マウントする
 * ユーザー新規登録時に呼び出す
 */
export function initEncryptedDir(userId: string, hashedPassword: string): void {
  const cipherDir = path.join(DATA_DIR, userId);
  const mountPoint = path.join(MOUNT_DIR, userId);

  // ディレクトリ作成
  mkdirSync(cipherDir, { recursive: true });
  mkdirSync(mountPoint, { recursive: true });

  // gocryptfs 初期化
  execSync(
    `gocryptfs -init -q -extpass "echo '${hashedPassword}'" "${cipherDir}"`,
    { stdio: 'pipe' }
  );

  // マウント
  execSync(
    `gocryptfs -q -extpass "echo '${hashedPassword}'" "${cipherDir}" "${mountPoint}"`,
    { stdio: 'pipe' }
  );
}

/**
 * 既に初期化済みのgocryptfsディレクトリをマウントする
 * サーバー再起動時等に使用
 */
export function mountEncryptedDir(userId: string, hashedPassword: string): void {
  const cipherDir = path.join(DATA_DIR, userId);
  const mountPoint = path.join(MOUNT_DIR, userId);

  mkdirSync(mountPoint, { recursive: true });

  execSync(
    `gocryptfs -q -extpass "echo '${hashedPassword}'" "${cipherDir}" "${mountPoint}"`,
    { stdio: 'pipe' }
  );
}
