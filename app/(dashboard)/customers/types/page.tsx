'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { CustomerType } from '@/types';
import Modal from '@/components/ui/Modal';
import LoadError from '@/components/ui/LoadError';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

const FORM_ID = 'customer-type-form';

/** Customer types — dairy wholesaler, collection centre, cattle buyer, retail … */
export default function CustomerTypesPage() {
  const { t } = useTranslation('dairy');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [editing, setEditing] = useState<CustomerType | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [snap, setSnap] = useState('');
  useScrollToError(errors, error);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['customer-types'],
    queryFn: async () => (await api.get('/customer-types')).data.customer_types as CustomerType[],
  });

  const errMsg = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('toast.failed');

  const save = useMutation({
    mutationFn: () => editing ? api.put(`/customer-types/${editing.id}`, { name, notes: notes || null }) : api.post('/customer-types', { name, notes: notes || null }),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.saved')); qc.invalidateQueries({ queryKey: ['customer-types'] }); setEditing(undefined); },
    onError: e => {
      const { fields } = apiFieldErrors(e, '');
      setErrors(fields);
      if (!Object.keys(fields).length) setError(errMsg(e));
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/customer-types/${id}`),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.deleted')); qc.invalidateQueries({ queryKey: ['customer-types'] }); setDeleteId(null); },
    onError: e => { toast.error(errMsg(e)); setDeleteId(null); },
  });

  const open = (ct: CustomerType | null) => {
    setEditing(ct); setName(ct?.name ?? ''); setNotes(ct?.notes ?? ''); setError(''); setErrors({});
    setSnap(JSON.stringify({ name: ct?.name ?? '', notes: ct?.notes ?? '' }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('customer_types.title')}</h1>
        {hasPermission('customers.create') && (
          <button onClick={() => open(null)} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus size={16} /> {t('customer_types.add')}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {isLoading ? <div className="h-24 m-3 bg-slate-50 rounded animate-pulse" />
          : isError && !data ? <LoadError onRetry={() => refetch()} retrying={isFetching} />
          : (data ?? []).length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">{t('empty')}</p>
          : (data ?? []).map(ct => (
            <div key={ct.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800">{ct.name}</p>
                {ct.notes && <p className="text-xs text-slate-400 truncate">{ct.notes}</p>}
              </div>
              <span className="text-xs text-slate-500">{t('customer_types.count')}: {ct.customers_count ?? 0}</span>
              {hasPermission('customers.edit') && (
                <button onClick={() => open(ct)} aria-label={t('btn.edit')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
              )}
              {hasPermission('customers.delete') && !ct.customers_count && (
                <button onClick={() => setDeleteId(ct.id)} aria-label={t('btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} dirty={JSON.stringify({ name, notes }) !== snap} size="md"
        title={editing ? t('btn.edit') : t('customer_types.add')}
        footer={<>
          <button type="button" onClick={() => setEditing(undefined)} className={btnSecondary}>{t('btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={save.isPending} className={btnPrimary}>
            <Check size={15} /> {t('btn.save')}
          </button>
        </>}>
        <form id={FORM_ID} noValidate className="px-4 sm:px-6 py-5 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            setError('');
            if (!name.trim()) { setErrors({ name: t('common:form.v.required') }); return; }
            setErrors({});
            save.mutate();
          }}>
          <FormAlert message={error} extra={otherErrors(errors, ['name', 'notes'])} />
          <Field name="name" label={t('customer_types.name')} required error={errors.name}>
            <input id={fieldId('name')} value={name} dir="auto" data-autofocus
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: '' })); }}
              className={fieldClass(errors.name)} />
          </Field>
          <Field name="notes" label={t('field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={notes} onChange={e => setNotes(e.target.value)} className={fieldClass(errors.notes)} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog open={deleteId !== null} title={t('btn.delete')} message={t('customer_types.confirm_delete')} confirmLabel={t('btn.delete')}
        loading={remove.isPending} onConfirm={() => deleteId !== null && remove.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
