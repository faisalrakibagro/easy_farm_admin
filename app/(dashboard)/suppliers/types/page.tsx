'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SupplierType } from '@/types';
import { Plus, Check, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import DynamicTable from '@/components/ui/DynamicTable';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import { deleteFailedMsg, failedMsg, savedMsg } from '@/lib/feedback';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

const EMPTY_FORM = { name: '', notes: '' };
const FORM_ID = 'supplier-type-form';

const supplierTypesApi = createCrudService<SupplierType, { supplier_types: SupplierType[] }>('/supplier-types');
const supplierTypesKeys = createResourceKeys('supplier-types');

export default function SupplierTypesPage() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { hasRole } = useAuth();
  const toast = useToast();
  const isSuperAdmin = hasRole('Super Admin');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SupplierType | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [snap, setSnap] = useState('');
  useScrollToError(errors, formError);
  const [deleteTarget, setDeleteTarget] = useState<SupplierType | null>(null);

  const resource = useCrudResource(supplierTypesApi, supplierTypesKeys, {
    extraInvalidateKeys: [['suppliers-all']],
  });
  const { data, isLoading, isError, refetch } = resource.useList();
  const types = data?.supplier_types ?? [];

  const saveMutation = resource.useUpdate();
  const createMutation = resource.useCreate();
  const deleteMutation = resource.useRemove({
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? deleteFailedMsg());
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setSnap(JSON.stringify(EMPTY_FORM));
    setErrors({});
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (st: SupplierType) => {
    setEditing(st);
    const next = { name: st.label, notes: st.notes ?? '' };
    setForm(next);
    setSnap(JSON.stringify(next));
    setErrors({});
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('supplier_types.error.label_required');
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    try {
      const res = editing
        ? await saveMutation.mutateAsync({ id: editing.id, payload: form })
        : await createMutation.mutateAsync(form);
      toast.success(res.message ?? savedMsg());
      closeModal();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const apiErrors = err.response?.data?.errors ?? {};
      const mapped: Record<string, string> = {};
      Object.entries(apiErrors).forEach(([k, v]) => { mapped[k] = v[0]; });
      if (Object.keys(mapped).length) setErrors(mapped);
      else {
        setFormError(err.response?.data?.message ?? failedMsg());
        toast.error(err.response?.data?.message ?? failedMsg());
      }
    }
  };

  const isSaving = saveMutation.isPending || createMutation.isPending;

  const cols: ColDef<SupplierType>[] = [
    {
      key: 'label', labelKey: 'settings:supplier_types.col.label', align: 'left',
      render: st => (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{st.label}</span>
      ),
    },
    { key: 'notes', labelKey: 'settings:supplier_types.col.notes', align: 'left', render: st => <span className="text-slate-500 text-xs">{st.notes ?? '—'}</span> },
    ...(isSuperAdmin ? [{
      key: '_actions', labelKey: 'common:actions', align: 'right' as const,
      render: (st: SupplierType) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(st)} aria-label={tc('btn.edit')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Pencil size={14} /></button>
          <button onClick={() => setDeleteTarget(st)} aria-label={tc('btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('supplier_types.title')}</h1>
        {isSuperAdmin && (
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
            <Plus size={16} /> {t('supplier_types.add')}
          </button>
        )}
      </div>

      <DynamicTable
        cols={cols}
        data={types}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        keyExtractor={st => st.id}
        emptyKey="settings:supplier_types.empty"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('supplier_types.confirm_delete_title')}
        message={t('supplier_types.confirm_delete_message', { label: deleteTarget?.label ?? '' })}
        confirmLabel={tc('btn.delete')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={JSON.stringify(form) !== snap} size="sm"
        title={editing ? t('supplier_types.modal.edit_title') : t('supplier_types.modal.create_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{tc('btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={15} /> {editing ? tc('btn.update') : tc('btn.create')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, ['name', 'notes'])} />
          <Field name="name" label={t('supplier_types.field.label')} required error={errors.name}>
            <input id={fieldId('name')} data-autofocus dir="auto" value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(p => ({ ...p, name: '' })); }}
              placeholder={t('supplier_types.field.label_placeholder')} className={fieldClass(errors.name)} />
          </Field>
          <Field name="notes" label={t('supplier_types.field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={3} dir="auto" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={t('supplier_types.field.notes_placeholder')} className={fieldClass(errors.notes, 'resize-none')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
