'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import type { ByproductHistory } from '@/types';
import { money } from '@/components/breeding/shared';
import { qtyLabel } from '@/components/byproducts/shared';
import { fmtDate } from '@/lib/format';

/** One animal's per-animal by-products (wool …): what it gave and the income it earned. */
export default function ByproductTab({ cattleId }: { cattleId: number }) {
  const { t } = useTranslation('byproducts');

  const { data, isLoading } = useQuery<ByproductHistory>({
    queryKey: ['cattle-byproduct-history', cattleId],
    queryFn: async () => (await api.get(`/farm/cattle/${cattleId}/byproduct-history`)).data,
  });

  if (isLoading || !data) return <div className="bg-white rounded-xl border border-slate-200 p-5 h-40 animate-pulse" />;

  return (
    <div className="space-y-4">
      {data.products.map(p => (
        <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-800">{p.name}</h3>
            <Link href="/farm/byproducts/records" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              <ClipboardList size={13} /> {t('btn.enter_records')}
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-slate-400">{t('history.total')}</p><p className="font-semibold text-slate-800">{qtyLabel(p.total_quantity, p.unit)}</p></div>
            <div><p className="text-xs text-slate-400">{t('history.income')}</p><p className="font-semibold text-green-700">{money(p.income)}</p></div>
            <div><p className="text-xs text-slate-400">{t('history.per_unit')}</p><p className="font-semibold text-slate-800">{p.income_per_unit !== null ? money(p.income_per_unit) : '—'}</p></div>
          </div>
          {p.records.length === 0 ? <p className="text-sm text-slate-400">{t('history.none')}</p> : (
            <ul className="divide-y divide-slate-50 text-sm">
              {p.records.map(r => (
                <li key={r.id} className="py-1.5 flex items-center gap-3">
                  <span className="text-slate-600 w-24">{fmtDate(r.date)}</span>
                  <span className="flex-1 text-xs text-slate-400 truncate">{r.notes}</span>
                  <span className="font-medium text-slate-800">{qtyLabel(r.quantity, p.unit)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
