'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Pencil, Trash2, Check, Lock } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import DynamicTable from '@/components/ui/DynamicTable';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { MONEY_KEYS } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import TrashLink from '@/components/ui/TrashLink';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import { accountName } from '@/lib/accountNames';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

const FORM_ID = 'accounting-account';

interface Account {
  id: number; code: string; name: string; type: 'income' | 'expense';
  description: string | null; is_system: boolean; is_active: boolean;
}

interface AccountForm { code: string; type: 'income' | 'expense'; description: string; name: string; }

const DEFAULT: AccountForm = { code: '', type: 'expense', description: '', name: '' };

const accountsApi = createCrudService<Account, { accounts: Account[] }>('/accounting/accounts');
const accountsKeys = createResourceKeys('accounting-accounts');

export default function AccountsPage() {
  const { t } = useTranslation('finance');
  const { t: tc } = useTranslation('common');
  const { hasPermission, hasRole } = useAuth();
  const toast = useToast();
  const canManage = hasPermission('accounting.manage');
  const isSuperAdmin = hasRole('Super Admin');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountForm>(DEFAULT);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [snap, setSnap] = useState('');
  useScrollToError(errors, formError);

  const set = <K extends keyof AccountForm>(key: K, value: AccountForm[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  const resource = useCrudResource(accountsApi, accountsKeys, {
    extraInvalidateKeys: [...MONEY_KEYS, ['accounting-accounts-trash']],
  });
  const { data, isLoading, isError, refetch } = resource.useList({ type: typeFilter || undefined });
  const createMutation = resource.useCreate();
  const updateMutation = resource.useUpdate();
  const deleteMutation = resource.useRemove({
    onSuccess: (res) => {
      setDeleteTarget(null);
      toast.success(res.message ?? trashedMsg());
    },
    onError: (e: unknown) => { const err = e as { response?: { data?: { message?: string } } }; toast.error(err.response?.data?.message ?? failedMsg()); },
  });

  function openCreate() { setEditing(null); setForm(DEFAULT); setSnap(JSON.stringify(DEFAULT)); setFormError(''); setErrors({}); setShowModal(true); }
  function openEdit(a: Account) {
    setEditing(a);
    const next: AccountForm = { code: a.code, type: a.type, description: a.description ?? '', name: a.name };
    setForm(next);
    setSnap(JSON.stringify(next));
    setFormError(''); setErrors({});
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditing(null); setErrors({}); }

  function validate() {
    const e: Record<string, string> = {};
    if (!editing && !form.code.trim()) e.code = t('common:form.v.required');
    if (!form.name.trim()) e.name = t('common:form.v.required');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    try {
      if (editing) {
        const res = await updateMutation.mutateAsync({ id: editing.id, payload: { name: form.name, description: form.description } });
        toast.success(res.message ?? savedMsg());
      } else {
        const res = await createMutation.mutateAsync({ name: form.name, code: form.code, type: form.type, description: form.description });
        toast.success(res.message ?? savedMsg());
      }
      closeModal();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(Object.values(fields)[0] ?? message);
    }
  }

  const accounts = data?.accounts ?? [];
  const income  = accounts.filter(a => a.type === 'income');
  const expense = accounts.filter(a => a.type === 'expense');
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap gap-2">
          {['', 'income', 'expense'].map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg border font-medium ${typeFilter === f ? 'bg-blue-500 text-white border-blue-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {f === '' ? tc('filter.all') : t(`accounts.types.${f}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canManage && (
            <TrashLink href="/accounting/accounts/trash" />
          )}
          {canManage && (
            <button onClick={openCreate}
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <Plus size={16} /> {t('accounts.add')}
            </button>
          )}
        </div>
      </div>

      <div className="@container grid grid-cols-1 @lg:grid-cols-2 gap-5 [&>*]:min-w-0">
        <AccountSection title={t('accounts.income_accounts')} accounts={income} loading={isLoading}
          isError={isError} onRetry={() => refetch()} onEdit={openEdit} onDelete={account => setDeleteTarget(account)}
          canManage={canManage} isSuperAdmin={isSuperAdmin} color="green" />
        <AccountSection title={t('accounts.expense_accounts')} accounts={expense} loading={isLoading}
          isError={isError} onRetry={() => refetch()} onEdit={openEdit} onDelete={account => setDeleteTarget(account)}
          canManage={canManage} isSuperAdmin={isSuperAdmin} color="red" />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('btn.move_to_trash')}
        message={t('accounts.confirm_trash')}
        confirmLabel={tc('btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={JSON.stringify(form) !== snap} size="md"
        title={editing ? t('accounts.edit_title') : t('accounts.new_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={15} /> {editing ? t('common:btn.update') : t('common:btn.create')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={submit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, ['code', 'type', 'name', 'description'])} />
          {!editing && (
            <FormRow>
              <Field name="code" label={t('accounts.field.code')} required error={errors.code}>
                <input id={fieldId('code')} value={form.code} dir="ltr" data-autofocus placeholder="5009"
                  onChange={e => set('code', e.target.value)} className={fieldClass(errors.code)} />
              </Field>
              <Field name="type" label={t('accounts.field.type')} required error={errors.type}>
                <select id={fieldId('type')} value={form.type} onChange={e => set('type', e.target.value as 'income' | 'expense')}
                  className={fieldClass(errors.type)}>
                  <option value="income">{t('accounts.types.income')}</option>
                  <option value="expense">{t('accounts.types.expense')}</option>
                </select>
              </Field>
            </FormRow>
          )}
          <Field name="name" label={t('accounts.field.name')} required error={errors.name}>
            <input id={fieldId('name')} value={form.name} dir="auto" onChange={e => set('name', e.target.value)} className={fieldClass(errors.name)} />
          </Field>
          <Field name="description" label={t('accounts.field.notes')} error={errors.description}>
            <textarea id={fieldId('description')} rows={2} dir="auto" value={form.description}
              onChange={e => set('description', e.target.value)} className={fieldClass(errors.description)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function AccountSection({ title, accounts, loading, isError, onRetry, onEdit, onDelete, canManage, isSuperAdmin, color }: {
  title: string; accounts: Account[]; loading: boolean; isError: boolean; onRetry: () => void;
  onEdit: (a: Account) => void; onDelete: (a: Account) => void;
  canManage: boolean; isSuperAdmin: boolean; color: string;
}) {
  const { t } = useTranslation('finance');
  const hdr = color === 'green' ? 'text-green-700 border-green-100' : 'text-red-700 border-red-100';

  const cols: ColDef<Account>[] = [
    { key: 'code', labelKey: 'finance:accounts.col.code', align: 'left', render: a => <span className="font-mono text-xs text-slate-500">{a.code}</span> },
    {
      key: 'name', labelKey: 'common:field.name', align: 'left',
      render: a => (
        <span className="text-slate-800">
          {accountName(a, t)}
          {a.is_system && <Lock size={11} className="inline ms-1.5 text-slate-300" />}
        </span>
      ),
    },
    {
      key: 'is_active', labelKey: 'common:field.status', align: 'left',
      render: a => (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {a.is_active ? t('common:status.active') : t('common:status.inactive')}
        </span>
      ),
    },
    ...(canManage ? [{
      key: '_actions', labelKey: 'common:actions', align: 'right' as const,
      render: (a: Account) => (
        <div className="flex gap-1 justify-end">
          <button onClick={() => onEdit(a)} aria-label={t('common:btn.edit')} className="p-1.5 rounded hover:bg-blue-50 text-blue-400"><Pencil size={13} /></button>
          {isSuperAdmin && !a.is_system && (
            <button onClick={() => onDelete(a)} aria-label={t('common:btn.move_to_trash')} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className={`px-4 py-3 border-b ${hdr} font-semibold text-sm`}>{title}</div>
      <DynamicTable
        cols={cols}
        data={accounts}
        isLoading={loading}
        isError={isError}
        onRetry={onRetry}
        keyExtractor={a => a.id}
        emptyKey="finance:accounts.empty"
      />
    </div>
  );
}
