'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import Link from '@/components/ui/AppLink';
import { Plus, Pencil, Trash2, Search, Dna, ToggleLeft, ToggleRight } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import type { PaginatedResponse } from '@/types';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import PageTitle from '@/components/ui/PageTitle';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

interface Breed {
  id: number;
  name: string;
  is_active: boolean;
}

const breedsApi = createCrudService<Breed>('/farm/breeds');
const breedsKeys = createResourceKeys('breeds-page');
const FORM_ID = 'breed-form';

export default function BreedsPage() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Breed | null>(null);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Breed | null>(null);
  const [opened, setOpened] = useState('');
  const dirty = showModal && name !== opened;
  useScrollToError(errors, formError);

  const resource = useCrudResource<Breed, PaginatedResponse<Breed>>(breedsApi, breedsKeys, {
    extraInvalidateKeys: [['farm-breeds'], ['breeds-trash']],
  });
  const { data, isLoading } = resource.useList({ ...sorting.params, page, search: search || undefined, per_page: 15 });
  const createMutation = resource.useCreate();
  const updateMutation = resource.useUpdate();
  const deleteMutation = resource.useRemove();
  const toggleMutation = resource.useToggleStatus({
    onSuccess: () => toast.success(savedMsg()),
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    },
  });

  const openCreate = () => {
    setEditing(null);
    setName('');
    setOpened('');
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (breed: Breed) => {
    setEditing(breed);
    setName(breed.name);
    setOpened(breed.name);
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); setName(''); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('master_data.breeds.error.name_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    setErrors({});
    try {
      if (editing) {
        const res = await updateMutation.mutateAsync({ id: editing.id, payload: { name } });
        toast.success(res.message ?? savedMsg());
      } else {
        const res = await createMutation.mutateAsync({ name });
        toast.success(res.message ?? savedMsg());
      }
      closeModal();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, tc('error.generic'));
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
      toast.error(failedMsg());
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(res.message ?? trashedMsg());
      setDeleteTarget(null);
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    }
  };

  const breeds = data?.data ?? [];
  const meta = data;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const cols: ColDef<Breed>[] = [
    {
      key: 'name', labelKey: 'settings:master_data.breeds.col.name', align: 'left', sortKey: 'name', sortType: 'text',
      render: breed => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Dna size={15} className="text-blue-500" />
          </div>
          <span className="font-medium text-slate-700">{breed.name}</span>
        </div>
      ),
    },
    {
      key: 'is_active', labelKey: 'settings:master_data.breeds.col.status', align: 'center',
      render: breed => (
        <button
          onClick={() => toggleMutation.mutate(breed.id)}
          className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
            breed.is_active ? 'text-green-600 hover:text-green-700' : 'text-slate-400 hover:text-slate-500'
          }`}
        >
          {breed.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {breed.is_active ? tc('status.active') : tc('status.inactive')}
        </button>
      ),
    },
    {
      key: '_actions', labelKey: 'common:actions', align: 'right',
      render: breed => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(breed)} aria-label={tc('btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={14} /></button>
          {isSuperAdmin && (
            <button onClick={() => setDeleteTarget(breed)} aria-label={tc('btn.trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <PageTitle title={t('master_data.breeds.title')} subtitle={t('master_data.breeds.subtitle')} />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <Link
              href="/farm/master-data/breeds/trash"
              className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center"
            >
              <Trash2 size={15} /> {tc('btn.trash')}
            </Link>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center"
          >
            <Plus size={16} /> {t('master_data.breeds.add')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('master_data.breeds.search_placeholder')}
          className="w-full ps-9 pe-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={breeds}
        isLoading={isLoading}
        keyExtractor={breed => breed.id}
        emptyKey="settings:master_data.breeds.empty"
        currentPage={page}
        lastPage={meta?.last_page ?? 1}
        totalCount={meta?.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('confirm.move_trash')}
        message={t('master_data.breeds.confirm.move_trash')}
        confirmLabel={tc('btn.trash')}
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="sm"
        title={editing ? t('master_data.breeds.modal.edit_title') : t('master_data.breeds.modal.create_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{tc('btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            {isSaving ? tc('status.loading') : (editing ? tc('btn.update') : tc('btn.create'))}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, ['name'])} />
          <Field name="name" label={t('master_data.breeds.field.name')} required error={errors.name}
            hint={t('master_data.breeds.field.name_hint')}>
            <input
              id={fieldId('name')}
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
              data-autofocus
              placeholder={t('master_data.breeds.field.placeholder')}
              className={fieldClass(errors.name)}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
