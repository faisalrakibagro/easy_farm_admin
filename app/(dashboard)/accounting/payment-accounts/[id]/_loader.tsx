'use client';
import dynamic from 'next/dynamic';
const PaymentAccountLedgerPage = dynamic(() => import('./_client'), { ssr: false });
export default function PaymentAccountLoader() {
  return <PaymentAccountLedgerPage />;
}
