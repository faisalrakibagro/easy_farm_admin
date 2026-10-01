'use client';

import { Fragment, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import type { FeedItem, FeedStock } from '@/types';
import { Plus, X, Check, Layers, ChevronDown, ChevronUp, Package, Undo2, Info } from 'lucide-react';
import Link from '@/components/ui/AppLink';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { failedMsg, savedMsg } from '@/lib/feedback';
import { FEED_STOCK_KEYS, invalidateKeys } from '@/lib/invalidateGroups';
import { useAuth } from '@/contexts/AuthContext';
import { useDateRange } from '@/lib/hooks/useDateRange';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import { fmtNum, fmtMoney } from '@/lib/format';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { SerialCell, SerialHeader, SortHeader, SortSelect, TablePagination } from '@/components/ui/TableControls';

type Batch = {
  id: number;
  batch_date: string;
  output_feed_item_id: number;
  output_item: { id: number; name: string; unit: string | null } | null;
  output_quantity: string;
  remaining_quantity: string | null;
  input_quantity: number;
  total_cost: string;
  unit_price: string;
  can_cancel: boolean;
  notes: string | null;
  created_by: string | null;
  items: { id: number; feed_item_id: number; name: string | null; unit: string | null; quantity: string; unit_price: string; total_cost: string }[];
};

type Line = { feed_item_id: string; quantity: string; unit: string };
type Stock = { feed_item_id: string; name: string; category: string; unit: string; available: number; lots: { qty: number; price: number }[] };

const FORM_ID = 'feed-batch';
const EMPTY_LINE: Line = { feed_item_id: '', quantity: '', unit: '' };
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const emptyForm = () => ({ batch_date: localDateStr(), output_feed_item_id: '', output_quantity: '', notes: '' });

/** Units a line can be typed in: the feed's own, plus g / mL under kg / L. */
function unitOptions(base: string): { value: string; factor: number }[] {
  const u = (base ?? '').toLowerCase().trim();
  if (u === 'kg') return [{ value: 'kg', factor: 1 }, { value: 'g', factor: 0.001 }];
  if (u === 'l' || u === 'liter' || u === 'litre') return [{ value: u, factor: 1 }, { value: 'ml', factor: 0.001 }];
  return [{ value: base || '', factor: 1 }];
}
const inBase = (line: Line, stock?: Stock) => {
  const opts = unitOptions(stock?.unit ?? '');
  return round3((parseFloat(line.quantity) || 0) * ((opts.find(o => o.value === line.unit) ?? opts[0]).factor));
};

export default function FeedBatchesPage() {
  const { t } = useTranslation(['feed', 'common']);
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [outputTouched, setOutputTouched] = useState(false);
  const [opened, setOpened] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Batch | null>(null);
  const dateRange = useDateRange(setPage);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);

  const { data, isLoading } = useQuery<{ data: Batch[]; total: number; last_page: number }>({
    queryKey: ['feed-batches', page, dateRange.params, sorting.params],
    queryFn: async () => (await api.get('/farm/feed/batches', { params: { page, per_page: 15, ...dateRange.params, ...sorting.params } })).data,
  });
  const { data: stocksData } = useQuery<{ stocks: FeedStock[] }>({
    queryKey: ['feed-available-stocks'],
    queryFn: async () => (await api.get('/farm/feed/usages/available-stocks')).data,
    enabled: showModal,
  });
  const { data: itemsData } = useQuery<{ items: FeedItem[] }>({
    queryKey: ['feed-items-all'],
    queryFn: async () => (await api.get('/farm/feed/items/all')).data,
    enabled: showModal,
  });

  // Every feed once, its lots oldest first (the order the server takes them).
  const stocks = useMemo<Stock[]>(() => {
    const out = new Map<string, Stock>();
    for (const st of stocksData?.stocks ?? []) {
      const key = String(st.feed_item_id);
      const qty = parseFloat(String(st.remaining_quantity)) || 0;
      const lot = { qty, price: parseFloat(String(st.unit_price)) || 0 };
      const prev = out.get(key);
      if (prev) { prev.available = round3(prev.available + qty); prev.lots.push(lot); }
      else out.set(key, { feed_item_id: key, name: st.item_name, category: st.category_name, unit: st.unit, available: qty, lots: [lot] });
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [stocksData]);
  const stockOf = (id: string) => stocks.find(s => s.feed_item_id === id);
  const feedItems = itemsData?.items ?? [];
  const outputItem = feedItems.find(i => String(i.id) === form.output_feed_item_id);
  const outputUnit = outputItem?.unit?.symbol ?? '';

  // What the ingredients come to, taken oldest lot first (an estimate: the
  // server prices it the same way when saving).
  const estimate = useMemo(() => {
    let cost = 0;
    const taken: Record<string, number> = {};
    for (const line of lines) {
      const st = stockOf(line.feed_item_id);
      if (!st) continue;
      let need = inBase(line, st);
      let skip = taken[st.feed_item_id] ?? 0;
      taken[st.feed_item_id] = skip + need;
      for (const lot of st.lots) {
        const free = Math.max(0, lot.qty - skip);
        skip = Math.max(0, skip - lot.qty);
        const take = Math.min(need, free);
        cost += take * lot.price;
        need -= take;
        if (need <= 0) break;
      }
    }
    return Math.round(cost * 100) / 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, stocks]);
  // The ingredients' total, when they are all in the mix's own unit.
  const inputSum = useMemo(() => {
    const filled = lines.filter(l => l.feed_item_id && parseFloat(l.quantity) > 0);
    if (!filled.length || !outputUnit || filled.some(l => (stockOf(l.feed_item_id)?.unit ?? '').toLowerCase() !== outputUnit.toLowerCase())) return null;
    return round3(filled.reduce((s, l) => s + inBase(l, stockOf(l.feed_item_id)), 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, stocks, outputUnit]);
  const outputQty = outputTouched ? form.output_quantity : (form.output_quantity || (inputSum ? String(inputSum) : ''));

  const createMutation = useMutation({
    mutationFn: (payload: object) => api.post('/farm/feed/batches', payload),
    onSuccess: (res) => {
      invalidateKeys(qc, [...FEED_STOCK_KEYS, ['feed-batches']]);
      setShowModal(false);
      toast.success(res?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });
  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/feed/batches/${id}`),
    onSuccess: (res) => {
      invalidateKeys(qc, [...FEED_STOCK_KEYS, ['feed-batches']]);
      setCancelTarget(null);
      toast.success(res?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setCancelTarget(null);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  const openCreate = () => {
    const f = emptyForm();
    setForm(f); setLines([{ ...EMPTY_LINE }]); setOutputTouched(false);
    setErrors({}); setFormError('');
    setOpened(JSON.stringify({ f, l: [EMPTY_LINE] }));
    setShowModal(true);
  };
  const clearError = (...keys: string[]) =>
    setErrors(p => (keys.some(k => p[k]) ? { ...p, ...Object.fromEntries(keys.map(k => [k, ''])) } : p));
  const setField = (key: keyof ReturnType<typeof emptyForm>, value: string) => { setForm(f => ({ ...f, [key]: value })); clearError(key); };
  // Lines change what the mix adds up to, so the amount's error goes too.
  const updateLine = (i: number, patch: Partial<Line>) => { setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l)); clearError('output_quantity'); };
  const removeLine = (i: number) => { setLines(prev => prev.filter((_, idx) => idx !== i)); clearError('output_quantity'); };


  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.batch_date) e.batch_date = t('batches.v.date_required');
    if (!form.output_feed_item_id) e.output_feed_item_id = t('batches.v.output_required');
    if (!(parseFloat(outputQty) > 0)) e.output_quantity = t('batches.v.output_qty_required');
    if (!lines.some(l => l.feed_item_id)) e.items = t('batches.v.items_required');
    const asked: Record<string, number> = {};
    lines.forEach((l, i) => {
      if (!l.feed_item_id) { e[`items.${i}.feed_item_id`] = t('batches.v.item_required'); return; }
      if (l.feed_item_id === form.output_feed_item_id) e[`items.${i}.feed_item_id`] = t('batches.v.same_item');
      if (!(parseFloat(l.quantity) > 0)) { e[`items.${i}.quantity`] = t('batches.v.qty_required'); return; }
      const st = stockOf(l.feed_item_id);
      asked[l.feed_item_id] = (asked[l.feed_item_id] ?? 0) + inBase(l, st);
      if (!st || asked[l.feed_item_id] > st.available + 0.001)
        e[`items.${i}.quantity`] = t('batches.v.stock_short', { available: fmtNum(round3(st?.available ?? 0)), unit: st?.unit ?? '' });
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    createMutation.mutate({
      batch_date: form.batch_date,
      output_feed_item_id: form.output_feed_item_id,
      output_quantity: outputQty,
      notes: form.notes || null,
      items: lines.map(l => ({ feed_item_id: l.feed_item_id, quantity: inBase(l, stockOf(l.feed_item_id)) })),
    });
  };

  const batches = data?.data ?? [];
  const dirty = showModal && JSON.stringify({ f: form, l: lines }) !== opened;
  const known = ['batch_date', 'output_feed_item_id', 'output_quantity', 'notes', 'items',
    ...lines.flatMap((_, i) => [`items.${i}.feed_item_id`, `items.${i}.quantity`])];
  useScrollToError(errors, formError);
  const perUnit = parseFloat(outputQty) > 0 ? Math.round((estimate / parseFloat(outputQty)) * 100) / 100 : 0;

  const ingredientsTable = (b: Batch) => (
    <table className="w-full text-xs">
      <thead><tr className="border-b border-slate-200">
        <th className="text-start py-2 font-medium text-slate-600">{t('batches.col.ingredient')}</th>
        <th className="text-end py-2 font-medium text-slate-600">{t('batches.col.quantity')}</th>
        <th className="text-end py-2 font-medium text-slate-600">{t('batches.col.unit_price')}</th>
        <th className="text-end py-2 font-medium text-slate-600">{t('batches.col.total')}</th>
      </tr></thead>
      <tbody className="divide-y divide-slate-100">
        {b.items.map(it => (
          <tr key={it.id}>
            <td className="py-2 font-medium text-slate-700">{it.name ?? t('common:ui.item_n', { id: it.feed_item_id })}</td>
            <td className="py-2 text-end text-slate-600">{fmtNum(it.quantity)} {it.unit ?? ''}</td>
            <td className="py-2 text-end text-slate-600">{fmtMoney(it.unit_price)}</td>
            <td className="py-2 text-end font-medium text-amber-700">{fmtMoney(it.total_cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const cancelButton = (b: Batch) => hasPermission('farm.feed.delete') && (
    b.can_cancel ? (
      <button onClick={() => setCancelTarget(b)} aria-label={t('batches.btn.cancel_batch')} title={t('batches.btn.cancel_batch')}
        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Undo2 size={14} /></button>
    ) : null
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('batches.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('batches.subtitle')}</p>
        </div>
        {hasPermission('farm.feed.create') && (
          <button onClick={openCreate} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg w-full sm:w-auto justify-center">
            <Plus size={16} /> {t('batches.new')}
          </button>
        )}
      </div>

      <DateRangeFilter value={dateRange.range} onChange={dateRange.setRange} />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Phone: a card per batch */}
        <div className="block sm:hidden divide-y divide-slate-100">
          <SortSelect options={[
            { key: 'date', label: t('batches.col.date'), type: 'date' },
            { key: 'made', label: t('batches.col.made'), type: 'number' },
            { key: 'cost', label: t('batches.col.cost'), type: 'number' },
            { key: 'per_unit', label: t('batches.col.per_unit'), type: 'number' },
          ]} sorting={sorting} className="px-4 py-2.5" />
          {isLoading ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2"><div className="h-4 w-32 bg-slate-100 rounded animate-pulse" /><div className="h-3 w-full bg-slate-100 rounded animate-pulse" /></div>
          )) : batches.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">{t('batches.empty')}</div>
          ) : batches.map(b => (
            <div key={b.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{b.output_item?.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(b.batch_date).toLocaleDateString(localeFor())}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">{cancelButton(b)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-slate-400">{t('batches.col.made')}</p><p className="font-medium text-slate-700">{fmtNum(b.output_quantity)} {b.output_item?.unit ?? ''}</p></div>
                <div><p className="text-slate-400">{t('batches.col.left')}</p><p className="font-medium text-slate-700">{fmtNum(b.remaining_quantity ?? 0)} {b.output_item?.unit ?? ''}</p></div>
                <div><p className="text-slate-400">{t('batches.col.per_unit')}</p><p className="font-semibold text-slate-800">{fmtMoney(b.unit_price)}</p></div>
              </div>
              <button onClick={() => setExpandedId(expandedId === b.id ? null : b.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                {expandedId === b.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {t('batches.col.ingredients')} ({fmtNum(b.items.length)}) · {fmtMoney(b.total_cost)}
              </button>
              {expandedId === b.id && <div className="rounded-lg bg-slate-50 px-3 py-2">{ingredientsTable(b)}</div>}
            </div>
          ))}
        </div>

        {/* Desktop: a table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <SerialHeader />
                <th className="w-8 px-4 py-3" />
                <SortHeader label={t('batches.col.date')} sortKey="date" sortType="date" sorting={sorting} />
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('batches.col.mix')}</th>
                <SortHeader label={t('batches.col.made')} align="right" sortKey="made" sortType="number" sorting={sorting} />
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('batches.col.left')}</th>
                <SortHeader label={t('batches.col.cost')} align="right" sortKey="cost" sortType="number" sorting={sorting} />
                <SortHeader label={t('batches.col.per_unit')} align="right" sortKey="per_unit" sortType="number" sorting={sorting} />
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('common:actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
              )) : batches.map((b, i) => (
                <Fragment key={b.id}>
                  <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}>
                    <SerialCell index={i} page={page} perPage={15} />
                    <td className="px-4 py-3 text-slate-400">{expandedId === b.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                    <td className="px-4 py-3 text-slate-700">{new Date(b.batch_date).toLocaleDateString(localeFor())}</td>
                    <td className="px-4 py-3 font-medium text-slate-800"><span className="inline-flex items-center gap-1.5"><Layers size={14} className="text-violet-500" /> {b.output_item?.name}</span></td>
                    <td className="px-4 py-3 text-end text-slate-700">{fmtNum(b.output_quantity)} {b.output_item?.unit ?? ''}</td>
                    <td className="px-4 py-3 text-end text-slate-700">{fmtNum(b.remaining_quantity ?? 0)} {b.output_item?.unit ?? ''}</td>
                    <td className="px-4 py-3 text-end text-slate-700">{fmtMoney(b.total_cost)}</td>
                    <td className="px-4 py-3 text-end font-semibold text-slate-800">{fmtMoney(b.unit_price)}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>{cancelButton(b)}</div></td>
                  </tr>
                  {expandedId === b.id && (
                    <tr><td colSpan={9} className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                      {ingredientsTable(b)}
                      {b.notes && <p className="mt-2 text-xs text-slate-500 italic">{b.notes}</p>}
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {!isLoading && batches.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">{t('batches.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {(data?.total ?? 0) > 0 && (
          <TablePagination page={page} lastPage={data?.last_page ?? 1} total={data?.total} perPage={15} onPageChange={setPage} />
        )}
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        title={t('batches.confirm.title')}
        message={t('batches.confirm.message', { qty: fmtNum(cancelTarget?.output_quantity ?? 0), unit: cancelTarget?.output_item?.unit ?? '' })}
        confirmLabel={t('batches.confirm.label')}
        loading={cancelMutation.isPending}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
        onCancel={() => setCancelTarget(null)}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} dirty={dirty} size="2xl" title={t('batches.create_title')}
        footer={<>
          <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={createMutation.isPending} className={btnPrimary}>
            <Check size={15} /> {t('batches.btn.make')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-5">
          <FormAlert message={formError} extra={otherErrors(errors, known)} />
          <p className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-3"><Info size={14} className="shrink-0 mt-px text-blue-500" /> {t('batches.how')}</p>

          <FormRow>
            <Field name="batch_date" label={t('batches.field.date')} required error={errors.batch_date}>
              <input id={fieldId('batch_date')} type="date" value={form.batch_date} max={localDateStr()}
                onChange={e => setField('batch_date', e.target.value)} className={fieldClass(errors.batch_date)} />
            </Field>
            <Field name="output_feed_item_id" label={t('batches.field.output_item')} required error={errors.output_feed_item_id}
              hint={<>{t('batches.hint.output_item')} <Link href="/farm/feed/items" className="text-blue-600 hover:underline">{t('batches.link.new_item')}</Link></>}>
              <SearchSelect id={fieldId('output_feed_item_id')} value={form.output_feed_item_id} label={t('batches.field.output_item')}
                placeholder={t('batches.placeholder.output_item')} error={errors.output_feed_item_id}
                onChange={v => setField('output_feed_item_id', v)}
                options={feedItems.map(i => ({ value: String(i.id), label: i.name, sub: i.unit?.symbol ?? i.category?.name }))} />
            </Field>
          </FormRow>

          <Field name="items" error={errors.items}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-medium text-slate-600">{t('batches.field.ingredients')}<span className="text-red-500 ms-0.5" aria-hidden="true">*</span></p>
              <button type="button" onClick={() => setLines(prev => [...prev, { ...EMPTY_LINE }])}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1 -me-2 rounded-lg hover:bg-blue-50">
                {t('batches.btn.add_ingredient')}
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => {
                const st = stockOf(line.feed_item_id);
                const opts = unitOptions(st?.unit ?? '');
                const itemKey = `items.${i}.feed_item_id`;
                const qtyKey = `items.${i}.quantity`;
                return (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_11rem] gap-2">
                        <Field name={itemKey} error={errors[itemKey]}>
                          <SearchSelect id={fieldId(itemKey)} value={line.feed_item_id} label={t('batches.col.ingredient')}
                            placeholder={t('batches.placeholder.ingredient')} error={errors[itemKey]}
                            onChange={v => { updateLine(i, { feed_item_id: v, unit: unitOptions(stockOf(v)?.unit ?? '')[0].value }); clearError('items', itemKey); }}
                            options={stocks.filter(s => s.feed_item_id !== form.output_feed_item_id).map(s => ({
                              value: s.feed_item_id, label: s.name, keywords: s.category,
                              sub: t('batches.in_stock', { qty: fmtNum(s.available), unit: s.unit }),
                            }))} />
                        </Field>
                        <Field name={qtyKey} error={errors[qtyKey]}>
                          <NumberInput id={fieldId(qtyKey)} value={line.quantity} aria-label={t('batches.col.quantity')} error={errors[qtyKey]}
                            onChange={v => { updateLine(i, { quantity: v }); clearError(qtyKey); }}
                            suffix={opts.length > 1 ? (
                              <select value={line.unit || opts[0].value} aria-label={t('daily.unit_fallback')}
                                onChange={e => updateLine(i, { unit: e.target.value })}
                                className="-mx-3 h-full bg-transparent px-2 text-sm font-medium text-slate-600 focus:outline-none cursor-pointer">
                                {opts.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                              </select>
                            ) : (st?.unit || t('daily.unit_fallback'))} />
                        </Field>
                      </div>
                      {lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(i)} aria-label={t('common:ui.remove_item')}
                          className="p-2 -me-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"><X size={16} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>

          <Field name="output_quantity" label={t('batches.field.output_quantity')} required error={errors.output_quantity}
            hint={inputSum ? `${t('batches.hint.output_quantity')} ${t('batches.hint.output_sum', { qty: fmtNum(inputSum), unit: outputUnit })}` : t('batches.hint.output_quantity')}>
            <NumberInput id={fieldId('output_quantity')} value={outputQty} suffix={outputUnit || undefined} error={errors.output_quantity}
              onChange={v => { setOutputTouched(true); setField('output_quantity', v); }} />
          </Field>

          {estimate > 0 && (
            <p className="flex items-center gap-2 text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <Package size={15} className="text-amber-600 shrink-0" />
              {t('batches.estimate', { cost: fmtMoney(estimate), per: fmtMoney(perUnit), unit: outputUnit || '—' })}
            </p>
          )}

          <Field name="notes" label={t('batches.field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} value={form.notes} dir="auto"
              onChange={e => setField('notes', e.target.value)} className={fieldClass(errors.notes)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
