'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Beef, Home, Menu, Milk, Plus, X, Zap, type LucideIcon } from 'lucide-react';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import { QUICK_ACTION_DEFS } from '@/lib/quickActions';
import MilkEntryModal from '@/components/dairy/MilkEntryModal';

type Tab = { key: string; href: string; icon: LucideIcon; active: boolean };

/**
 * The phone's bottom bar, within thumb reach: home, animals, a "+" sheet of
 * the everyday entries (the dashboard's quick actions), daily milk and the
 * full menu. It sits in the layout's column, not over the page, so a page's
 * sticky save bar stays above it. Hidden from md up.
 */
export default function MobileNav({ onMenu }: { onMenu: () => void }) {
  const { t } = useTranslation('layout');
  const { t: td } = useTranslation('dashboard');
  const { t: tc } = useTranslation('common');
  const { hasPermission, hasRole } = useAuth();
  const can = (perm: string) => hasRole('Super Admin') || hasPermission(perm);
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [milkOpen, setMilkOpen] = useState(false);

  // Moving to another page closes the sheet.
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) { setSeenPath(pathname); setSheetOpen(false); }

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  const actions = QUICK_ACTION_DEFS.filter(a => can(a.perm));
  const left: Tab[] = [
    { key: 'home', href: '/dashboard', icon: Home, active: pathname === '/dashboard' },
    ...(can('farm.cattle.view') ? [{ key: 'animals', href: '/farm/cattle', icon: Beef, active: pathname.startsWith('/farm/cattle') }] : []),
  ];
  const right: Tab[] = can('farm.dairy.view')
    ? [{ key: 'milk', href: '/farm/dairy/milk', icon: Milk, active: pathname.startsWith('/farm/dairy') }]
    : [];

  const item = 'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-14 pt-1.5 pb-1 text-[11px] font-medium';
  const tab = ({ key, href, icon: Icon, active }: Tab) => (
    <Link key={key} href={href} aria-current={active ? 'page' : undefined}
      className={`${item} ${active ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'}`}>
      <Icon size={21} strokeWidth={active ? 2.4 : 2} />
      {t(`mobile_nav.${key}`)}
    </Link>
  );

  return (
    <>
      <nav aria-label={t('mobile_nav.label')}
        className="md:hidden shrink-0 flex items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgb(15_23_42/0.12)]">
        {left.map(tab)}
        {actions.length > 0 && (
          <button type="button" onClick={() => setSheetOpen(true)} aria-haspopup="dialog" aria-expanded={sheetOpen}
            className={`${item} text-slate-600`}>
            <span className="grid place-items-center w-11 h-11 -mt-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-[var(--app-bg)]">
              <Plus size={22} strokeWidth={2.6} />
            </span>
            {t('mobile_nav.add')}
          </button>
        )}
        {right.map(tab)}
        <button type="button" onClick={onMenu} className={`${item} text-slate-500 hover:text-slate-800`}>
          <Menu size={21} />
          {t('mobile_nav.menu')}
        </button>
      </nav>

      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={() => setSheetOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label={td('quick_actions.title')}
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Zap size={15} className="text-amber-500" />{td('quick_actions.title')}</h2>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label={tc('ui.close')}
                className="grid place-items-center w-10 h-10 -me-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X size={19} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {actions.map(({ key, href, modal, icon: Icon, tone }) => {
                const inner = (
                  <>
                    <span className={`grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br text-white shadow-lg ${tone}`}>
                      <Icon size={19} />
                    </span>
                    <span className="text-xs font-medium leading-tight text-slate-600">{td(`quick_actions.${key}`)}</span>
                  </>
                );
                const cls = 'flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 active:bg-slate-100 px-2 py-3.5 text-center';
                return modal
                  ? <button key={key} type="button" onClick={() => { setSheetOpen(false); setMilkOpen(true); }} className={cls}>{inner}</button>
                  : <Link key={key} href={href!} onClick={() => setSheetOpen(false)} className={cls}>{inner}</Link>;
              })}
            </div>
          </div>
        </div>
      )}

      {milkOpen && <MilkEntryModal onClose={() => setMilkOpen(false)} />}
    </>
  );
}
