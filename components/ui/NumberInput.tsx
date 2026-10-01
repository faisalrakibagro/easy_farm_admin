'use client';

import type { ReactNode } from 'react';
import LocalizedNumberInput from '@/components/LocalizedNumberInput';
import { frameClass } from '@/lib/formStyles';

type Props = Omit<React.ComponentProps<typeof LocalizedNumberInput>, 'className'> & {
  /** Shown before the number, e.g. ৳. */
  prefix?: ReactNode;
  /** Shown after the number, e.g. কেজি. */
  suffix?: ReactNode;
  error?: string | boolean | null;
  className?: string;
};

/**
 * A number box that takes Bengali or Arabic digits too (they are turned into
 * 0-9 as they are typed, so what is saved is always a plain number) and shows
 * its unit beside it. Opens the number keypad on phones.
 */
export default function NumberInput({ prefix, suffix, error, className = 'w-full', disabled, ...props }: Props) {
  const adorn = 'grid place-items-center px-3 text-sm text-slate-500 bg-slate-50 select-none shrink-0';

  return (
    <div className={`${frameClass(error, className)} ${disabled ? 'bg-slate-50' : ''} overflow-hidden`}>
      {prefix !== undefined && <span className={`${adorn} border-e border-slate-200`}>{prefix}</span>}
      <LocalizedNumberInput
        {...props}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        style={{ outline: 'none' }}
        className="flex-1 min-w-0 bg-transparent px-3 py-2.5 sm:py-2 text-base sm:text-sm text-slate-800 placeholder:text-slate-400 disabled:text-slate-500"
      />
      {suffix !== undefined && <span className={`${adorn} border-s border-slate-200`}>{suffix}</span>}
    </div>
  );
}
