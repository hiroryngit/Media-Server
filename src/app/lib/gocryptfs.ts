import { execSync } from 'child_process';
import { mkdirSync, rmSync, rmdirSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'encrypted');
const MOUNT_DIR = path.join(process.cwd(), 'public', 'content');
const UPLOAD_DIR = path.join(process.cwd(), 'upload');
const SHARE_DIR = path.join(process.cwd(), 'public', 'share');

/**
 * パスワードを一時ファイルに書き出し、gocryptfsの-extpassに渡す
 * bcryptハッシュに含まれる$がシェルで変数展開されるのを防ぐ
 */
function withPasswordFile<T>(password: string, fn: (filePath: string) => T): T {
  const tmpFile = path.join(tmpdir(), `gocryptfs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  writeFileSync(tmpFile, password, { mode: 0o600 });
  try {
    return fn(tmpFile);
  } finally {
    try { unlinkSync(tmpFile); } catch { /* cleanup best-effort */ }
  }
}

/**
 * -extpassに渡すcatコマンドを生成する
 * gocryptfsはextpassをfork/execで直接実行するため、シェルの引用符は使えない
 */
function extpass(passFile: string): string {
  return `-extpass "cat ${passFile}"`;
}

/**
 * gocryptfsの暗号化ディレクトリを初期化し、マウントする
 * ユーザー新規登録時に呼び出す
 * 失敗時は作成したディレクトリを自動cleanup
 */
export function initEncryptedDir(userId: string, hashedPassword: string): void {
  const cipherDir = path.join(DATA_DIR, userId);
  const mountPoint = path.join(MOUNT_DIR, userId);

  // ディレクトリ作成
  mkdirSync(cipherDir, { recursive: true });
  mkdirSync(mountPoint, { recursive: true });

  try {
    withPasswordFile(hashedPassword, (passFile) => {
      // gocryptfs 初期化
      execSync(
        `gocryptfs -init -q ${extpass(passFile)} "${cipherDir}"`,
        { stdio: 'pipe' }
      );

      // マウント
      execSync(
        `gocryptfs -q ${extpass(passFile)} "${cipherDir}" "${mountPoint}"`,
        { stdio: 'pipe' }
      );
    });
  } catch (error) {
    // 失敗時はディレクトリを削除してゴミを残さない
    rmSync(cipherDir, { recursive: true, force: true });
    rmSync(mountPoint, { recursive: true, force: true });
    throw error;
  }
}

/**
 * 既に初期化済みのgocryptfsディレクトリをマウントする
 * サーバー再起動時等に使用
 */
export function mountEncryptedDir(userId: string, hashedPassword: string): void {
  const cipherDir = path.join(DATA_DIR, userId);
  const mountPoint = path.join(MOUNT_DIR, userId);

  // 遅延アンマウントの残骸やstaleマウントがあればクリーンアップ
  try {
    execSync(`mountpoint -q "${mountPoint}" 2>/dev/null`);
    // まだマウントされている → アンマウント
    execSync(`fusermount -u -z "${mountPoint}"`, { stdio: 'pipe' });
  } catch {
    // マウントされていない → 何もしない
  }

  // ディレクトリがなければ作成、あればそのまま使う
  mkdirSync(mountPoint, { recursive: true, mode: 0o755 });

  withPasswordFile(hashedPassword, (passFile) => {
    execSync(
      `gocryptfs -q ${extpass(passFile)} "${cipherDir}" "${mountPoint}"`,
      { stdio: 'pipe' }
    );
  });
}

/**
 * gocryptfsの暗号化パスワードを変更する
 * パスワード変更時に使用（マウント中でも実行可能）
 *
 * -passwdは単一の-extpassを2回呼び出す（1回目=旧パスワード、2回目=新パスワード）
 * 状態ファイルで呼び出し回数を判別するスクリプトを生成して渡す
 */
export function changeEncryptedDirPassword(
  userId: string,
  oldHashedPassword: string,
  newHashedPassword: string
): void {
  const cipherDir = path.join(DATA_DIR, userId);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const tmpOld = path.join(tmpdir(), `gocryptfs-old-${suffix}`);
  const tmpNew = path.join(tmpdir(), `gocryptfs-new-${suffix}`);
  const tmpState = path.join(tmpdir(), `gocryptfs-state-${suffix}`);
  const tmpScript = path.join(tmpdir(), `gocryptfs-script-${suffix}`);

  writeFileSync(tmpOld, oldHashedPassword, { mode: 0o600 });
  writeFileSync(tmpNew, newHashedPassword, { mode: 0o600 });

  // 1回目の呼び出しで旧パスワード、2回目で新パスワードを返すスクリプト
  writeFileSync(tmpScript, [
    '#!/bin/sh',
    `if [ ! -f "${tmpState}" ]; then`,
    `  touch "${tmpState}"`,
    `  cat "${tmpOld}"`,
    `else`,
    `  cat "${tmpNew}"`,
    `fi`,
  ].join('\n'), { mode: 0o700 });

  try {
    execSync(
      `gocryptfs -passwd -q -extpass "${tmpScript}" "${cipherDir}"`,
      { stdio: 'pipe' }
    );
  } finally {
    for (const f of [tmpOld, tmpNew, tmpState, tmpScript]) {
      try { unlinkSync(f); } catch { /* cleanup best-effort */ }
    }
  }
}

/**
 * gocryptfsのマウントを解除し、マウントポイントディレクトリを削除する
 * ログアウト・セッション切れ時に使用
 * 順番厳守: 1.アンマウント → 2.rmdir（空ディレクトリ削除のみ）
 * rmdirは空でないディレクトリを削除できないため、万一アンマウント前に呼ばれてもデータは消えない
 */
export function unmountEncryptedDir(userId: string, shouldUnmountUpload: boolean): void {
  const mountPoint = path.join(MOUNT_DIR, userId);

  // 1. 必ず先にアンマウント
  execSync(`fusermount -u -z "${mountPoint}"`, { stdio: 'pipe' });

  // 2. アンマウント成功後にのみ空のマウントポイントを削除
  rmdirSync(mountPoint);

  // 3. uploadディレクトリのアンマウントは状態に応じて判断
  if (shouldUnmountUpload) {
    try {
      unmountUploadDir(userId);
    } catch {
      // マウントされていなければ無視
    }
  }
}

/**
 * アップロード用マウントポイントにgocryptfsをマウントする
 * アップロードページアクセス時に呼び出す
 * 既にマウント済みの場合は何もしない
 */
export function mountUploadDir(userId: string, hashedPassword: string): void {
  const cipherDir = path.join(DATA_DIR, userId);
  const mountPoint = path.join(UPLOAD_DIR, userId);

  // 既にマウントされていたらスキップ
  try {
    execSync(`mountpoint -q "${mountPoint}" 2>/dev/null`);
    return;
  } catch {
    // マウントされていない → 続行
  }

  mkdirSync(mountPoint, { recursive: true, mode: 0o755 });

  withPasswordFile(hashedPassword, (passFile) => {
    execSync(
      `gocryptfs -q ${extpass(passFile)} "${cipherDir}" "${mountPoint}"`,
      { stdio: 'pipe' }
    );
  });
}

/**
 * アップロード用マウントを解除し、マウントポイントを削除する
 * ffmpeg処理完了後、またはログアウト時に呼び出す
 */
export function unmountUploadDir(userId: string): void {
  const mountPoint = path.join(UPLOAD_DIR, userId);

  // マウントされていなければ何もしない
  try {
    execSync(`mountpoint -q "${mountPoint}" 2>/dev/null`);
  } catch {
    try { rmdirSync(mountPoint); } catch { /* 存在しなければ無視 */ }
    return;
  }

  execSync(`fusermount -u -z "${mountPoint}"`, { stdio: 'pipe' });
  try { rmdirSync(mountPoint); } catch { /* cleanup best-effort */ }
}

/**
 * 共有閲覧者用: gocryptfsの暗号化ディレクトリを/share/{ownerId}/にマウントする
 * オーナーの/uploads/マウントとは独立した、閲覧者専用のマウントポイント
 * 既にマウント済みの場合は何もしない
 */
export function mountShareDir(ownerId: string, hashedPassword: string): void {
  const cipherDir = path.join(DATA_DIR, ownerId);
  const mountPoint = path.join(SHARE_DIR, ownerId);

  // 既にマウントされていたらスキップ
  try {
    execSync(`mountpoint -q "${mountPoint}" 2>/dev/null`);
    return; // マウント済み
  } catch {
    // マウントされていない → 続行
  }

  mkdirSync(mountPoint, { recursive: true, mode: 0o755 });

  withPasswordFile(hashedPassword, (passFile) => {
    execSync(
      `gocryptfs -q -ro ${extpass(passFile)} "${cipherDir}" "${mountPoint}"`,
      { stdio: 'pipe' }
    );
  });
}

/**
 * 共有閲覧者用: /share/{ownerId}/のマウントを解除する
 * 全閲覧者のセッションが切れたときに呼ぶ
 */
export function unmountShareDir(ownerId: string): void {
  const mountPoint = path.join(SHARE_DIR, ownerId);

  try {
    execSync(`mountpoint -q "${mountPoint}" 2>/dev/null`);
  } catch {
    // マウントされていない → rmdirだけ試みる
    try { rmdirSync(mountPoint); } catch { /* 存在しなければ無視 */ }
    return;
  }

  execSync(`fusermount -u -z "${mountPoint}"`, { stdio: 'pipe' });
  try { rmdirSync(mountPoint); } catch { /* cleanup best-effort */ }
}

/**
 * gocryptfsの暗号化ディレクトリを完全に破棄する
 * アカウント削除時に使用
 * 処理順: アンマウント → 暗号化ディレクトリ削除 → マウントポイント削除
 */
export function destroyEncryptedDir(userId: string): void {
  const cipherDir = path.join(DATA_DIR, userId);
  const mountPoint = path.join(MOUNT_DIR, userId);

  // 0. uploadマウントがあればアンマウント
  try { unmountUploadDir(userId); } catch { /* best-effort */ }

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
