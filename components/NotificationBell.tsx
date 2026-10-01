'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Baby, Bell, Flame, Milk, Package, Pill, Stethoscope, Syringe, Weight, X } from 'lucide-react';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import { breedingSummaryQuery, farmDashboardQuery } from '@/lib/farmQueries';
import { animalLabel, DaysLeft } from '@/components/breeding/shared';
import { fmtDate, fmtNum } from '@/lib/format';
import type { BreedingUpcomingRow } from '@/types';

type Item = { key: string; icon: ReactNode; tone: string; text: string; detail?: ReactNode; href: string };
type Group = { key: string; title: string; items: Item[] };

/**
 * The header bell: what needs attention on the farm right now — low feed and
 * medicine stock, medicine about to expire, weight checks, vaccines due and
 * breeding dates. Read from the same data as the dashboard (no extra request
 * when the dashboard is open), filtered by what the user may see.
 */
export default function NotificationBell() {
  const { t } = useTranslation('layout');
  const { t: tc } = useTranslation('common');
  const { t: td } = useTranslation('dashboard');
  const { t: tb } = useTranslation('breeding');
  const { hasPermission, hasRole } = useAuth();
  const can = (perm: string) => hasRole('Super Admin') || hasPermission(perm);
  const showStock = can('dashboard-sections.alerts');
  const showVaccines = can('dashboard-sections.vaccines');
  const showBreeding = can('farm.breeding.view');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: dash } = useQuery({ ...farmDashboardQuery, enabled: showStock || showVaccines });
  const { data: breeding } = useQuery({ ...breedingSummaryQuery(), enabled: showBreeding });

  // Closes on a tap outside, on Esc, and when a link inside leads to another page.
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) { setSeenPath(pathname); setOpen(false); }
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchstart', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('touchstart', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const groups: Group[] = [];
  if (dash && showStock) {
    const a = dash.alerts;
    const items: Item[] = [];
    if (a.weight_check_due > 0) {
      items.push({ key: 'weight', icon: <Weight size={15} />, tone: 'bg-amber-50 text-amber-600', text: td('alert.weight_check', { count: a.weight_check_due }), href: '/farm/cattle' });
    }
    for (const f of a.low_feed_stock) {
      items.push({ key: `feed-${f.id}`, icon: <Package size={15} />, tone: 'bg-red-50 text-red-500', text: td('alert.low_feed', { name: f.name }), href: '/farm/feed' });
    }
    for (const m of a.low_medicine_stock) {
      items.push({ key: `med-${m.id}`, icon: <Pill size={15} />, tone: 'bg-red-50 text-red-500', text: td('alert.low_medicine', { name: m.name, qty: m.remaining_quantity, unit: m.unit?.symbol }), href: '/farm/medicine/inventory' });
    }
    for (const m of a.expiring_medicines) {
      items.push({ key: `exp-${m.id}`, icon: <AlertTriangle size={15} />, tone: 'bg-amber-50 text-amber-600', text: td('alert.expiring', { name: m.name, date: fmtDate(m.expiry_date) }), href: '/farm/medicine/batches' });
    }
    if (items.length) groups.push({ key: 'stock', title: td('section.alerts'), items });
  }
  if (dash && showVaccines && dash.alerts.upcoming_vaccines.length) {
    groups.push({
      key: 'vaccines', title: td('section.upcoming_vaccines'),
      items: dash.alerts.upcoming_vaccines.map(v => ({
        key: `vac-${v.id}`, icon: <Syringe size={15} />, tone: 'bg-sky-50 text-sky-600',
        text: `${v.cattle?.tag_number ?? ''} — ${v.vaccine_name}`, detail: fmtDate(v.scheduled_date), href: '/farm/health/vaccines',
      })),
    });
  }
  if (breeding && showBreeding) {
    const lists: [string, BreedingUpcomingRow[], ReactNode, string][] = [
      ['deliveries', breeding.upcoming.deliveries, <Baby key="i" size={15} />, 'overview.upcoming_deliveries'],
      ['checks', breeding.upcoming.pregnancy_checks, <Stethoscope key="i" size={15} />, 'overview.checks_due'],
      ['heats', breeding.upcoming.heats, <Flame key="i" size={15} />, 'overview.expected_heats'],
      ['dry', breeding.upcoming.dry_off, <Milk key="i" size={15} />, 'overview.dry_off'],
    ];
    for (const [key, rows, icon, title] of lists) {
      if (!rows.length) continue;
      groups.push({
        key, title: tb(title),
        items: rows.map((r, i) => ({
          key: `${key}-${r.female.id}-${i}`, icon, tone: 'bg-violet-50 text-violet-600',
          text: animalLabel(r.female), detail: <>{fmtDate(r.date)} · <DaysLeft days={r.days_left} /></>, href: `/farm/cattle/${r.female.id}`,
        })),
      });
    }
  }

  const count = groups.reduce((n, g) => n + g.items.length, 0);
  const label = count ? `${tc('ui.notifications')} (${fmtNum(count)})` : tc('ui.notifications');

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={label} title={label}
        aria-haspopup="dialog" aria-expanded={open}
        className="relative grid place-items-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
        <Bell size={17} />
        {count > 0 && (
          <span aria-hidden="true" className="absolute -top-1.5 -end-1.5 grid place-items-center min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none ring-2 ring-white">
            {count > 9 ? `${fmtNum(9)}+` : fmtNum(count)}
          </span>
        )}
      </button>

      {open && (
        // Phones: a full-width panel under the header. Larger screens: a dropdown.
        <div role="dialog" aria-label={t('notifications.title')}
          className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] sm:absolute sm:inset-x-auto sm:top-full sm:end-0 sm:mt-2 sm:w-96 z-50 flex flex-col max-h-[70dvh] rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">{t('notifications.title')}</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label={tc('ui.close')}
              className="grid place-items-center w-9 h-9 -me-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-2">
            {count === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">{td('alert.no_alerts')}</p>
            ) : groups.map(g => (
              <section key={g.key} className="mb-1 last:mb-0">
                <h3 className="px-2 pt-2 pb-1 text-xs font-semibold text-slate-500">{g.title}</h3>
                <ul>
                  {g.items.map(item => (
                    <li key={item.key}>
                      <Link href={item.href} onClick={() => setOpen(false)}
                        className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50">
                        <span className={`grid place-items-center w-8 h-8 shrink-0 rounded-lg ${item.tone}`}>{item.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-slate-700 break-words">{item.text}</span>
                          {item.detail && <span className="block text-xs text-slate-400 mt-0.5">{item.detail}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <Link href="/dashboard" onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-medium text-blue-600 hover:bg-slate-50 rounded-b-2xl">
            {t('notifications.open_dashboard')}
          </Link>
        </div>
      )}
    </div>
  );
}
