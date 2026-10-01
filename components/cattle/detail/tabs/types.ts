import type { Cattle } from '@/types';

export type MedUsage = { id: number; medicine_id: number; usage_date: string; next_due_date: string | null; quantity_used: string; unit: string; total_cost: string; notes: string | null; medicine?: { name: string } };
export type SaleRecord = { id: number; sale_date: string; buyer_name: string; sale_price: string; total_cost: string; profit_loss: string; notes: string | null };
export type CattleDetail = Cattle & { sale?: SaleRecord | null; shed?: { name: string } | null };

export const ENTRY_TYPE_COLOR: Record<string, string> = {
  purchase:  'bg-purple-50 text-purple-700',
  feed:      'bg-amber-50 text-amber-700',
  medicine:  'bg-blue-50 text-blue-700',
  vaccine:   'bg-cyan-50 text-cyan-700',
  treatment: 'bg-orange-50 text-orange-700',
  labour:    'bg-slate-100 text-slate-600',
  expense:   'bg-pink-50 text-pink-700',
  sale:      'bg-green-50 text-green-700',
};

export const VACCINE_STATUS_COLOR: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  completed: 'bg-green-50 text-green-700',
  overdue:   'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export const AGE_CATEGORY_COLORS: Record<string, string> = {
  immature: 'bg-cyan-100 text-cyan-700',
  adult:    'bg-amber-100 text-amber-700',
};
