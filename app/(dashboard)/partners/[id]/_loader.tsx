'use client';
import dynamic from 'next/dynamic';
const PartnerDetailPage = dynamic(() => import('./_client'), { ssr: false });
export default function PartnerLoader() {
  return <PartnerDetailPage />;
}
