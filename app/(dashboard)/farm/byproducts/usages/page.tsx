'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { invalidateKeys } from '@/lib/invalidateGroups';
import type { ByproductUsage, ByproductUsageType, PaginatedResponse } from '@/types';
import { Field, FormActions, ModalShell, apiError, inputCls, todayStr } from '@/components/breeding/shared';
import { fmtDate } from '@/lib/format';
import { qtyLabel, useByproducts } from '@/components/byproducts/shared';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import FormAlert from '@/components/ui/FormAlert';
import { otherErrors } from '@/lib/hooks/useFormErrors';

const TYPES: ByproductUsageType[] = ['fertilizer', 'biogas', 'household', 'wastage', 'other'];

const emptyForm = () => ({ byproduct_id: '', usage_date: todayStr(), type: 'fertilizer' as ByproductUsageType, unit_id: '', quantity: '', notes: '' });

export default function ByproductUsagesPage() {
  const { t } = useTranslation('byproducts');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { products } = useByproducts();
  const [page, setPage] = useState(1);
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<ByproductUsage>>({
    queryKey: ['byproducts', 'usages', page, productId, type],
    queryFn: async () => (await api.get('/farm/byproducts/usages', {
      params: { page, per_page: 20, byproduct_id: productId || undefined, type: type || undefined },
    })).data,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/byproducts/usages/${id}`),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.deleted')); invalidateKeys(qc, [['byproducts']]); setDeleteId(null); },
    onError: e => { toast.error(apiError(e, t('toast.failed')).message); setDeleteId(null); },
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={productId} onChange={e => { setProductId(e.target.value); setPage(1); }} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('field.all_products')}</option>
          {products.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('field.all')}</option>
          {TYPES.map(tp => <option key={tp} value={tp}>{t('usage_type.' + tp)}</option>)}
        </select>
        <div className="flex-1" />
        {hasPermission('farm.byproducts.create') && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
            <Plus size={15} /> {t('btn.add_usage')}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {isLoading ? <div className="h-20 m-3 bg-slate-50 rounded animate-pulse" />
          : rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">{t('empty')}</p>
          : rows.map(u => (
            <div key={u.id} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-slate-600 w-24">{fmtDate(u.usage_date)}</span>
              <span className="flex-1 min-w-0 text-slate-800">
                {u.byproduct?.name} · {t('usage_type.' + u.type)}
                {u.notes && <span className="text-xs text-slate-400"> · {u.notes}</span>}
              </span>
              <span className="font-medium text-slate-800">{qtyLabel(u.quantity, u.unit?.symbol)}</span>
              {hasPermission('farm.byproducts.delete') && (
                <button onClick={() => setDeleteId(u.id)} title={t('btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
      </div>

      {(data?.total ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-500">{t('common:pagination.page_of', { current: page, total: data?.last_page ?? 1 })} &bull; {t('common:pagination.total_count', { count: data?.total ?? 0 })}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.prev')}</button>
            <button disabled={page >= (data?.last_page ?? 1)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.next')}</button>
          </div>
        </div>
      )}

      {showModal && <UsageModal initialProductId={productId} onClose={() => setShowModal(false)} />}
      <ConfirmDialog open={deleteId !== null} title={t('btn.delete')} message={t('confirm.delete_usage')} confirmLabel={t('btn.delete')}
        loading={remove.isPending} onConfirm={() => deleteId !== null && remove.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

const SHOWN = ['byproduct_id', 'usage_date', 'quantity', 'unit_id', 'type', 'notes'];

/** Record one use (fertilizer, biogas …) of a by-product. */
function UsageModal({ initialProductId, onClose }: { initialProductId: string; onClose: () => void }) {
  const { t } = useTranslation('byproducts');
  const qc = useQueryClient();
  const toast = useToast();
  const { products, active, units } = useByproducts();
  const [form, setForm] = useState(() => ({ ...emptyForm(), byproduct_id: initialProductId }));
  const [opened] = useState(() => JSON.stringify(form));
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => { setForm(f => ({ ...f, [k]: v })); setFields(p => ({ ...p, [k]: '' })); };

  // Derived defaults (no effects): the first active product and its own unit.
  const formProductId = form.byproduct_id || (active[0] ? String(active[0].id) : '');
  const formProduct = products.find(p => String(p.id) === formProductId);
  const formUnitId = form.unit_id || (formProduct ? String(formProduct.unit_id) : '');
  const unit = units.find(u => String(u.id) === formUnitId);

  const save = useMutation({
    mutationFn: () => api.post('/farm/byproducts/usages', { ...form, byproduct_id: formProductId, unit_id: formUnitId || null }),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.saved')); invalidateKeys(qc, [['byproducts']]); onClose(); },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (!formProductId) f.byproduct_id = t('field.select_product');
    if (!form.usage_date) f.usage_date = t('common:form.v.date_required');
    if (!form.quantity) f.quantity = t('common:form.v.required');
    setFields(f);
    if (!Object.keys(f).length) save.mutate();
  };

  return (
    <ModalShell title={t('btn.add_usage')} onClose={onClose} dirty={JSON.stringify(form) !== opened}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, SHOWN)} />
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <Field name="byproduct_id" label={t('field.product')} error={fields.byproduct_id} required>
            <SearchSelect value={formProductId} error={fields.byproduct_id}
              onChange={v => { set('byproduct_id', v); set('unit_id', ''); }}
              placeholder={t('field.select_product')} label={t('field.product')}
              options={active.map(p => ({ value: String(p.id), label: p.name }))} />
          </Field>
          <Field name="usage_date" label={t('field.date')} error={fields.usage_date} required>
            <input type="date" value={form.usage_date} max={todayStr()} onChange={e => set('usage_date', e.target.value)} className={inputCls(!!fields.usage_date)} />
          </Field>
          <Field name="quantity" label={t('field.quantity')} error={fields.quantity} required>
            <NumberInput value={form.quantity} suffix={unit?.symbol} error={fields.quantity} data-autofocus onChange={v => set('quantity', v)} />
          </Field>
          <Field name="unit_id" label={t('field.unit')} error={fields.unit_id}>
            <SearchSelect value={formUnitId} onChange={v => set('unit_id', v)} error={fields.unit_id}
              placeholder={t('field.select_unit')} label={t('field.unit')}
              options={units.map(u => ({ value: String(u.id), label: u.symbol !== u.name ? `${u.name} (${u.symbol})` : u.name }))} />
          </Field>
        </div>
        <Field name="type" label={t('field.usage_type')} error={fields.type} required>
          <div role="radiogroup" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TYPES.map(tp => (
              <button key={tp} type="button" role="radio" aria-checked={form.type === tp} onClick={() => set('type', tp)}
                className={`px-2 py-2.5 sm:py-2 text-xs rounded-lg border font-medium ${form.type === tp ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                {t('usage_type.' + tp)}
              </button>
            ))}
          </div>
        </Field>
        <Field name="notes" label={t('field.notes')} error={fields.notes}>
          <textarea rows={2} value={form.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={inputCls(!!fields.notes)} />
        </Field>
        <FormActions onCancel={onClose} saving={save.isPending} label={t('btn.save')} />
      </form>
    </ModalShell>
  );
}
