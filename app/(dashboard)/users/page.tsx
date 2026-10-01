'use client';

import { useState } from 'react';
import Link from '@/components/ui/AppLink';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types';
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight, Check, ArchiveRestore, KeyRound, Eye, EyeOff, MessageCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import SearchSelect from '@/components/ui/SearchSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { useToast } from '@/components/ui/Toast';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import { roleLabel } from '@/lib/permissionLabels';
import { localeFor } from '@/lib/languages';

const DASHBOARD_SECTION_KEYS = [
  { key: 'dashboard-sections.financials',       tKey: 'users.dashboard_sections.financials' },
  { key: 'dashboard-sections.expenses',         tKey: 'users.dashboard_sections.expenses' },
  { key: 'dashboard-sections.top-cattle',       tKey: 'users.dashboard_sections.top_cattle' },
  { key: 'dashboard-sections.projected-profit', tKey: 'users.dashboard_sections.projected_profit' },
] as const;

interface UserFormData {
  name: string;
  email: string;
  whatsapp_phone: string;
  password: string;
  password_confirmation: string;
  role: string;
  is_active: boolean;
  dashboard_permissions: string[];
}

const DEFAULT_FORM: UserFormData = {
  name: '', email: '', whatsapp_phone: '', password: '', password_confirmation: '', role: 'User', is_active: true,
  dashboard_permissions: [],
};

const usersApi = createCrudService<User, { data: User[]; meta?: { current_page: number; last_page: number; per_page: number; total: number } }>('/users');
const usersKeys = createResourceKeys('users');
const USER_FORM_ID = 'user-form';
const RESET_FORM_ID = 'reset-password-form';
const USER_FIELDS = ['name', 'email', 'whatsapp_phone', 'password', 'password_confirmation', 'role', 'is_active', 'dashboard_permissions*'];

export default function UsersPage() {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPw, setResetPw] = useState({ password: '', password_confirmation: '' });
  const [resetPwErrors, setResetPwErrors] = useState<Record<string, string>>({});
  const [showResetNew, setShowResetNew] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [form, setForm] = useState<UserFormData>(DEFAULT_FORM);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formOpened, setFormOpened] = useState('');
  const formDirty = showModal && JSON.stringify(form) !== formOpened;
  const resetDirty = !!(resetPw.password || resetPw.password_confirmation);
  useScrollToError(errors, formError);
  useScrollToError(resetPwErrors);

  const resource = useCrudResource(usersApi, usersKeys, {
    extraInvalidateKeys: [['users-trash']],
  });
  const { data, isLoading } = resource.useList({ ...sorting.params, page, search, per_page: 10 });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/roles');
      return res.data.roles as { id: number; name: string }[];
    },
  });

  const createMutation = resource.useCreate({
    onSuccess: (res) => { closeModal(); toast.success(res.message ?? t('users.msg.created')); },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, t('users.msg.failed_create'));
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
      toast.error(message);
    },
  });

  const updateMutation = resource.useUpdate({
    onSuccess: (res) => { closeModal(); toast.success(res.message ?? t('users.msg.updated')); },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, t('users.msg.failed_update'));
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
      toast.error(message);
    },
  });

  const deleteMutation = resource.useRemove({
    onSuccess: (res) => { setDeleteTarget(null); toast.success(res.message ?? t('users.msg.moved_to_trash')); },
    onError: (e: unknown) => { toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('users.msg.failed_delete')); },
  });

  const resetPwMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof resetPw }) =>
      api.put(`/users/${id}/reset-password`, data),
    onSuccess: (res) => {
      toast.success((res as { data?: { message?: string } }).data?.message ?? t('users.reset_password.success'));
      setResetTarget(null);
      setResetPw({ password: '', password_confirmation: '' });
      setResetPwErrors({});
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const apiErrors = err.response?.data?.errors ?? {};
      const mapped: Record<string, string> = {};
      Object.entries(apiErrors).forEach(([k, v]) => { mapped[k] = v[0]; });
      if (!Object.keys(mapped).length) mapped._global = err.response?.data?.message ?? tc('ui.failed_try_again');
      setResetPwErrors(mapped);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/users/${id}/status`, { is_active }),
    onSuccess: () => { setDeactivateTarget(null); qc.invalidateQueries({ queryKey: usersKeys.all }); toast.success(t('users.msg.status_updated')); },
    onError: (e: unknown) => { setDeactivateTarget(null); toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('users.msg.failed_status')); },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t('users.error.name_required');
    if (!form.email.trim()) e.email = t('users.error.email_required');
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = t('users.error.email_invalid');
    if (form.whatsapp_phone.trim() && !/^\+?[\d\s-]{8,20}$/.test(form.whatsapp_phone.trim())) e.whatsapp_phone = t('users.error.whatsapp_invalid');
    if (!editUser && !form.password) e.password = t('users.error.password_required');
    if (form.password && form.password !== form.password_confirmation) e.password_confirmation = t('users.reset_password.error.password_mismatch');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openCreate = () => { setEditUser(null); setForm(DEFAULT_FORM); setFormOpened(JSON.stringify(DEFAULT_FORM)); setFormError(''); setErrors({}); setShowModal(true); };
  const openEdit = (u: User) => {
    setEditUser(u);
    const dashPerms = DASHBOARD_SECTION_KEYS.map(s => s.key).filter(k => u.permissions?.includes(k));
    const next = { name: u.name, email: u.email, whatsapp_phone: u.whatsapp_phone ?? '', password: '', password_confirmation: '', role: u.roles[0] ?? 'User', is_active: u.is_active, dashboard_permissions: dashPerms };
    setForm(next);
    setFormOpened(JSON.stringify(next));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditUser(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    if (editUser) {
      const payload: Partial<UserFormData> = { name: form.name, email: form.email, whatsapp_phone: form.whatsapp_phone.trim(), role: form.role, is_active: form.is_active };
      if (form.password) { payload.password = form.password; payload.password_confirmation = form.password_confirmation; }
      if (hasRole('Super Admin')) { payload.dashboard_permissions = form.dashboard_permissions; }
      updateMutation.mutate({ id: editUser.id, payload });
    } else {
      const { dashboard_permissions: _, ...createPayload } = form;
      createMutation.mutate({ ...createPayload });
    }
  };

  const users = data?.data ?? [];
  const totalPages = data?.meta?.last_page ?? 1;

  const cols: ColDef<User>[] = [
    {
      key: 'user', labelKey: 'users:users.col.user', align: 'left', sortKey: 'name', sortType: 'text',
      render: u => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
            {u.name[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-800">{u.name}</p>
            <p className="text-xs text-slate-400">{u.email}</p>
            {u.whatsapp_phone && (
              <p className="flex items-center gap-1 text-[11px] text-emerald-700" title={t('users.whatsapp_linked')}>
                <MessageCircle size={11} /> <span dir="ltr">+{u.whatsapp_phone}</span>
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'role', labelKey: 'users:users.col.role', align: 'left',
      render: u => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
          {u.roles[0] ? roleLabel(u.roles[0], t) : t('common:no_role')}
        </span>
      ),
    },
    {
      key: 'is_active', labelKey: 'users:users.col.status', align: 'left',
      render: u => (
        // Deactivating locks the person out, so it is confirmed; activating is one tap.
        <button
          type="button"
          onClick={() => (u.is_active ? setDeactivateTarget(u) : statusMutation.mutate({ id: u.id, is_active: true }))}
          disabled={statusMutation.isPending}
          title={t('users.deactivate.toggle_label', { name: u.name })}
          className={`flex items-center gap-1.5 min-h-10 sm:min-h-0 text-xs font-medium disabled:opacity-60 ${u.is_active ? 'text-green-600' : 'text-slate-400'}`}
        >
          {u.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {u.is_active ? t('common:status.active') : t('common:status.inactive')}
        </button>
      ),
    },
    {
      key: 'last_login_at', labelKey: 'users:users.col.last_login', align: 'left', sortKey: 'last_login', sortType: 'date',
      render: u => (
        <span className="text-xs text-slate-400">
          {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString(localeFor()) : t('common:status.never')}
        </span>
      ),
    },
    {
      key: '_actions', labelKey: 'common:actions', align: 'right',
      render: u => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title={t('common:btn.edit')} aria-label={t('common:btn.edit')}>
            <Pencil size={14} />
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => { setResetTarget(u); setResetPw({ password: '', password_confirmation: '' }); setResetPwErrors({}); setShowResetNew(false); setShowResetConfirm(false); }}
              className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500"
              title={t('users.reset_password.title')}
              aria-label={t('users.reset_password.title')}
            >
              <KeyRound size={14} />
            </button>
          )}
          {isSuperAdmin && (
            <button onClick={() => setDeleteTarget(u)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
              title={tc('btn.move_to_trash')} aria-label={tc('btn.move_to_trash')}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('users.search_placeholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {hasPermission('users.view') && (
          <Link
            href="/users/trash"
            className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <ArchiveRestore size={16} /> {t('common:btn.trash')}
          </Link>
        )}
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> {t('users.btn.add')}
        </button>
      </div>

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={10}
        data={users}
        isLoading={isLoading}
        keyExtractor={u => u.id}
        emptyKey="users:no_users"
        currentPage={page}
        lastPage={totalPages}
        totalCount={data?.meta?.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('btn.move_to_trash')}
        message={t('users.confirm_trash', { name: deleteTarget?.name ?? '' })}
        confirmLabel={tc('btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        title={t('users.deactivate.title')}
        message={t('users.deactivate.message', { name: deactivateTarget?.name ?? '' })}
        confirmLabel={t('users.deactivate.confirm')}
        loading={statusMutation.isPending}
        onConfirm={() => deactivateTarget && statusMutation.mutate({ id: deactivateTarget.id, is_active: false })}
        onCancel={() => setDeactivateTarget(null)}
      />

      {/* Reset Password Modal */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} dirty={resetDirty} size="sm"
        title={t('users.reset_password.title')} icon={<KeyRound size={17} className="text-amber-500 shrink-0" />}
        footer={<>
          <button type="button" onClick={() => setResetTarget(null)} className={btnSecondary}>
            {t('users.reset_password.cancel')}
          </button>
          <button type="submit" form={RESET_FORM_ID} disabled={resetPwMutation.isPending} className={btnPrimary}>
            {resetPwMutation.isPending ? t('users.reset_password.submitting') : t('users.reset_password.submit')}
          </button>
        </>}>
        {resetTarget && (
          <form
            id={RESET_FORM_ID}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const errs: Record<string, string> = {};
              if (!resetPw.password) errs.password = t('users.reset_password.error.new_password_required');
              else if (resetPw.password.length < 8) errs.password = t('users.reset_password.error.min_length');
              if (resetPw.password !== resetPw.password_confirmation) errs.password_confirmation = t('users.reset_password.error.password_mismatch');
              if (Object.keys(errs).length) { setResetPwErrors(errs); return; }
              resetPwMutation.mutate({ id: resetTarget.id, data: resetPw });
            }}
            className="px-4 sm:px-6 py-5 space-y-4"
          >
            <p className="text-sm text-slate-500">
              {t('users.reset_password.for_user', { name: resetTarget.name })}
            </p>
            <FormAlert message={resetPwErrors._global} extra={otherErrors(resetPwErrors, ['_global', 'password', 'password_confirmation'])} />
            <Field name="password" label={t('users.reset_password.new_password_label')} required error={resetPwErrors.password}>
              <div className="relative">
                <input
                  id={fieldId('password')}
                  type={showResetNew ? 'text' : 'password'} autoComplete="new-password" dir="ltr"
                  value={resetPw.password}
                  onChange={e => { setResetPw(f => ({ ...f, password: e.target.value })); setResetPwErrors(p => ({ ...p, password: '' })); }}
                  className={fieldClass(resetPwErrors.password, 'pe-10')}
                />
                <button type="button" onClick={() => setShowResetNew(v => !v)} aria-label={showResetNew ? tc('ui.hide') : tc('ui.show')}
                  className="absolute end-1 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600">
                  {showResetNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
            <Field name="password_confirmation" label={t('users.reset_password.confirm_label')} required error={resetPwErrors.password_confirmation}>
              <div className="relative">
                <input
                  id={fieldId('password_confirmation')}
                  type={showResetConfirm ? 'text' : 'password'} autoComplete="new-password" dir="ltr"
                  value={resetPw.password_confirmation}
                  onChange={e => { setResetPw(f => ({ ...f, password_confirmation: e.target.value })); setResetPwErrors(p => ({ ...p, password_confirmation: '' })); }}
                  className={fieldClass(resetPwErrors.password_confirmation, 'pe-10')}
                />
                <button type="button" onClick={() => setShowResetConfirm(v => !v)} aria-label={showResetConfirm ? tc('ui.hide') : tc('ui.show')}
                  className="absolute end-1 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600">
                  {showResetConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
          </form>
        )}
      </Modal>

      {/* Create / edit user */}
      <Modal open={showModal} onClose={closeModal} dirty={formDirty} size="lg"
        title={editUser ? t('users.modal.edit') : t('users.modal.create')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={USER_FORM_ID} disabled={createMutation.isPending || updateMutation.isPending} className={btnPrimary}>
            <Check size={15} /> {editUser ? t('common:btn.update') : t('common:btn.create')}
          </button>
        </>}>
        <form id={USER_FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, USER_FIELDS)} />

          <Field name="name" label={t('common:field.name')} required error={errors.name}>
            <input id={fieldId('name')} type="text" value={form.name} dir="auto" data-autofocus
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(p => ({ ...p, name: '' })); }}
              className={fieldClass(errors.name)} />
          </Field>

          <Field name="email" label={t('common:field.email')} required error={errors.email}>
            <input id={fieldId('email')} type="email" inputMode="email" dir="ltr" autoComplete="off" value={form.email}
              onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(p => ({ ...p, email: '' })); }}
              className={fieldClass(errors.email)} />
          </Field>

          <Field name="whatsapp_phone" label={t('users.whatsapp')} error={errors.whatsapp_phone} hint={t('users.whatsapp_hint')}>
            <input id={fieldId('whatsapp_phone')} type="tel" inputMode="tel" dir="ltr" autoComplete="off" value={form.whatsapp_phone} placeholder="01XXXXXXXXX"
              onChange={e => { setForm(f => ({ ...f, whatsapp_phone: e.target.value })); setErrors(p => ({ ...p, whatsapp_phone: '' })); }}
              className={fieldClass(errors.whatsapp_phone)} />
          </Field>

          <FormRow>
            <Field name="password" label={t('common:field.password')} required={!editUser} error={errors.password}
              hint={editUser ? t('common:leave_blank_to_keep') : undefined}>
              <input id={fieldId('password')} type="password" autoComplete="new-password" dir="ltr" value={form.password}
                onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(p => ({ ...p, password: '' })); }}
                className={fieldClass(errors.password)} />
            </Field>
            <Field name="password_confirmation" label={t('common:field.confirm_password')} required={!!form.password} error={errors.password_confirmation}>
              <input id={fieldId('password_confirmation')} type="password" autoComplete="new-password" dir="ltr" value={form.password_confirmation}
                onChange={e => { setForm(f => ({ ...f, password_confirmation: e.target.value })); setErrors(p => ({ ...p, password_confirmation: '' })); }}
                className={fieldClass(errors.password_confirmation)} />
            </Field>
          </FormRow>

          <FormRow>
            <Field name="role" label={t('common:field.role')} error={errors.role}>
              <SearchSelect id={fieldId('role')} value={form.role} label={t('common:field.role')} error={errors.role}
                onChange={v => { setForm(f => ({ ...f, role: v })); setErrors(p => ({ ...p, role: '' })); }}
                options={(rolesData ?? []).map(r => ({ value: r.name, label: roleLabel(r.name, t) }))} />
            </Field>
            <label htmlFor={fieldId('is_active')} className="flex items-center gap-2 min-h-11 self-end cursor-pointer">
              <input type="checkbox" id={fieldId('is_active')} checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded w-4 h-4" />
              <span className="text-sm text-slate-600">{t('common:status.active')}</span>
            </label>
          </FormRow>

          {/* Dashboard Visibility — Super Admin only, edit mode only */}
          {hasRole('Super Admin') && editUser && (
            <div data-field="dashboard_permissions" className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('users.dashboard_sections.visibility_label')}</p>
              <div className="grid grid-cols-1 gap-1">
                {DASHBOARD_SECTION_KEYS.map(({ key, tKey }) => (
                  <label key={key} className="flex items-center gap-2.5 min-h-10 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.dashboard_permissions.includes(key)}
                      onChange={e => setForm(f => ({
                        ...f,
                        dashboard_permissions: e.target.checked
                          ? [...f.dashboard_permissions, key]
                          : f.dashboard_permissions.filter(p => p !== key),
                      }))}
                      className="rounded border-slate-300 w-4 h-4"
                    />
                    <span className="text-sm text-slate-600 group-hover:text-slate-800">{t(tKey)}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">{t('users.dashboard_sections.visibility_hint')}</p>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
