'use client';

import { useState } from 'react';
import Link from '@/components/ui/AppLink';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { MediaCategory } from '@/types';
import { Plus, Edit2, Trash2, Tag, ArchiveRestore } from 'lucide-react';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import NumberInput from '@/components/ui/NumberInput';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import FormRow from '@/components/ui/FormRow';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

interface CategoryForm {
  name: string; description: string; order: number; is_active: boolean;
}

const EMPTY_FORM: CategoryForm = { name: '', description: '', order: 0, is_active: true };

const mediaCategoriesApi = createCrudService<MediaCategory, { categories: MediaCategory[]; last_page?: number; total?: number }>('/media/categories');
const mediaCategoriesKeys = createResourceKeys('media-categories');
const FORM_ID = 'media-category-form';

export default function MediaCategoriesPage() {
  const { t } = useTranslation('media');
  const toast = useToast();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [modal,  setModal]  = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<MediaCategory | null>(null);
  const [form,   setForm]   = useState<CategoryForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MediaCategory | null>(null);
  const [opened, setOpened] = useState('');
  const dirty = !!modal && JSON.stringify(form) !== opened;
  useScrollToError(errors, formError);
  const setField = <K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(p => ({ ...p, [key]: '' }));
  };

  const resource = useCrudResource(mediaCategoriesApi, mediaCategoriesKeys, {
    extraInvalidateKeys: [['media-categories-trash']],
  });
  const { data, isLoading } = resource.useList({ ...sorting.params, page, per_page: 15 });
  const createMutation = resource.useCreate();
  const updateMutation = resource.useUpdate();
  const deleteMutation = resource.useRemove({
    onSuccess: (res) => { toast.success(res.message ?? trashedMsg()); },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    },
  });

  const openCreate = () => {
    setForm(EMPTY_FORM); setOpened(JSON.stringify(EMPTY_FORM)); setErrors({}); setFormError(''); setModal('create');
  };
  const openEdit   = (cat: MediaCategory) => {
    setEditing(cat);
    const f = { name: cat.name ?? '', description: cat.description ?? '', order: cat.order, is_active: cat.is_active };
    setForm(f);
    setOpened(JSON.stringify(f));
    setErrors({});
    setFormError('');
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setErrors({ name: t('common:form.v.required') }); return; }
    setErrors({});
    setFormError('');
    try {
      if (modal === 'create') {
        const res = await createMutation.mutateAsync({ ...form });
        toast.success(res.message ?? savedMsg());
      } else if (editing) {
        const res = await updateMutation.mutateAsync({ id: editing.id, payload: { ...form } });
        toast.success(res.message ?? savedMsg());
      }
      closeModal();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
      toast.error(Object.values(fields)[0] ?? message);
    }
  };

  const categories = data?.categories ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const cols: ColDef<MediaCategory>[] = [
    {
      key: 'name', labelKey: 'media:categories.col.name', align: 'left', sortKey: 'name', sortType: 'text',
      render: cat => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Tag size={14} className="text-blue-500" />
          </div>
          <div>
            <p className="font-medium text-slate-700">{cat.name}</p>
            <p className="text-xs text-slate-400">/{cat.slug}</p>
          </div>
        </div>
      ),
    },
    { key: 'description', labelKey: 'media:categories.col.description', align: 'left', render: cat => <span className="text-slate-500 line-clamp-1">{cat.description ?? '—'}</span> },
    {
      key: 'media_count', labelKey: 'media:categories.col.files', align: 'left',
      render: cat => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          {t('categories.files_count', { count: cat.media_count ?? 0 })}
        </span>
      ),
    },
    {
      key: 'is_active', labelKey: 'media:categories.col.status', align: 'left',
      render: cat => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          cat.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {cat.is_active ? t('common:status.active') : t('common:status.inactive')}
        </span>
      ),
    },
    { key: 'order', labelKey: 'media:categories.col.order', align: 'left', render: cat => <span className="text-slate-500">{cat.order}</span> },
    {
      key: '_actions', labelKey: 'common:actions', align: 'right',
      render: cat => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(cat)} aria-label={t('common:btn.edit')} className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg hover:bg-blue-50">
            <Edit2 size={14} />
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setDeleteTarget(cat)}
              disabled={deleteMutation.isPending}
              aria-label={t('common:btn.delete')}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"
            ><Trash2 size={14} /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500">{t('categories.count', { count: categories.length })}</p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            href="/media/categories/trash"
            className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-1 sm:flex-none justify-center"
          >
            <ArchiveRestore size={16} /> {t('common:btn.trash')}
          </Link>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-1 sm:flex-none justify-center"
          >
            <Plus size={16} /> {t('categories.new')}
          </button>
        </div>
      </div>

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={categories}
        isLoading={isLoading}
        keyExtractor={cat => cat.id}
        emptyKey="media:categories.empty"
        currentPage={page}
        lastPage={data?.last_page ?? 1}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      <Modal open={!!modal} onClose={closeModal} dirty={dirty} size="md"
        title={modal === 'create' ? t('categories.modal_create') : t('categories.modal_edit')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            {isSaving ? t('common:status.loading') : t('common:btn.save')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, ['name', 'description', 'order', 'is_active'])} />
          <Field name="name" label={t('common:field.name')} required error={errors.name}>
            <input
              id={fieldId('name')}
              value={form.name}
              data-autofocus
              onChange={e => setField('name', e.target.value)}
              placeholder={t('categories.placeholder_name')}
              className={fieldClass(errors.name)}
            />
          </Field>
          <Field name="description" label={t('common:field.description')} error={errors.description}>
            <textarea
              id={fieldId('description')}
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              rows={2}
              placeholder={t('categories.placeholder_description')}
              className={fieldClass(errors.description)}
            />
          </Field>
          <FormRow>
            <Field name="order" label={t('common:field.order')} error={errors.order}>
              <NumberInput
                id={fieldId('order')}
                value={String(form.order)}
                onChange={v => setField('order', parseInt(v) || 0)}
                allowDecimal={false}
                error={errors.order}
              />
            </Field>
            <Field name="is_active" label={t('common:field.status')} error={errors.is_active}>
              <select
                id={fieldId('is_active')}
                value={form.is_active ? 'active' : 'inactive'}
                onChange={e => setField('is_active', e.target.value === 'active')}
                className={fieldClass(errors.is_active)}
              >
                <option value="active">{t('common:status.active')}</option>
                <option value="inactive">{t('common:status.inactive')}</option>
              </select>
            </Field>
          </FormRow>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common:btn.delete')}
        message={t('categories.confirm_delete', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common:btn.delete')}
        cancelLabel={t('common:btn.cancel')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) })}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
