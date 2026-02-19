import { execSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
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

/**
 * gocryptfsの暗号化パスワードを変更する
 * パスワード変更時に使用（マウント中でも実行可能）
 */
export function changeEncryptedDirPassword(
  userId: string,
  oldHashedPassword: string,
  newHashedPassword: string
): void {
  const cipherDir = path.join(DATA_DIR, userId);

  execSync(
    `gocryptfs -passwd -q -extpass "echo '${oldHashedPassword}'" -extpass "echo '${newHashedPassword}'" "${cipherDir}"`,
    { stdio: 'pipe' }
  );
}

/**
 * gocryptfsのマウントを解除する
 */
export function unmountEncryptedDir(userId: string): void {
  const mountPoint = path.join(MOUNT_DIR, userId);

  execSync(`fusermount -u "${mountPoint}"`, { stdio: 'pipe' });
}

/**
 * gocryptfsの暗号化ディレクトリを完全に破棄する
 * アカウント削除時に使用
 * 処理順: アンマウント → 暗号化ディレクトリ削除 → マウントポイント削除
 */
export function destroyEncryptedDir(userId: string): void {
  const cipherDir = path.join(DATA_DIR, userId);
  const mountPoint = path.join(MOUNT_DIR, userId);

  // 1. まずアンマウント（失敗したら処理中止でゾンビ防止）
  try {
    execSync(`fusermount -u "${mountPoint}"`, { stdio: 'pipe' });
  } catch {
    // マウントされていない場合はエラーを無視して続行
    // mountpointコマンドで確認し、マウント中なら再スロー
    try {
      execSync(`mountpoint -q "${mountPoint}"`);
      // mountpointが成功 = まだマウント中 → アンマウント失敗は致命的
      throw new Error(`アンマウントに失敗しました: ${mountPoint}`);
    } catch (e) {
      // mountpointが失敗 = マウントされていない → 安全に続行
      if (e instanceof Error && e.message.includes('アンマウントに失敗')) {
        throw e;
      }
    }
  }

  // 2. 暗号化ディレクトリを削除
  rmSync(cipherDir, { recursive: true, force: true });

  // 3. マウントポイントを削除
  rmSync(mountPoint, { recursive: true, force: true });
}
