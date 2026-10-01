'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { ByproductSheetRow, ByproductUnit, Shed } from '@/types';
import { apiError, todayStr } from '@/components/breeding/shared';
import { useByproducts } from '@/components/byproducts/shared';
import NumericInput from '@/components/ui/NumericInput';
import { fmtDate, fmtNum } from '@/lib/format';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';

type SheetResponse = {
  date: string;
  byproduct: { id: number; name: string; unit: ByproductUnit | null };
  rows: ByproductSheetRow[];
  total: number;
};

const fromRows = (rows: ByproductSheetRow[]): Record<number, string> =>
  Object.fromEntries(rows.map(r => [r.cattle_id, r.quantity !== null ? String(r.quantity) : '']));

/**
 * The editable table for one product + date. Keyed by the parent so it starts
 * fresh per sheet; a refetch of the same sheet only refreshes the boxes nobody
 * has typed in, so typing survives a background refetch.
 */
function ProductionTable({ sheet, canEdit, onStateChange }: {
  sheet: SheetResponse;
  canEdit: boolean;
  onStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
}) {
  const { t } = useTranslation('byproducts');
  const qc = useQueryClient();
  const toast = useToast();
  // What the server holds per animal (or what was just saved); a box that differs holds unsaved typing.
  const [base, setBase] = useState(() => fromRows(sheet.rows));
  const [entries, setEntries] = useState<Record<number, string>>(base);
  const [fillValue, setFillValue] = useState('');
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const unit = sheet.byproduct.unit?.symbol ?? '';

  // Fresh data for this sheet: untouched boxes take the server's value, typed ones are kept.
  const [synced, setSynced] = useState(sheet);
  if (sheet !== synced) {
    setSynced(sheet);
    const fresh = fromRows(sheet.rows);
    setEntries(Object.fromEntries(sheet.rows.map(r => {
      const id = r.cattle_id;
      return [id, entries[id] === undefined || entries[id] === base[id] ? fresh[id] : entries[id]];
    })));
    setBase(fresh);
  }

  const total = Object.values(entries).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const dirty = sheet.rows.some(r => (entries[r.cattle_id] ?? '') !== (base[r.cattle_id] ?? ''));

  // Sends the values as they were when Save was pressed.
  const save = useMutation({
    mutationFn: (values: Record<number, string>) => api.post(`/farm/byproducts/${sheet.byproduct.id}/sheet`, {
      date: sheet.date,
      entries: sheet.rows.map(r => ({ cattle_id: r.cattle_id, quantity: (values[r.cattle_id] ?? '') === '' ? null : parseFloat(values[r.cattle_id]) })),
    }),
    onSuccess: (res, values) => {
      // Saved values are no longer unsaved; the refetch below brings the server's copy.
      setBase(b => ({ ...b, ...values }));
      toast.success(res?.data?.message ?? t('toast.saved'));
      invalidateMoney(qc, [['byproducts'], ['cattle-byproduct-history'], ['cattle-ledger']]);
      setError('');
    },
    onError: e => setError(apiError(e, t('toast.failed')).message),
  });

  const saving = save.isPending;
  useEffect(() => { onStateChange?.({ dirty, saving }); }, [dirty, saving, onStateChange]);
  // Save sits at the bottom of a long list; bring its error into view.
  useEffect(() => { if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [error]);

  if (sheet.rows.length === 0) {
    return <p className="bg-white rounded-xl border border-slate-200 px-4 py-10 text-center text-sm text-slate-400">{t('hint.no_animals')}</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p ref={errorRef} role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <NumericInput min="0" step="0.1" value={fillValue} onChange={e => setFillValue(e.target.value)} placeholder={unit} aria-label={t('btn.fill_same')}
            className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="button" disabled={!fillValue}
            onClick={() => setEntries(p => Object.fromEntries(Object.entries(p).map(([id, v]) => [id, v === '' ? fillValue : v])))}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50">{t('btn.fill_same')}</button>
          <span className="text-xs text-slate-400">{t('hint.empty_removes')}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-start text-slate-600">
              <th className="px-3 sm:px-4 py-3 font-medium">{t('col.animal')}</th>
              <th className="px-3 sm:px-4 py-3 font-medium w-32 sm:w-40">{t('col.quantity')} ({unit})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sheet.rows.map(r => (
              <tr key={r.cattle_id}>
                <td className="px-3 sm:px-4 py-2.5 break-words">
                  <Link href={`/farm/cattle/${r.cattle_id}`} className="font-medium text-slate-800 hover:text-blue-600">{r.tag_number}{r.name ? ` — ${r.name}` : ''}</Link>
                  <p className="text-xs text-slate-400">
                    {[r.shed, r.last_date ? t('hint.last_date', { date: fmtDate(r.last_date) }) : null].filter(Boolean).join(' · ')}
                  </p>
                </td>
                <td className="px-3 sm:px-4 py-2.5">
                  <NumericInput min="0" step="0.1" inputMode="decimal" value={entries[r.cattle_id] ?? ''} disabled={!canEdit}
                    aria-label={`${r.tag_number} ${t('col.quantity')}`}
                    onChange={ev => setEntries(p => ({ ...p, [r.cattle_id]: ev.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-700">
              <td className="px-3 sm:px-4 py-3">{t('total')} ({fmtNum(sheet.rows.length)})</td>
              <td className="px-3 sm:px-4 py-3">{fmtNum(total, 2)} {unit}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phones: the save bar stays in reach at the bottom of the screen. */}
      {canEdit && (
        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <button onClick={() => save.mutate(entries)} disabled={saving}
            className="flex w-full sm:w-auto items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg disabled:opacity-60">
            <Save size={15} /> {saving ? '…' : t('btn.save')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ByproductRecordsPage() {
  const { t } = useTranslation('byproducts');
  const { hasPermission } = useAuth();
  const { active, isLoading: productsLoading } = useByproducts();
  const perAnimal = active.filter(p => p.tracking === 'per_animal');
  const [productId, setProductId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [shedId, setShedId] = useState('');
  // Typed amounts survive refetches; another product/date/shed asks before dropping them.
  const { onStateChange, guard, dialog } = useUnsavedGuard();

  const selectedId = productId || (perAnimal[0] ? String(perAnimal[0].id) : '');
  const product = perAnimal.find(p => String(p.id) === selectedId);

  const { data: sheds } = useQuery({
    queryKey: ['sheds-all'],
    queryFn: async () => (await api.get('/farm/sheds/all')).data.sheds as Shed[],
  });

  const { data: sheet, isLoading } = useQuery<SheetResponse>({
    queryKey: ['byproducts', 'sheet', selectedId, date, shedId],
    queryFn: async () => (await api.get(`/farm/byproducts/${selectedId}/sheet`, { params: { date, shed_id: shedId || undefined } })).data,
    enabled: !!selectedId,
  });

  if (!productsLoading && perAnimal.length === 0) {
    return (
      <p className="bg-white rounded-xl border border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
        {t('hint.no_per_animal')}{' '}
        <Link href="/farm/byproducts/settings" className="text-blue-600 hover:underline">{t('btn.add_product')}</Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('field.product')}</label>
          <div className="flex flex-wrap rounded-lg border border-slate-300 overflow-hidden">
            {perAnimal.map(p => (
              <button key={p.id} type="button" onClick={() => selectedId !== String(p.id) && guard(() => setProductId(String(p.id)))}
                className={`px-3 py-2 text-sm font-medium ${selectedId === String(p.id) ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('field.date')}</label>
          <input type="date" value={date} max={todayStr()} onChange={e => { const v = e.target.value; guard(() => setDate(v)); }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('field.shed')}</label>
          <select value={shedId} onChange={e => { const v = e.target.value; guard(() => setShedId(v)); }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">{t('field.all_sheds')}</option>
            {(sheds ?? []).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {product && (product.animal_types ?? []).length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          {t('hint.no_species')}{' '}
          <Link href="/farm/byproducts/settings" className="underline">{t('btn.edit')}</Link>
        </p>
      )}

      {isLoading || !sheet
        ? <div className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
        : <ProductionTable key={`${selectedId}-${date}-${shedId}`} sheet={sheet} canEdit={hasPermission('farm.byproducts.create')} onStateChange={onStateChange} />}
      {dialog}
    </div>
  );
}
