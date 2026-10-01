'use client';
import dynamic from 'next/dynamic';
const CustomerDetailPage = dynamic(() => import('./_client'), { ssr: false });
export default function CustomerLoader() {
  return <CustomerDetailPage />;
}
