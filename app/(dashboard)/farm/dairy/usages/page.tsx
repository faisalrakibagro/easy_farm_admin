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
import type { MilkUsage, MilkUsageType, PaginatedResponse } from '@/types';
import { Field, FormActions, ModalShell, apiError, inputCls, todayStr } from '@/components/breeding/shared';
import NumberInput from '@/components/ui/NumberInput';
import FormAlert from '@/components/ui/FormAlert';
import { otherErrors } from '@/lib/hooks/useFormErrors';
import { fmtDate, fmtNum } from '@/lib/format';

const TYPES: MilkUsageType[] = ['calf_feeding', 'household', 'wastage'];
const SHOWN = ['usage_date', 'quantity_kg', 'type', 'notes'];

export default function MilkUsagesPage() {
  const { t } = useTranslation('dairy');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<MilkUsage>>({
    queryKey: ['dairy', 'usages', page, type],
    queryFn: async () => (await api.get('/farm/dairy/usages', { params: { page, per_page: 20, type: type || undefined } })).data,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/dairy/usages/${id}`),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.deleted')); invalidateKeys(qc, [['dairy']]); setDeleteId(null); },
    onError: e => { toast.error(apiError(e, t('toast.failed')).message); setDeleteId(null); },
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('field.all')}</option>
          {TYPES.map(tp => <option key={tp} value={tp}>{t('usage_type.' + tp)}</option>)}
        </select>
        <div className="flex-1" />
        {hasPermission('farm.dairy.create') && (
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
            <div key={u.id} className="px-4 py-3 flex items-center gap-3 text-sm">
              <span className="text-slate-600 w-24">{fmtDate(u.usage_date)}</span>
              <span className="flex-1 text-slate-800">{t('usage_type.' + u.type)}{u.notes && <span className="text-xs text-slate-400"> · {u.notes}</span>}</span>
              <span className="font-medium text-slate-800">{fmtNum(u.quantity_kg)} {t('field.kg')}</span>
              {hasPermission('farm.dairy.delete') && (
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

      {showModal && <UsageModal onClose={() => setShowModal(false)} />}
      <ConfirmDialog open={deleteId !== null} title={t('btn.delete')} message={t('confirm.delete_usage')} confirmLabel={t('btn.delete')}
        loading={remove.isPending} onConfirm={() => deleteId !== null && remove.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

/** Record milk used on the farm (calf feeding, household) or wasted. */
function UsageModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('dairy');
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(() => ({ usage_date: todayStr(), type: 'calf_feeding' as MilkUsageType, quantity_kg: '', notes: '' }));
  const [opened] = useState(() => JSON.stringify(form));
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => { setForm(f => ({ ...f, [k]: v })); setFields(p => ({ ...p, [k]: '' })); };

  const save = useMutation({
    mutationFn: () => api.post('/farm/dairy/usages', form),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.saved')); invalidateKeys(qc, [['dairy']]); onClose(); },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (!form.usage_date) f.usage_date = t('common:form.v.date_required');
    if (!form.quantity_kg) f.quantity_kg = t('common:form.v.required');
    setFields(f);
    if (!Object.keys(f).length) save.mutate();
  };

  return (
    <ModalShell title={t('btn.add_usage')} onClose={onClose} dirty={JSON.stringify(form) !== opened}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, SHOWN)} />
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <Field name="usage_date" label={t('field.usage_date')} error={fields.usage_date} required>
            <input type="date" value={form.usage_date} max={todayStr()} onChange={e => set('usage_date', e.target.value)} className={inputCls(!!fields.usage_date)} />
          </Field>
          <Field name="quantity_kg" label={t('field.quantity_kg')} error={fields.quantity_kg} required>
            <NumberInput value={form.quantity_kg} error={fields.quantity_kg} data-autofocus onChange={v => set('quantity_kg', v)} />
          </Field>
        </div>
        <Field name="type" label={t('field.usage_type')} error={fields.type} required>
          <div role="radiogroup" className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
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
