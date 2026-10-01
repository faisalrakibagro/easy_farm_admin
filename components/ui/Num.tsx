'use client';

import { useTranslation } from 'react-i18next';
import { fmtMoney, fmtNum } from '@/lib/format';

type Numeric = number | string | null | undefined;

/**
 * A number in the interface language's digits. Re-renders when the language
 * changes. `decimals` fixes the digits after the point.
 */
export function Num({ value, decimals, className }: { value: Numeric; decimals?: number; className?: string }) {
  useTranslation();
  return <span className={className}>{fmtNum(value, decimals)}</span>;
}

/** An amount of money: ৳ and two decimals, in the interface language's digits. */
export function Money({ value, className }: { value: Numeric; className?: string }) {
  useTranslation();
  return <span className={className}>{fmtMoney(value)}</span>;
}
