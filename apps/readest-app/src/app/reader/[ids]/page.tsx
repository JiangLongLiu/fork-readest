import Reader from '../components/Reader';

export default async function Page({ params }: { params: Promise<{ ids: string }> }) {
  const ids = decodeURIComponent((await params).ids);
  return <Reader ids={ids} />;
}
