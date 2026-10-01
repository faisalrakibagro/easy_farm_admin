'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Save, MinusCircle, Plus, Pin } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { useToast } from '@/components/ui/Toast';
import NumberInput from '@/components/ui/NumberInput';
import { invalidateMoney } from '@/lib/invalidateGroups';
import { btnPrimary, btnSecondary } from '@/lib/formStyles';
import type { MilkSession, MilkSheetRow } from '@/types';
import { apiError } from '@/components/breeding/shared';
import { fmtDate, fmtNum } from '@/lib/format';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export type SheetResponse = { date: string; session: MilkSession; rows: MilkSheetRow[]; total: number; others?: MilkSheetRow[] };
type Entry = { kg: string; saleable: boolean };

const fromRows = (rows: MilkSheetRow[]): Record<number, Entry> =>
  Object.fromEntries(rows.map(r => [r.cattle_id, { kg: r.quantity_kg !== null ? String(r.quantity_kg) : '', saleable: r.is_saleable }]));
const sameEntry = (a?: Entry, b?: Entry) => !!a && !!b && a.kg === b.kg && a.saleable === b.saleable;

/**
 * The editable milk table for one date + session: the animals in milk that are
 * milked in this session (or already recorded in it). Any other animal in milk
 * can be added for the day, and kept in this session from then on.
 * Keyed by the parent so it starts fresh per sheet (date + session + shed).
 * A refetch of the same sheet only refreshes the boxes nobody has typed in, so
 * typing survives a background refetch. Used by the Daily Milk page and the
 * milk modal on the animal list.
 *
 * Phones get one card per animal with a big kg box; larger screens the table.
 * Kg boxes take Bengali digits too. In a modal, pass `formId` + `hideSave` and
 * put the save button in the modal's footer (`<button form={formId}>`);
 * `onStateChange` reports unsaved changes and saving.
 */
export default function MilkSheetTable({ sheet, canEdit, onSaved, formId, hideSave = false, onStateChange }: {
  sheet: SheetResponse;
  canEdit: boolean;
  onSaved?: () => void;
  formId?: string;
  hideSave?: boolean;
  onStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
}) {
  const { t } = useTranslation('dairy');
  const qc = useQueryClient();
  const toast = useToast();
  // What the server holds per animal (or what was just saved). A box still
  // equal to it is untouched; one that differs holds unsaved typing.
  const [base, setBase] = useState(() => fromRows(sheet.rows));
  const [entries, setEntries] = useState<Record<number, Entry>>(base);
  const [fillValue, setFillValue] = useState('');
  const [error, setError] = useState('');
  // Animals left empty, awaiting "yes, not milked this session".
  const [blanks, setBlanks] = useState<MilkSheetRow[] | null>(null);
  // An animal to stop listing in this session.
  const [dropping, setDropping] = useState<MilkSheetRow | null>(null);
  // Animals added to this sheet for the day ("add another animal").
  const [added, setAdded] = useState<MilkSheetRow[]>([]);
  const [adding, setAdding] = useState('');
  // Sessions changed from this sheet ("always in this session"), by animal.
  const [changed, setChanged] = useState<Record<number, MilkSession[]>>({});
  const noticeRef = useRef<HTMLDivElement>(null);

  // Fresh data for this sheet (after a save or a background refetch): untouched
  // boxes take the server's value, typed ones are kept, animals gone from the
  // sheet drop out, and added animals the server now lists become its rows.
  const [synced, setSynced] = useState(sheet);
  if (sheet !== synced) {
    setSynced(sheet);
    const fresh = fromRows(sheet.rows);
    const stillAdded = added.filter(a => !fresh[a.cattle_id]);
    const next: Record<number, Entry> = {};
    for (const r of sheet.rows) {
      const id = r.cattle_id;
      next[id] = !entries[id] || sameEntry(entries[id], base[id]) ? fresh[id] : entries[id];
    }
    for (const a of stillAdded) if (entries[a.cattle_id]) next[a.cattle_id] = entries[a.cattle_id];
    setEntries(next);
    setBase(b => ({ ...b, ...fresh }));
    if (stillAdded.length !== added.length) setAdded(stillAdded);
  }

  const rows = [...sheet.rows, ...added].map(r => (changed[r.cattle_id]
    ? { ...r, milking_sessions: changed[r.cattle_id], in_sessions: changed[r.cattle_id].includes(sheet.session) }
    : r));
  const others = (sheet.others ?? []).filter(o => !added.some(a => a.cattle_id === o.cattle_id));
  const addAnimal = (id: string) => {
    const r = others.find(o => String(o.cattle_id) === id);
    if (!r) return;
    setAdded(a => [...a, r]);
    setEntries(e => ({ ...e, [r.cattle_id]: { kg: '', saleable: r.is_saleable } }));
    setAdding('');
  };
  const sessionName = t(`session.${sheet.session}`);
  const sessionsOf = (r: MilkSheetRow) => (r.milking_sessions ?? []).map(s => t(`session.${s}`)).join(' · ');

  const total = Object.values(entries).reduce((s, e) => s + (parseFloat(e.kg) || 0), 0);
  const saleableTotal = Object.values(entries).reduce((s, e) => s + (e.saleable ? parseFloat(e.kg) || 0 : 0), 0);
  const setEntry = (id: number, patch: Partial<Entry>) => setEntries(p => ({ ...p, [id]: { ...p[id], ...patch } }));
  const dirty = rows.some(r => {
    const e = entries[r.cattle_id];
    return !!e && !sameEntry(e, base[r.cattle_id] ?? { kg: '', saleable: r.is_saleable });
  });

  // Sends the values as they were when Save was pressed.
  const save = useMutation({
    mutationFn: (values: Record<number, Entry>) => api.post('/farm/dairy/milk-sheet', {
      date: sheet.date,
      session: sheet.session,
      entries: rows.map(r => ({
        cattle_id: r.cattle_id,
        quantity_kg: (values[r.cattle_id]?.kg ?? '') === '' ? null : parseFloat(values[r.cattle_id].kg),
        is_saleable: values[r.cattle_id]?.saleable ?? true,
      })),
    }),
    onSuccess: (res, values) => {
      // Saved values are no longer unsaved; the refetch below brings the server's copy.
      setBase(b => ({ ...b, ...values }));
      toast.success(res?.data?.message ?? t('toast.saved'));
      invalidateMoney(qc, [['dairy'], ['cattle-dairy-history'], ['cattle-ledger']]);
      setError('');
      onSaved?.();
    },
    onError: e => setError(apiError(e, t('toast.failed')).message),
  });

  // "Not this session any more": the animal keeps its other sessions.
  const drop = useMutation({
    mutationFn: (r: MilkSheetRow) => api.post(`/farm/dairy/cattle/${r.cattle_id}/sessions`, {
      milking_sessions: (r.milking_sessions ?? []).filter(s => s !== sheet.session),
    }),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.saved'));
      setDropping(null);
      qc.invalidateQueries({ queryKey: ['dairy'] });
      onSaved?.();
    },
    onError: e => { setDropping(null); toast.error(apiError(e, t('toast.failed')).message); },
  });

  // "Always in this session": an animal added for the day keeps coming.
  const keep = useMutation({
    mutationFn: (r: MilkSheetRow) => api.post(`/farm/dairy/cattle/${r.cattle_id}/sessions`, {
      milking_sessions: [...(r.milking_sessions ?? []), sheet.session],
    }),
    onSuccess: (res, r) => {
      toast.success(res?.data?.message ?? t('toast.saved'));
      setChanged(c => ({ ...c, [r.cattle_id]: res?.data?.milking_sessions ?? [...(r.milking_sessions ?? []), sheet.session] }));
      qc.invalidateQueries({ queryKey: ['farm-cattle'] });
    },
    onError: e => toast.error(apiError(e, t('toast.failed')).message),
  });

  // Empty boxes mean "not milked this session" — asked once before saving.
  const submit = () => {
    if (!canEdit || save.isPending) return;
    const empty = rows.filter(r => (entries[r.cattle_id]?.kg ?? '') === '');
    if (empty.length && !blanks) { setBlanks(empty); return; }
    setBlanks(null);
    save.mutate(entries);
  };

  const saving = save.isPending;
  useEffect(() => { onStateChange?.({ dirty, saving }); }, [dirty, saving, onStateChange]);

  // Save sits at the bottom of a long list; bring its question or error into view.
  useEffect(() => {
    if (blanks || error) noticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [blanks, error]);

  // Add any other animal in milk to this sheet for the day.
  const addPicker = canEdit && others.length > 0 && (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Plus size={15} className="text-blue-500" />
      <select value={adding} onChange={e => addAnimal(e.target.value)} aria-label={t('sheet.add_other')}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 flex-1 sm:flex-none">
        <option value="">{t('sheet.add_other')}</option>
        {others.map(o => <option key={o.cattle_id} value={String(o.cattle_id)}>{o.tag_number}{o.name ? ` — ${o.name}` : ''} ({sessionsOf(o)})</option>)}
      </select>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-8 text-center space-y-3">
        <p className="text-sm text-slate-500">{others.length ? t('sheet.none_in_session', { session: sessionName }) : t('hint.no_animals')}</p>
        {addPicker && <div className="flex justify-center">{addPicker}</div>}
      </div>
    );
  }

  const kgBox = (r: MilkSheetRow, compact = false) => (
    <NumberInput value={entries[r.cattle_id]?.kg ?? ''} disabled={!canEdit} suffix={compact ? undefined : t('field.kg')}
      aria-label={`${r.tag_number} ${t('col.kg')}`} placeholder="0"
      onChange={v => setEntry(r.cattle_id, { kg: v })} />
  );
  const saleableBox = (r: MilkSheetRow, withLabel = false) => (
    <label className={`inline-flex items-center gap-2 ${withLabel ? 'text-sm text-slate-600 py-1' : ''}`}>
      <input type="checkbox" checked={entries[r.cattle_id]?.saleable ?? true} disabled={!canEdit}
        onChange={ev => setEntry(r.cattle_id, { saleable: ev.target.checked })} className="w-5 h-5 sm:w-4 sm:h-4 accent-blue-500"
        aria-label={withLabel ? undefined : `${r.tag_number} ${t('field.saleable')}`} />
      {withLabel && t('field.saleable')}
    </label>
  );
  const dropButton = (r: MilkSheetRow) => canEdit && (r.in_sessions === false ? (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{t('sheet.today_only')}</span>
      <button type="button" onClick={() => keep.mutate(r)} disabled={keep.isPending}
        className="inline-flex items-center gap-1 text-blue-600 hover:underline disabled:opacity-50">
        <Pin size={12} /> {t('sheet.keep_session', { session: sessionName })}
      </button>
    </span>
  ) : (
    <button type="button" onClick={() => setDropping(r)} disabled={(r.milking_sessions ?? []).length <= 1}
      title={(r.milking_sessions ?? []).length <= 1 ? t('drop.last') : t('btn.drop_session')} aria-label={`${r.tag_number}: ${t('btn.drop_session')}`}
      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 disabled:opacity-40 disabled:hover:text-slate-400">
      <MinusCircle size={13} /> <span className="sm:hidden">{t('btn.drop_session')}</span>
    </button>
  ));
  const animal = (r: MilkSheetRow) => (
    <>
      <Link href={`/farm/cattle/${r.cattle_id}`} className="font-medium text-slate-800 hover:text-blue-600">{r.tag_number}{r.name ? ` — ${r.name}` : ''}</Link>
      {r.withdrawal_until && (
        <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={11} /> {t('hint.withdrawal', { date: fmtDate(r.withdrawal_until) })}</p>
      )}
    </>
  );

  return (
    <form id={formId} onSubmit={e => { e.preventDefault(); submit(); }} className="space-y-3">
      <div ref={noticeRef} className="empty:hidden space-y-3">
        {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {blanks && (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-sm font-medium text-amber-900">{t('blank.title')}</p>
            <p className="text-sm text-amber-800">{t('blank.message', { n: fmtNum(blanks.length), animals: blanks.map(r => r.tag_number).join(', ') })}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} onClick={() => { setBlanks(null); save.mutate(entries); }}>{t('blank.confirm')}</button>
              <button type="button" className={btnSecondary} onClick={() => setBlanks(null)}>{t('blank.back')}</button>
            </div>
          </div>
        )}
      </div>
      {addPicker}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <NumberInput value={fillValue} onChange={setFillValue} placeholder={t('field.kg')} className="w-28" aria-label={t('btn.fill_same')} />
          <button type="button" disabled={!fillValue} className={btnSecondary}
            onClick={() => setEntries(p => Object.fromEntries(Object.entries(p).map(([id, e]) => [id, e.kg === '' ? { ...e, kg: fillValue } : e])))}>
            {t('btn.fill_same')}
          </button>
          <span className="text-xs text-slate-500 basis-full sm:basis-auto">{t('hint.empty_removes')}</span>
        </div>
      )}

      {/* Phones: one card per animal */}
      <ul className="sm:hidden space-y-2">
        {rows.map(r => (
          <li key={r.cattle_id} className={`rounded-xl border p-3 space-y-2 ${r.withdrawal_until ? 'border-red-200 bg-red-50/60' : 'border-slate-200 bg-white'}`}>
            <div className="text-sm">
              {animal(r)}
              <p className="text-xs text-slate-500">
                {[r.shed, `#${fmtNum(r.lactation_no)} · ${t('col.dim')} ${fmtNum(r.days_in_milk)}`, sessionsOf(r)].filter(Boolean).join(' · ')}
              </p>
              {dropButton(r)}
            </div>
            {kgBox(r)}
            {saleableBox(r, true)}
          </li>
        ))}
        <li className="flex justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700">
          <span>{t('total')} ({fmtNum(rows.length)})</span>
          <span>{fmtNum(total, 2)} {t('field.kg')} <span className="font-normal text-slate-500 text-xs">({t('field.saleable')} {fmtNum(saleableTotal, 2)})</span></span>
        </li>
      </ul>

      {/* Larger screens: the table */}
      <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-start text-slate-600">
              <th className="px-4 py-3 font-medium">{t('col.animal')}</th>
              <th className="px-4 py-3 font-medium">{t('col.lactation')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('col.times')}</th>
              <th className="px-4 py-3 font-medium w-36">{t('col.kg')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('field.saleable')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(r => (
              <tr key={r.cattle_id} className={r.withdrawal_until ? 'bg-red-50/60' : ''}>
                <td className="px-4 py-2.5">
                  {animal(r)}
                  {r.shed && <p className="text-xs text-slate-400">{r.shed}</p>}
                </td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">#{fmtNum(r.lactation_no)} · {t('col.dim')} {fmtNum(r.days_in_milk)}</td>
                <td className="px-4 py-2.5 text-center text-slate-500 text-xs">
                  <p>{sessionsOf(r)}</p>
                  {dropButton(r)}
                </td>
                <td className="px-4 py-2.5">{kgBox(r, true)}</td>
                <td className="px-4 py-2.5 text-center">{saleableBox(r)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-700">
              <td className="px-4 py-3" colSpan={3}>{t('total')} ({fmtNum(rows.length)})</td>
              <td className="px-4 py-3">{fmtNum(total, 2)} {t('field.kg')}</td>
              <td className="px-4 py-3 text-center text-xs font-normal text-slate-500">{fmtNum(saleableTotal, 2)} {t('field.kg')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ConfirmDialog
        open={!!dropping}
        title={t('drop.title')}
        message={t('drop.message', { animal: dropping ? dropping.tag_number : '', session: sessionName })}
        confirmLabel={t('drop.confirm')}
        loading={drop.isPending}
        onConfirm={() => dropping && drop.mutate(dropping)}
        onCancel={() => setDropping(null)}
      />

      {/* Phones: the save bar stays in reach at the bottom of the screen. */}
      {canEdit && !hideSave && (
        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <button type="submit" disabled={saving} className={`${btnPrimary} w-full sm:w-auto`}>
            <Save size={15} /> {saving ? '…' : t('btn.save')}
          </button>
        </div>
      )}
    </form>
  );
}
