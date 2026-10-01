'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FeedCategory, PaginatedResponse } from '@/types';
import { Plus, Check, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
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

const feedCategoriesApi = createCrudService<FeedCategory>('/farm/feed/categories');
const feedCategoriesKeys = createResourceKeys('feed-categories');
const FORM_ID = 'feed-category-form';

export default function FeedCategoriesPage() {
  const { t } = useTranslation('feed');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FeedCategory | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [opened, setOpened] = useState('');
  const dirty = showModal && JSON.stringify(form) !== opened;
  useScrollToError(errors, formError);

  const resource = useCrudResource<FeedCategory, PaginatedResponse<FeedCategory> & { data: FeedCategory[] }>(feedCategoriesApi, feedCategoriesKeys, {
    extraInvalidateKeys: [['feed-categories-all'], ['feed-categories-trash']],
  });
  const { data, isLoading } = resource.useList({ ...sorting.params, page, per_page: 20 });
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

  const openEdit = (cat: FeedCategory) => {
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
    if (!form.name.trim()) e.name = t('categories.error.name_required');
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

  const categories = data?.data ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const cols: ColDef<FeedCategory>[] = [
    { key: 'name', labelKey: 'feed:categories.col.name', align: 'left', sortKey: 'name', sortType: 'text', render: cat => <span className="font-medium text-slate-700">{cat.name}</span> },
    {
      key: 'description', labelKey: 'feed:categories.col.description', align: 'left',
      render: cat => <span className="text-slate-400 text-xs">{cat.description || '—'}</span>,
    },
    {
      key: 'items_count', labelKey: 'feed:categories.col.items', align: 'right', sortKey: 'items_count', sortType: 'number',
      render: cat => (
        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
          {t('categories.label.items_count', { count: cat.items_count ?? 0 })}
        </span>
      ),
    },
    {
      key: '_actions', labelKey: 'common:actions', align: 'right',
      render: cat => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(cat)} aria-label={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={14} /></button>
          {isSuperAdmin && (
            <button onClick={() => setDeleteTarget(cat.id)} aria-label={t('common:btn.move_to_trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('categories.title')}</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <TrashLink href="/farm/feed/categories/trash" />
          )}
          <button onClick={openCreate} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
            <Plus size={16} /> {t('categories.add')}
          </button>
        </div>
      </div>

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={20}
        data={categories}
        isLoading={isLoading}
        keyExtractor={cat => cat.id}
        emptyKey="feed:categories.empty"
        currentPage={page}
        lastPage={data?.last_page ?? 1}
        totalCount={data?.total}
        onPageChange={setPage}
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
        title={tc('btn.move_to_trash')}
        message={t('categories.confirm.move_trash_message')}
        confirmLabel={tc('btn.move_to_trash')}
        cancelLabel={tc('btn.cancel')}
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
