'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, Building2, Smartphone } from 'lucide-react';

/** Icon and colour of each payment account type (cash / bank / mobile banking). */
export const PAYMENT_ACCOUNT_TYPE: Record<string, { icon: ReactNode; color: string }> = {
  cash: { icon: <Banknote size={16} />,   color: 'bg-green-100 text-green-700' },
  bank: { icon: <Building2 size={16} />,  color: 'bg-blue-100 text-blue-700' },
  mfs:  { icon: <Smartphone size={16} />, color: 'bg-purple-100 text-purple-700' },
};

/** The type's icon followed by its name in the current language. */
export function PaymentAccountTypeLabel({ type }: { type: string }) {
  const { t } = useTranslation('finance');
  return <>{PAYMENT_ACCOUNT_TYPE[type]?.icon} {t(`payment_accounts.types.${type}`, { defaultValue: type })}</>;
}
