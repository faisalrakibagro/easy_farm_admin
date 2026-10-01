'use client';
import dynamic from 'next/dynamic';
const SupplierDetailPage = dynamic(() => import('./_client'), { ssr: false });
export default function SupplierLoader() {
  return <SupplierDetailPage />;
}
