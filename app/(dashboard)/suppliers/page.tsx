'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ShowInactiveFilter } from '@/components/ui/ActiveSwitch';
import api from '@/lib/api';
import { Supplier, SupplierType, PaginatedResponse } from '@/types';
import { Plus, Check, Trash2, Eye, Phone, Search, User } from 'lucide-react';
import { normalizeNumber } from '@/lib/normalizeNumbers';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import TrashLink from '@/components/ui/TrashLink';
import Modal from '@/components/ui/Modal';
import Link from '@/components/ui/AppLink';
import LoadError from '@/components/ui/LoadError';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import SearchSelect from '@/components/ui/SearchSelect';
import NumberInput from '@/components/ui/NumberInput';
import FileAttachInput from '@/components/ui/FileAttachInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtMoney } from '@/lib/format';

const EMPTY_FORM = {
  name: '', notes: '', supplier_type_id: '', phone: '', email: '',
  address: '', opening_balance: '0',
};

const FORM_ID = 'create-supplier';
const KNOWN = ['name', 'supplier_type_id', 'phone', 'email', 'opening_balance', 'address', 'notes', 'photo'];

const BADGE_COLOR = 'bg-slate-100 text-slate-600';

export default function SuppliersPage() {
  const { t } = useTranslation(['finance', 'common']);
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY_FORM) || !!photoFile;
  useScrollToError(errors, formError);

  const set = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  const { data: supplierTypesData } = useQuery<{ supplier_types: SupplierType[] }>({
    queryKey: ['supplier-types'],
    queryFn: async () => (await api.get('/supplier-types')).data,
  });
  const supplierTypes = supplierTypesData?.supplier_types ?? [];

  const { data, isLoading, isError, isFetching, refetch } = useQuery<PaginatedResponse<Supplier>>({
    queryKey: ['suppliers', page, search, typeFilter, showInactive],
    queryFn: async () => (await api.get('/suppliers', { params: { page, per_page: 20, search: search || undefined, supplier_type_id: typeFilter || undefined, is_active: showInactive ? 0 : 1 } })).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      invalidateMoney(qc, [['suppliers'], ['suppliers-all'], ['suppliers-trash']]);
      setDeleteTarget(null);
      toast.success(t('suppliers.msg.moved_to_trash'));
    },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('suppliers.msg.failed_delete'));
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t('suppliers.error.name_required');
    if (!form.supplier_type_id) e.supplier_type_id = t('suppliers.error.type_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    setIsSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'opening_balance') { fd.append(k, normalizeNumber(String(v))); }
        else if (String(v) !== '') fd.append(k, String(v));
      });
      if (photoFile) fd.append('photo', photoFile);
      const res = await api.post('/suppliers', fd);
      invalidateMoney(qc, [['suppliers'], ['suppliers-all'], ['suppliers-trash']]);
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      setPhotoFile(null);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? t('suppliers.msg.created'));
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, t('common:error.failed_save'));
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(Object.values(fields)[0] ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('suppliers.msg.failed_create'));
    } finally {
      setIsSaving(false);
    }
  };

  const suppliers = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('suppliers.title')}</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <TrashLink href="/suppliers/trash" />
          )}
          <button onClick={() => { setForm({ ...EMPTY_FORM }); setFormError(''); setErrors({}); setPhotoFile(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
            <Plus size={16} /> {t('suppliers.add')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('suppliers.search_placeholder')}
            className="w-full ps-9 pe-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('common:field.all_types', 'All Types')}</option>
          {supplierTypes.map(st => (
            <option key={st.id} value={String(st.id)}>{st.label}</option>
          ))}
        </select>
        <ShowInactiveFilter checked={showInactive} onChange={v => { setShowInactive(v); setPage(1); }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="h-10 w-10 bg-slate-100 rounded-full mb-3" />
            <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        )) : suppliers.map(s => (
          <div key={s.id} className="relative bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {s.photo_url
                  ? <img src={s.photo_url} alt={s.name} loading="lazy" className="w-10 h-10 shrink-0 rounded-full object-cover" />
                  : <div className="w-10 h-10 shrink-0 rounded-full bg-slate-100 flex items-center justify-center"><User size={18} className="text-slate-400" /></div>
                }
                <div className="min-w-0">
                  {/* The name's link stretches over the whole card, so a tap anywhere opens the supplier. */}
                  <Link href={`/suppliers/${s.id}`}
                    className="block font-semibold text-slate-800 text-sm break-words hover:text-blue-600 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-blue-500">
                    {s.name}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_COLOR}`}>
                    {s.supplier_type?.label ?? s.supplier_type?.name ?? '—'}
                  </span>
                </div>
              </div>
              <div className="relative z-10 flex gap-1 shrink-0">
                <button onClick={() => router.push(`/suppliers/${s.id}`)} aria-label={t('common:btn.view')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Eye size={14} /></button>
                {isSuperAdmin && (
                  <button onClick={() => setDeleteTarget(s)} aria-label={t('common:btn.move_to_trash')}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
            {s.phone && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <Phone size={11} /> {s.phone}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
              <p className="text-slate-400">{t('suppliers.total_due')}</p>
              <p className="font-semibold text-slate-700">{fmtMoney(s.balance ?? 0)}</p>
            </div>
          </div>
        ))}
        {!isLoading && suppliers.length === 0 && (isError
          ? <LoadError onRetry={() => refetch()} retrying={isFetching} className="col-span-full" />
          : <div className="col-span-full py-12 text-center text-slate-400">{search || typeFilter || showInactive ? t('common:table.no_results') : t('suppliers.empty')}</div>)}
      </div>

      {(data?.total ?? 0) > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{t('common:pagination.page_of', { current: page, total: data?.last_page ?? 1 })} &bull; {t('common:pagination.total_count', { count: data?.total ?? 0 })}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.prev')}</button>
            <button disabled={page >= (data?.last_page ?? 1)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.next')}</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common:btn.move_to_trash')}
        message={deleteTarget?.name ? t('finance:ui.confirm_trash_named', { name: deleteTarget.name }) : t('common:confirm.trash_restorable')}
        confirmLabel={t('common:btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} dirty={dirty} title={t('suppliers.add')}
        footer={<>
          <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={15} /> {t('suppliers.btn.save')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, KNOWN)} />
          <Field name="name" label={t('suppliers.field.name')} required error={errors.name}>
            <input id={fieldId('name')} value={form.name} dir="auto" data-autofocus onChange={e => set('name', e.target.value)} className={fieldClass(errors.name)} />
          </Field>
          <FormRow>
            <Field name="supplier_type_id" label={t('common:field.type')} required error={errors.supplier_type_id}>
              <SearchSelect id={fieldId('supplier_type_id')} value={form.supplier_type_id} onChange={v => set('supplier_type_id', v)}
                label={t('common:field.type')} placeholder={t('suppliers.field.select_type_placeholder')} error={errors.supplier_type_id}
                options={supplierTypes.map(st => ({ value: String(st.id), label: st.label ?? st.name }))} />
            </Field>
            <Field name="phone" label={t('suppliers.field.phone')} error={errors.phone}>
              <input id={fieldId('phone')} type="tel" inputMode="tel" dir="ltr" value={form.phone} onChange={e => set('phone', e.target.value)} className={fieldClass(errors.phone)} />
            </Field>
            <Field name="email" label={t('suppliers.field.email')} error={errors.email}>
              <input id={fieldId('email')} type="email" dir="ltr" value={form.email} onChange={e => set('email', e.target.value)} className={fieldClass(errors.email)} />
            </Field>
            <Field name="opening_balance" label={t('suppliers.field.opening_balance')} error={errors.opening_balance}>
              <NumberInput id={fieldId('opening_balance')} value="0.00" onChange={() => {}} prefix="৳" disabled readOnly />
            </Field>
          </FormRow>
          <Field name="address" label={t('suppliers.field.address')} error={errors.address}>
            <textarea id={fieldId('address')} rows={2} dir="auto" value={form.address} onChange={e => set('address', e.target.value)} className={fieldClass(errors.address)} />
          </Field>
          <Field name="notes" label={t('suppliers.field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={form.notes} onChange={e => set('notes', e.target.value)} className={fieldClass(errors.notes)} />
          </Field>
          <Field name="photo" label={t('common:field.photo')} error={errors.photo}>
            <FileAttachInput file={photoFile} onChange={setPhotoFile} accept="image/*"
              labels={{ upload: t('common:btn.upload_file'), change: t('common:btn.change_file'), remove: t('common:btn.remove_file') }} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
