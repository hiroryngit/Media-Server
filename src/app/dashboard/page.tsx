// src/app/dashboard/page.tsx
import Header from '@/app/components/Header/Header';

export default function Dashboard() {
  return (
    <>
      <Header />
      <main style={{ padding: "2rem" }}>
        <h1>ダッシュボード</h1>
        <p>ログインに成功しました！ここは保護されたページです（仮）。</p>
      </main>
    </>
  );
}