import ShareViewerClient from './ShareViewerClient';

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <ShareViewerClient token={token} />;
}
