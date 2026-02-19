# gocryptfs によるユーザーコンテンツ暗号化

## Context
現在、アップロードファイルは `public/uploads/{userId}/` に平文で保存され、Next.js の静的ファイル配信で認証なしにアクセス可能。これをgocryptfsで暗号化し、ログイン中のユーザーのみファイルにアクセスできるようにする。

**方針**: ユーザーごとにgocryptfsディレクトリを作成。ログイン時にマウント、ログアウト時にアンマウント。パスワードはDBに保存されたbcryptハッシュを使用。

## ディレクトリ構造

```
data/
├── encrypted/{userId}/    ← gocryptfs cipher dir (暗号化ファイル)
└── decrypted/{userId}/    ← FUSE mount point (マウント時のみ平文アクセス可能)
```

`public/uploads/` は使わなくなる。ファイルは `data/` 配下に移動。

## 変更ファイル一覧

### 1. gocryptfs ユーティリティ — `src/app/lib/gocryptfs.ts`（新規）
- `initEncryptedDir(userId, password)` — `gocryptfs -init` で暗号化ディレクトリ初期化
- `mount(userId, password)` — マウント（既にマウント済みならスキップ）
- `unmount(userId)` — `fusermount -u` でアンマウント
- `isMounted(userId)` — マウント状態チェック（`/proc/mounts` or `mountpoint` コマンド）
- `getDecryptedPath(userId)` — マウントポイントのパスを返す
- すべて `child_process.execFile` でgocryptfsコマンドを実行、パスワードはstdinで渡す

### 2. ユーザー登録修正 — `src/app/signup/actions.ts`
- ユーザー作成後、`initEncryptedDir(user.id, hashedPassword)` を呼び出して暗号化ディレクトリを初期化

### 3. ログイン修正 — `src/app/actions.ts`
- ログイン成功後、`mount(user.id, user.password)` でマウント（user.passwordはDBのハッシュ値）

### 4. ログアウト修正 — `src/app/actions/logout.ts`
- cookieからsession_idを取得してから削除
- `unmount(userId)` でアンマウント

### 5. ファイル配信API — `src/app/api/media/[id]/route.ts`（新規）
- `GET` ハンドラ: cookie認証 → Media ID でDB検索 → userId一致確認
- マウント済みチェック → `data/decrypted/{userId}/` からファイルを読み取り
- 適切な Content-Type ヘッダー付きでストリーミングレスポンス
- マウントされていない場合は403エラー

### 6. アップロード修正 — `src/app/api/upload/route.ts`
- 保存先を `public/uploads/{userId}/` → `data/decrypted/{userId}/` に変更
- DBのpathを `/uploads/{userId}/filename` → media ID ベースの `/api/media/{mediaId}` に変更
  - または path フィールドにファイル名だけ保存し、表示時にAPI URLを組み立て

### 7. 削除修正 — `src/app/api/delete/route.ts`
- ファイルパスを `public/` → `data/decrypted/{userId}/` に変更

### 8. ダッシュボード修正 — `src/app/dashboard/page.tsx`
- `<img src={media.path}>` → `<img src={/api/media/${media.id}}>` に変更

### 9. 削除ページ修正 — `src/app/delete/DeleteClient.tsx`
- 同様にメディアURLをAPI経由に変更

### 10. .gitignore 追加
- `/data/` を追加

## DB変更
Media の `path` フィールドの保存内容を変更する（`/uploads/userId/file` → ファイル名のみ）。既存データのマイグレーションは手動対応。

## セキュリティ上のポイント
- `data/encrypted/` は常に暗号化されており、ディレクトリトラバーサルで到達しても読めない
- `data/decrypted/{userId}/` はログイン中のみマウントされるため、ログアウト後はアクセス不可
- API経由でのみファイルにアクセスでき、userId一致チェックで他人のファイルは取得不可
- サーバー再起動時にはすべてアンマウントされるが、次回ログイン時に自動で再マウント

## 検証方法
1. ユーザー新規登録 → `data/encrypted/{userId}/` に `gocryptfs.conf` が作成される
2. ログイン → `data/decrypted/{userId}/` がマウントされる（`mount` コマンドで確認）
3. ファイルアップロード → `data/decrypted/{userId}/` にファイルが書かれる
4. ダッシュボードで画像/動画が表示される（`/api/media/{id}` 経由）
5. ログアウト → アンマウントされる（`mount` コマンドで確認）
6. ログアウト状態で `/api/media/{id}` にアクセス → 401エラー
7. `data/encrypted/{userId}/` 内のファイルが暗号化されていることを確認
