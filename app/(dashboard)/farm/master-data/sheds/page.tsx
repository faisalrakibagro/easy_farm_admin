'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Shed, PaginatedResponse } from '@/types';
import NumberInput from '@/components/ui/NumberInput';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import {
  Plus, Check, Pencil, Trash2, Search, Warehouse,
} from 'lucide-react';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import TrashLink from '@/components/ui/TrashLink';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import PageTitle from '@/components/ui/PageTitle';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtNum } from '@/lib/format';

const shedsApi = createCrudService<Shed>('/farm/sheds');
const shedsKeys = createResourceKeys('sheds');
const FORM_ID = 'shed-form';

export default function ShedsPage() {
  const { t } = useTranslation('settings');
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Shed | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Shed | null>(null);
  const [opened, setOpened] = useState('');
  const dirty = showModal && JSON.stringify([name, capacity, notes]) !== opened;
  useScrollToError(errors, formError);

  const resource = useCrudResource<Shed, PaginatedResponse<Shed>>(shedsApi, shedsKeys, {
    extraInvalidateKeys: [['sheds-all'], ['sheds-trash']],
  });
  const { data, isLoading } = resource.useList({ ...sorting.params, page, search: search || undefined, per_page: 15 });
  const createMutation = resource.useCreate();
  const updateMutation = resource.useUpdate();
  const deleteMutation = resource.useRemove();

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCapacity('');
    setNotes('');
    setOpened(JSON.stringify(['', '', '']));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (s: Shed) => {
    setEditing(s);
    setName(s.name ?? '');
    setCapacity(s.capacity?.toString() ?? '');
    setNotes(s.notes ?? '');
    setOpened(JSON.stringify([s.name ?? '', s.capacity?.toString() ?? '', s.notes ?? '']));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('master_data.sheds.error.name_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    setErrors({});
    const payload = {
      name,
      capacity: capacity ? parseInt(capacity) : null,
      notes: notes || null,
    };
    try {
      const res = editing
        ? await updateMutation.mutateAsync({ id: editing.id, payload })
        : await createMutation.mutateAsync(payload);
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
    if (!deleteTarget) return;
    try {
      const res = await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(res.message ?? trashedMsg());
      setDeleteTarget(null);
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    }
  };

  const sheds = data?.data ?? [];
  const meta = data;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const cols: ColDef<Shed>[] = [
    {
      key: 'name', labelKey: 'settings:master_data.sheds.col.name', align: 'left', sortKey: 'name', sortType: 'text',
      render: s => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Warehouse size={16} className="text-blue-500" />
          </div>
          <p className="font-medium text-slate-700">{s.name}</p>
        </div>
      ),
    },
    {
      key: 'capacity', labelKey: 'settings:master_data.sheds.col.capacity', align: 'center', sortKey: 'capacity', sortType: 'number',
      render: s => s.capacity != null
        ? <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{fmtNum(s.capacity)}</span>
        : <span className="text-slate-300 italic text-xs">—</span>,
    },
    {
      key: 'cattle_count', labelKey: 'settings:master_data.sheds.col.cattle_count', align: 'center', sortKey: 'cattle_count', sortType: 'number',
      render: s => <span className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded">{fmtNum(s.cattle_count ?? 0)}</span>,
    },
    {
      key: 'notes', labelKey: 'settings:master_data.sheds.col.notes', align: 'left',
      render: s => <span className="text-slate-500 text-xs">{s.notes || <span className="text-slate-300 italic">—</span>}</span>,
    },
    {
      key: '_actions', labelKey: 'common:actions', align: 'right',
      render: s => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(s)} aria-label={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={14} /></button>
          {isSuperAdmin && <button onClick={() => setDeleteTarget(s)} aria-label={t('common:btn.trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <PageTitle title={t('master_data.sheds.title')} subtitle={t('master_data.sheds.subtitle')} />
        <div className="flex gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <TrashLink href="/farm/master-data/sheds/trash" />
          )}
          <button onClick={openCreate} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
            <Plus size={16} /> {t('master_data.sheds.add')}
          </button>
        </div>
      </div>

      <div className="relative w-full max-w-sm">
        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('master_data.sheds.search_placeholder')}
          className="w-full ps-9 pe-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={sheds}
        isLoading={isLoading}
        keyExtractor={s => s.id}
        emptyKey="settings:master_data.sheds.empty"
        currentPage={page}
        lastPage={meta?.last_page ?? 1}
        totalCount={meta?.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common:confirm.move_trash')}
        message={t('master_data.sheds.confirm.move_trash_message', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common:btn.trash')}
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="md"
        title={editing ? t('master_data.sheds.modal_edit') : t('master_data.sheds.modal_create')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={14} /> {editing ? t('common:btn.update') : t('common:btn.create')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, ['name', 'capacity', 'notes'])} />
          <Field name="name" label={t('master_data.sheds.field.name')} required error={errors.name}>
            <input
              id={fieldId('name')}
              className={fieldClass(errors.name)}
              value={name}
              data-autofocus
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
            />
          </Field>
          <Field name="capacity" label={t('master_data.sheds.field.capacity')} error={errors.capacity}>
            <NumberInput
              id={fieldId('capacity')}
              value={capacity}
              onChange={v => { setCapacity(v); setErrors(p => ({ ...p, capacity: '' })); }}
              allowDecimal={false}
              placeholder={t('master_data.sheds.field.capacity_placeholder')}
              error={errors.capacity}
            />
          </Field>
          <Field name="notes" label={t('master_data.sheds.field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className={fieldClass(errors.notes, 'resize-none')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
