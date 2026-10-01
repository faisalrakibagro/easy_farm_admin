import type { ReactNode } from 'react';

/** Small rounded pill. `tone` is the Tailwind bg/text pair; neutral grey by default. */
export default function Badge({ tone, className = '', children }: { tone?: string; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tone ?? 'bg-slate-100 text-slate-600'} ${className}`}>
      {children}
    </span>
  );
}
