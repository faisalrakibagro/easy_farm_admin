'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { invalidateKeys } from '@/lib/invalidateGroups';
import type { AnimalType, Byproduct, ByproductTracking } from '@/types';
import { Field, FormActions, ModalShell, apiError, inputCls } from '@/components/breeding/shared';
import { useByproducts } from '@/components/byproducts/shared';
import SearchSelect from '@/components/ui/SearchSelect';
import FormAlert from '@/components/ui/FormAlert';
import { otherErrors } from '@/lib/hooks/useFormErrors';

/** Add / edit one by-product: name, unit, how it is recorded, which species give it. */
function ProductModal({ product, onClose }: { product: Byproduct | null; onClose: () => void }) {
  const { t } = useTranslation('byproducts');
  const qc = useQueryClient();
  const toast = useToast();
  const { units } = useByproducts();
  const { data: types } = useQuery({
    queryKey: ['animal-types-all'],
    queryFn: async () => (await api.get('/farm/animal-types/all')).data as AnimalType[],
  });

  const inUse = !!product && ((product.records_count ?? 0) > 0 || (product.sales_count ?? 0) > 0);
  const [form, setForm] = useState({
    name: product?.name ?? '',
    unit_id: product ? String(product.unit_id) : '',
    tracking: (product?.tracking ?? 'farm') as ByproductTracking,
    animal_type_ids: (product?.animal_types ?? []).map(a => a.id),
    is_active: product?.is_active ?? true,
    description: product?.description ?? '',
  });
  const [opened] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== opened;
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const unitId = form.unit_id || (units[0] ? String(units[0].id) : '');
  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setFields(p => ({ ...p, [k]: '' }));
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, unit_id: unitId };
      return product ? api.put(`/farm/byproducts/${product.id}`, payload) : api.post('/farm/byproducts', payload);
    },
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.saved')); invalidateKeys(qc, [['byproducts']]); onClose(); },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (!form.name.trim()) f.name = t('common:form.v.required');
    if (!unitId) f.unit_id = t('common:form.v.required');
    setFields(f);
    if (!Object.keys(f).length) save.mutate();
  };

  const toggleType = (id: number) => setField('animal_type_ids',
    form.animal_type_ids.includes(id) ? form.animal_type_ids.filter(x => x !== id) : [...form.animal_type_ids, id]);

  return (
    <ModalShell title={product ? t('btn.edit') : t('btn.add_product')} onClose={onClose} dirty={dirty}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, ['name', 'unit_id', 'tracking', 'animal_type_ids*', 'description', 'is_active'])} />
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <Field name="name" label={t('field.name')} error={fields.name} required>
            <input value={form.name} dir="auto" onChange={e => setField('name', e.target.value)} className={inputCls(!!fields.name)} />
          </Field>
          <Field name="unit_id" label={t('field.unit')} error={fields.unit_id} required>
            <SearchSelect value={unitId} onChange={v => setField('unit_id', v)} error={fields.unit_id}
              placeholder={t('field.select_unit')} label={t('field.unit')}
              options={units.map(u => ({ value: String(u.id), label: u.symbol !== u.name ? `${u.name} (${u.symbol})` : u.name }))} />
          </Field>
        </div>

        <Field name="tracking" label={t('field.tracking')} error={fields.tracking} hint={inUse ? t('hint.tracking_locked') : undefined}>
          <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(['per_animal', 'farm'] as ByproductTracking[]).map(tr => (
              <button key={tr} type="button" role="radio" aria-checked={form.tracking === tr} disabled={inUse && form.tracking !== tr} onClick={() => setField('tracking', tr)}
                className={`text-start px-3 py-2 rounded-lg border disabled:opacity-40 ${form.tracking === tr ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                <span className={`block text-sm font-medium ${form.tracking === tr ? 'text-blue-700' : 'text-slate-700'}`}>{t('tracking.' + tr)}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{t(`tracking.${tr}_hint`)}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field name="animal_type_ids" label={t('field.species')} error={fields.animal_type_ids}>
          <div className="flex flex-wrap gap-2">
            {(types ?? []).map(tp => (
              <label key={tp.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer ${form.animal_type_ids.includes(tp.id) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'}`}>
                <input type="checkbox" className="accent-blue-500" checked={form.animal_type_ids.includes(tp.id)} onChange={() => toggleType(tp.id)} />
                {tp.name}
              </label>
            ))}
          </div>
        </Field>

        <Field name="description" label={t('field.description')} error={fields.description}>
          <textarea rows={2} value={form.description} dir="auto" onChange={e => setField('description', e.target.value)} className={inputCls(!!fields.description)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} />
          {t('field.active')}
        </label>
        <FormActions onCancel={onClose} saving={save.isPending} label={t('btn.save')} />
      </form>
    </ModalShell>
  );
}

export default function ByproductSettingsPage() {
  const { t } = useTranslation('byproducts');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { products, units, isLoading } = useByproducts();
  const [editing, setEditing] = useState<Byproduct | null | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [unitForm, setUnitForm] = useState({ name: '', symbol: '' });
  const [unitError, setUnitError] = useState('');

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/byproducts/${id}`),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.deleted')); invalidateKeys(qc, [['byproducts']]); setDeleteId(null); },
    onError: e => { toast.error(apiError(e, t('toast.failed')).message); setDeleteId(null); },
  });
  const addUnit = useMutation({
    mutationFn: () => api.post('/farm/byproducts/units', { name: unitForm.name.trim(), symbol: (unitForm.symbol || unitForm.name).trim() }),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.saved'));
      invalidateKeys(qc, [['byproducts', 'units'], ['units']]);
      setUnitForm({ name: '', symbol: '' });
      setUnitError('');
    },
    onError: e => { const r = apiError(e, t('toast.failed')); setUnitError(r.fields.symbol ?? r.fields.name ?? r.message); },
  });

  const canCreate = hasPermission('farm.byproducts.create');

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">{t('title')}</h2>
          {canCreate && (
            <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
              <Plus size={15} /> {t('btn.add_product')}
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {isLoading ? <div className="h-20 m-3 bg-slate-50 rounded animate-pulse" />
            : products.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">{t('empty')}</p>
            : products.map(p => {
              const used = (p.records_count ?? 0) + (p.sales_count ?? 0) + (p.usages_count ?? 0) > 0;
              return (
                <div key={p.id} className={`px-4 py-3 flex flex-wrap items-center gap-3 ${p.is_active ? '' : 'opacity-60'}`}>
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium text-slate-800">
                      {p.name} <span className="text-xs font-normal text-slate-400">({p.unit?.name})</span>
                      {!p.is_active && <span className="ms-2 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{t('field.inactive')}</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded me-1 ${p.tracking === 'per_animal' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{t('tracking.' + p.tracking)}</span>
                      {(p.animal_types ?? []).map(a => a.name).join(', ') || '—'}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{t('col.records')} {p.records_count ?? 0} · {t('col.sales')} {p.sales_count ?? 0}</span>
                  <div className="flex gap-1">
                    {hasPermission('farm.byproducts.edit') && (
                      <button onClick={() => setEditing(p)} title={t('btn.edit')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
                    )}
                    {hasPermission('farm.byproducts.delete') && (
                      <button onClick={() => setDeleteId(p.id)} disabled={used} title={used ? t('hint.in_use') : t('btn.delete')}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 disabled:opacity-30 disabled:hover:bg-transparent"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">{t('field.unit')}</h2>
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {units.map(u => (
              <span key={u.id} className="text-sm px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">{u.name}{u.symbol !== u.name ? ` (${u.symbol})` : ''}</span>
            ))}
          </div>
          {canCreate && (
            <form onSubmit={e => { e.preventDefault(); if (unitForm.name.trim()) addUnit.mutate(); }} className="flex flex-wrap items-end gap-2">
              <div className="w-40">
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('field.unit_name')}</label>
                <input value={unitForm.name} placeholder={t('hint.unit_add')} onChange={e => setUnitForm(f => ({ ...f, name: e.target.value }))} className={inputCls()} />
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('field.unit_symbol')}</label>
                <input value={unitForm.symbol} placeholder={unitForm.name} onChange={e => setUnitForm(f => ({ ...f, symbol: e.target.value }))} className={inputCls()} />
              </div>
              <button type="submit" disabled={addUnit.isPending || !unitForm.name.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <Plus size={14} /> {t('btn.add_unit')}
              </button>
              {unitError && <p className="w-full text-xs text-red-500">{unitError}</p>}
            </form>
          )}
        </div>
      </section>

      {editing !== undefined && <ProductModal key={editing?.id ?? 'new'} product={editing} onClose={() => setEditing(undefined)} />}
      <ConfirmDialog open={deleteId !== null} title={t('btn.delete')} message={t('confirm.delete_product')} confirmLabel={t('btn.delete')}
        loading={remove.isPending} onConfirm={() => deleteId !== null && remove.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
