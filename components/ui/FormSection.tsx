import type { ReactNode } from 'react';

/** A titled part of a long form, so it reads in steps instead of one wall of fields. */
export default function FormSection({ title, hint, icon, children, className = '' }: {
  title: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {hint && <span className="text-xs text-slate-400 truncate">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
