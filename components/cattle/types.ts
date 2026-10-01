export type MedItem = { id: number; name: string; remaining_quantity: number; fifo_unit_price?: number; unit?: { symbol: string } };

export type LineItem = { key: string; medicine_id: string; qty_mode: 'per_animal' | 'total_split'; qty_value: string; next_due_date?: string };

export const newLine = (): LineItem => ({ key: Math.random().toString(36).slice(2), medicine_id: '', qty_mode: 'per_animal', qty_value: '', next_due_date: '' });

export type TreatHealthStatus = 'sick' | 'critical' | 'recovering' | 'healthy';

export type PerCattleData = { diagnosis: string; treatment: string; health_status: TreatHealthStatus; follow_up_date: string; prescription: string };

export const DEFAULT_PER_CATTLE: PerCattleData = { diagnosis: '', treatment: '', health_status: 'sick', follow_up_date: '', prescription: '' };

export type SaleInvoiceData = {
  sales: { id: number; sale_price: string; paid_amount: string; due_amount: string; sale_weight: string | null; payment_status: string; cattle: { tag_number: string; name: string | null } }[];
  customer: { id: number; name: string; phone: string | null; is_new?: boolean };
  total_revenue: number; total_paid: number; total_due: number; sold_count: number;
};
