'use client';

import type { ReactNode } from 'react';
import { Store } from 'lucide-react';

const TONES = {
  slate: 'bg-white border-slate-200 text-slate-700',
  green: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  orange: 'bg-orange-50 border-orange-100 text-orange-600',
  red: 'bg-red-50 border-red-100 text-red-600',
  blue: 'bg-sky-50 border-sky-100 text-sky-700',
} as const;

const LG_COLS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' };

/** The count / value cards above a batch stock list (two per row on phones). */
export function BatchStatCards({ items }: { items: { label: string; value: ReactNode; tone?: keyof typeof TONES }[] }) {
  // An odd card out on phones takes the full row instead of leaving a hole.
  const odd = items.length % 2 === 1;
  return (
    <div className={`grid grid-cols-2 ${LG_COLS[items.length] ?? 'lg:grid-cols-4'} gap-3`}>
      {items.map((item, i) => (
        <div key={item.label} className={`@container min-w-0 rounded-xl border p-3 sm:p-4 ${TONES[item.tone ?? 'slate']} ${odd && i === items.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}>
          <p className="text-xs text-slate-500 mb-1">{item.label}</p>
          <p className="amount-fit font-bold [--amount-max:1.25rem]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

/** Where a batch came from: the supplier's name with the invoice under it, or another source. */
export function BatchSource({ name, invoice, fallback }: { name?: string | null; invoice?: string | null; fallback?: string }) {
  if (!name) return <span className="text-slate-500">{fallback ?? '—'}</span>;
  return (
    <span className="inline-flex flex-col items-end sm:items-start min-w-0">
      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 break-words">
        <Store size={13} className="text-slate-400 shrink-0" />{name}
      </span>
      {invoice && <span className="text-xs text-slate-400">{invoice}</span>}
    </span>
  );
}

/** The filter a batch stock page opens with, e.g. ?medicine_id=8 from the overview. */
export function initialParam(name: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) ?? '';
}
