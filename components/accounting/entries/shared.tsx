import { localDateStr } from '@/lib/dates';
import {
  Banknote, Building2, Smartphone, TrendingUp, TrendingDown,
  ArrowLeftRight, Store, Handshake, Scale,
  ShoppingCart, Receipt, Wheat, Syringe, HardHat, Stethoscope,
} from 'lucide-react';
import { fmtMoney } from '@/lib/format';

export interface LedgerRow {
  sort_key: string;
  date: string;
  voucher_type: string;
  description: string;
  account: string;
  payment_via: string | null;
  debit: number;
  credit: number;
  balance: number;
  ref_type: string;
  ref_id: number;
}

export interface LedgerResponse {
  data: LedgerRow[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  totals: { debit: number; credit: number; balance: number };
}

export interface Account { id: number; code: string; name: string; type: 'income' | 'expense'; }

export interface ManualEntry {
  id: number;
  account_id: number;
  amount: string;
  entry_date: string;
  description: string;
  source_type: 'revenue' | 'investment' | null;
  payment_account_id: number | null;
  created_at: string;
}

export interface ManualEntriesResponse {
  data: ManualEntry[];
  total: number;
  current_page: number;
  last_page: number;
}

export const fmt = (n: number) => fmtMoney(Math.abs(n));

export const VOUCHER_STYLES: Record<string, string> = {
  receipt:           'bg-green-100 text-green-700',
  payment:           'bg-red-100 text-red-700',
  contra:            'bg-blue-100 text-blue-700',
  supplier_payment:  'bg-orange-100 text-orange-700',
  adjustment:        'bg-amber-100 text-amber-700',
  investment:        'bg-purple-100 text-purple-700',
  withdrawal:        'bg-pink-100 text-pink-700',
  profit_share:      'bg-teal-100 text-teal-700',
  cattle_sale:       'bg-emerald-100 text-emerald-700',
  expense:           'bg-rose-100 text-rose-700',
  feed_purchase:     'bg-lime-100 text-lime-700',
  medicine_purchase: 'bg-cyan-100 text-cyan-700',
  daily_labour:      'bg-indigo-100 text-indigo-700',
  treatment:         'bg-red-100 text-red-700',
};

export const VOUCHER_ICON: Record<string, React.ReactNode> = {
  receipt:           <TrendingUp size={11} />,
  payment:           <TrendingDown size={11} />,
  contra:            <ArrowLeftRight size={11} />,
  supplier_payment:  <Store size={11} />,
  adjustment:        <Scale size={11} />,
  investment:        <Handshake size={11} />,
  withdrawal:        <Handshake size={11} />,
  profit_share:      <Handshake size={11} />,
  cattle_sale:       <ShoppingCart size={11} />,
  expense:           <Receipt size={11} />,
  feed_purchase:     <Wheat size={11} />,
  medicine_purchase: <Syringe size={11} />,
  daily_labour:      <HardHat size={11} />,
  treatment:         <Stethoscope size={11} />,
};

export const PA_ICON: Record<string, React.ReactNode> = {
  cash: <Banknote size={12} />,
  bank: <Building2 size={12} />,
  mfs:  <Smartphone size={12} />,
};

const today = localDateStr();

export const ENTRY_DEFAULT = {
  account_id: '',
  amount: '',
  entry_date: today,
  description: '',
  source_type: '',
  payment_account_id: '',
};
