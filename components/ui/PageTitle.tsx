import type { ReactNode } from 'react';

/** A page's heading and optional one-line description. */
export default function PageTitle({ title, subtitle, icon }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode }) {
  return (
    <div>
      <h1 className={`text-xl font-bold text-slate-800 ${icon ? 'flex items-center gap-2' : ''}`}>{icon}{title}</h1>
      {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
