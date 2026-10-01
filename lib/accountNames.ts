/** Any i18next `t` (or a component's `t` prop). */
type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** The English names the system accounts are created with, by code. */
const SYSTEM_DEFAULTS: Record<string, string> = {
  '4001': 'Cattle Sales Revenue',
  '4002': 'Milk Sales Revenue',
  '4003': 'By-product Sales Revenue',
  '5001': 'Feed Purchase Expense',
  '5002': 'Medicine Purchase',
  '5003': 'Daily Labour',
  '5004': 'Salary Expense',
  '5005': 'Cattle Purchase',
  '5006': 'Veterinary / Treatment',
  '5007': 'General Expense',
  '5008': 'Supplier Payment',
  '5009': 'Breeding / AI Expense',
};

/**
 * A chart-of-accounts name for display. A system account still carrying its
 * default English name is shown in the current language; a name someone typed
 * (or renamed) is shown as it is.
 */
export function accountName(a: { code?: string | null; name: string }, t: Translate): string {
  if (a.code && SYSTEM_DEFAULTS[a.code] === a.name) {
    return t(`system_accounts.${a.code}`, { ns: 'finance', defaultValue: a.name });
  }
  return a.name;
}
