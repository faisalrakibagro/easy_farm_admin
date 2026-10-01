'use client';
import dynamic from 'next/dynamic';
const SalaryHistoryPage = dynamic(() => import('./_client'), { ssr: false });
export default function SalaryHistoryLoader() {
  return <SalaryHistoryPage />;
}
