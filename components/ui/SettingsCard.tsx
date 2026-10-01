/** A settings section: icon, title, optional hint and a header action, then its body. */
export default function SettingsCard({ title, icon: Icon, hint, children, action }: {
  title: string; icon: React.ElementType; hint?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 shrink-0"><Icon size={16} /></span>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
            {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
