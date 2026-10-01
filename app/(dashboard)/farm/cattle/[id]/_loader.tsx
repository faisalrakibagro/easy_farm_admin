'use client';
import dynamic from 'next/dynamic';
const CattleDetailPage = dynamic(() => import('./_client'), { ssr: false });
export default function CattleLoader() {
  return <CattleDetailPage />;
}
