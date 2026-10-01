import { localDateStr } from '@/lib/dates';
export interface EmployeeOption { id: number; name: string; employee_code: string; monthly_salary: string; }
export interface DailyLabourOption { id: number; name: string; work_date: string; daily_wage: string; working_hours: string | number; }

/** LOCKED (2026-06-22): salary/labour categories — do not remove/reorder without updating CLAUDE.md. */
export const CATEGORIES = ['electricity', 'water', 'fuel', 'transport', 'maintenance', 'rent', 'miscellaneous', 'salary', 'labour'];

export const CATEGORY_COLORS: Record<string, string> = {
  electricity: 'bg-yellow-100 text-yellow-700',
  water: 'bg-blue-100 text-blue-700',
  fuel: 'bg-orange-100 text-orange-700',
  transport: 'bg-green-100 text-green-700',
  maintenance: 'bg-purple-100 text-purple-700',
  rent: 'bg-red-100 text-red-700',
  miscellaneous: 'bg-slate-100 text-slate-600',
  salary: 'bg-indigo-100 text-indigo-700',
  labour: 'bg-teal-100 text-teal-700',
};

export interface ExpForm {
  category: string;
  title: string;
  amount: string;
  expense_date: string;
  allocation_method: string;
  is_recurring: boolean;
  payment_account_id: string;
  description: string;
  labour_employee_id: string;
  daily_labour_id: string;
  payment_status: string;
  paid_amount: string;
  /** Filled by "Fill from receipt photo"; sent with the expense. */
  vendor_name: string;
  invoice_no: string;
  receipt_file: string;
}

export const DEFAULT: ExpForm = {
  category: 'electricity',
  title: '',
  amount: '',
  expense_date: localDateStr(),
  allocation_method: 'equal',
  is_recurring: true,   // the default category (electricity) is a monthly bill
  payment_account_id: '',
  description: '',
  labour_employee_id: '',
  daily_labour_id: '',
  payment_status: 'paid',
  paid_amount: '',
  vendor_name: '',
  invoice_no: '',
  receipt_file: '',
};

export interface EditExpForm {
  category: string;
  title: string;
  amount: string;
  expense_date: string;
  payment_account_id: string;
  description: string;
  allocation_method: string;
  is_recurring: boolean;
  payment_status: string;
  paid_amount: string;
}

export const inputClass = (err?: string) =>
  `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${err ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'}`;
