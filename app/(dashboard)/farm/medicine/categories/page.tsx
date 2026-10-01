'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MedicineCategory } from '@/types';
import { Plus, Check, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import DynamicTable from '@/components/ui/DynamicTable';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import TrashLink from '@/components/ui/TrashLink';
import { deletedMsg, failedMsg, savedMsg } from '@/lib/feedback';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import PageTitle from '@/components/ui/PageTitle';

const medicineCategoriesApi = createCrudService<MedicineCategory, { categories: MedicineCategory[] }>('/farm/medicine/categories');
const medicineCategoriesKeys = createResourceKeys('medicine-categories');
const FORM_ID = 'medicine-category-form';

export default function MedicineCategoriesPage() {
  const { t } = useTranslation('medicine');
  const toast = useToast();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MedicineCategory | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [opened, setOpened] = useState('');
  const dirty = showModal && JSON.stringify(form) !== opened;
  useScrollToError(errors, formError);

  const resource = useCrudResource(medicineCategoriesApi, medicineCategoriesKeys, {
    extraInvalidateKeys: [['medicine-categories-trash']],
  });
  const { data, isLoading } = resource.useList();
  const createMutation = resource.useCreate();
  const updateMutation = resource.useUpdate();
  const deleteMutation = resource.useRemove();

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
    setOpened(JSON.stringify({ name: '', description: '' }));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (cat: MedicineCategory) => {
    setEditing(cat);
    const f = { name: cat.name ?? '', description: cat.description ?? '' };
    setForm(f);
    setOpened(JSON.stringify(f));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t('common:form.v.required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    setErrors({});
    try {
      const res = editing
        ? await updateMutation.mutateAsync({ id: editing.id, payload: form })
        : await createMutation.mutateAsync(form);
      toast.success(res.message ?? savedMsg());
      closeModal();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
      toast.error(Object.values(fields)[0] ?? message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget === null) return;
    try {
      const res = await deleteMutation.mutateAsync(deleteTarget);
      toast.success(res.message ?? deletedMsg());
      setDeleteTarget(null);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? t('common:error.failed_delete'));
      setDeleteTarget(null);
    }
  };

  const categories = data?.categories ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const cols: ColDef<MedicineCategory>[] = [
    { key: 'name', labelKey: 'medicine:categories.col.name', align: 'left', render: cat => <span className="font-medium text-slate-700">{cat.name}</span> },
    {
      key: 'description', labelKey: 'medicine:categories.col.description', align: 'left',
      render: cat => <span className="text-slate-400 text-xs">{cat.description || '—'}</span>,
    },
    {
      key: 'medicines_count', labelKey: 'medicine:categories.col.medicines', align: 'right',
      render: cat => (
        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{cat.medicines_count ?? 0} medicines</span>
      ),
    },
    {
      key: '_actions', labelKey: 'common:actions', align: 'right',
      render: cat => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(cat)} aria-label={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={14} /></button>
          {isSuperAdmin && (
            <button onClick={() => setDeleteTarget(cat.id)} aria-label={t('common:btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <PageTitle title={t('categories.title')} subtitle={t('categories.subtitle')} />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <TrashLink href="/farm/medicine/categories/trash" />
          )}
          <button onClick={openCreate} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
            <Plus size={16} /> {t('categories.add')}
          </button>
        </div>
      </div>

      <DynamicTable
        cols={cols}
        data={categories}
        isLoading={isLoading}
        keyExtractor={cat => cat.id}
        emptyKey="medicine:categories.empty"
      />

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="md"
        title={editing ? t('categories.edit_title') : t('categories.create_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={14} /> {editing ? t('common:btn.update') : t('common:btn.create')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, ['name', 'description'])} />
          <Field name="name" label={t('categories.col.name')} required error={errors.name}>
            <input
              id={fieldId('name')}
              className={fieldClass(errors.name)}
              value={form.name}
              data-autofocus
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: '' })); }}
            />
          </Field>
          <Field name="description" label={t('common:field.description')} error={errors.description}>
            <textarea
              id={fieldId('description')}
              className={fieldClass(errors.description)}
              rows={3}
              value={form.description}
              onChange={e => { setForm(p => ({ ...p, description: e.target.value })); setErrors(p => ({ ...p, description: '' })); }}
            />
          </Field>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('categories.delete_title', { defaultValue: 'Delete Category' })}
        message={t('categories.delete_message', { defaultValue: 'Are you sure you want to delete this category? This action cannot be undone.' })}
        confirmLabel={t('common:btn.delete')}
        cancelLabel={t('common:btn.cancel')}
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
