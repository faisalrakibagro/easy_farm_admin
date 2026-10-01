'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Unit } from '@/types';
import { Plus, Check, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import DynamicTable from '@/components/ui/DynamicTable';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import PageTitle from '@/components/ui/PageTitle';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { deletedMsg, savedMsg } from '@/lib/feedback';

const unitsApi = createCrudService<Unit, { units: Unit[] }>('/farm/units');
const unitsKeys = createResourceKeys('units');
const FORM_ID = 'unit-form';

export default function UnitsPage() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [form, setForm] = useState({ name: '', symbol: '' });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [opened, setOpened] = useState('');
  const dirty = showModal && JSON.stringify({ form, isActive }) !== opened;
  useScrollToError(errors, formError);

  const resource = useCrudResource(unitsApi, unitsKeys, {
    // Same Unit table backs the by-product unit picker ('units-all' was never read).
    extraInvalidateKeys: [['byproducts', 'units']],
  });
  const { data, isLoading } = resource.useList();
  const createMutation = resource.useCreate();
  const updateMutation = resource.useUpdate();
  const deleteMutation = resource.useRemove();

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', symbol: '' });
    setIsActive(true);
    setOpened(JSON.stringify({ form: { name: '', symbol: '' }, isActive: true }));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (u: Unit) => {
    setEditing(u);
    const f = { name: u.name ?? '', symbol: u.symbol ?? '' };
    setForm(f);
    setIsActive(u.is_active);
    setOpened(JSON.stringify({ form: f, isActive: u.is_active }));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t('common:form.v.required');
    if (!form.symbol.trim()) e.symbol = t('common:form.v.required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    setErrors({});
    const payload = { ...form, is_active: isActive };
    try {
      const res = editing
        ? await updateMutation.mutateAsync({ id: editing.id, payload })
        : await createMutation.mutateAsync(payload);
      toast.success(res.message ?? savedMsg());
      closeModal();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, t('common:error.failed_save'));
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
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

  const units = data?.units ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const cols: ColDef<Unit>[] = [
    { key: 'name', labelKey: 'units:col.name', align: 'left', render: u => <span className="font-medium text-slate-700">{u.name}</span> },
    {
      key: 'symbol', labelKey: 'units:col.symbol', align: 'left',
      render: u => <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{u.symbol}</span>,
    },
    {
      key: 'is_active', labelKey: 'units:col.status', align: 'center',
      render: u => (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-slate-400'}`}>
          {u.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {u.is_active ? t('common:status.active') : t('common:status.inactive')}
        </span>
      ),
    },
    {
      key: '_actions', labelKey: 'common:actions', align: 'right',
      render: u => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(u)} aria-label={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={14} /></button>
          {isSuperAdmin && (
            <button onClick={() => setDeleteTarget(u.id)} aria-label={t('common:btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <PageTitle title={t('units:title')} subtitle={t('units:subtitle')} />
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center"
        >
          <Plus size={16} /> {t('units:add')}
        </button>
      </div>

      <DynamicTable
        cols={cols}
        data={units}
        isLoading={isLoading}
        keyExtractor={u => u.id}
        emptyKey="units:empty"
      />

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="sm"
        title={editing ? t('units:edit_title') : t('units:create_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={14} />
            {editing ? t('common:btn.update') : t('common:btn.create')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, ['name', 'symbol'])} />
          <Field name="name" label={t('units:col.name')} required error={errors.name}>
            <input
              id={fieldId('name')}
              className={fieldClass(errors.name)}
              value={form.name}
              data-autofocus
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: '' })); }}
            />
          </Field>
          <Field name="symbol" label={t('units:col.symbol')} required error={errors.symbol}>
            <input
              id={fieldId('symbol')}
              className={fieldClass(errors.symbol)}
              value={form.symbol}
              onChange={e => { setForm(p => ({ ...p, symbol: e.target.value })); setErrors(p => ({ ...p, symbol: '' })); }}
            />
          </Field>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-500"
            />
            {t('common:status.active')}
          </label>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('units:delete_title', { defaultValue: 'Delete Unit' })}
        message={t('units:delete_message', { defaultValue: 'Are you sure you want to delete this unit? This action cannot be undone.' })}
        confirmLabel={t('common:btn.delete')}
        cancelLabel={t('common:btn.cancel')}
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
