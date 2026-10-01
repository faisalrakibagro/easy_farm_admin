'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Role } from '@/types';
import Link from '@/components/ui/AppLink';
import { Plus, Pencil, Trash2, Check, Shield, PanelTopOpen, ArrowRight } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { permissionLabel, roleLabel } from '@/lib/permissionLabels';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, firstErrorWithPrefix, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

const FORM_ID = 'role-form';

export default function RolesPage() {
  const { t } = useTranslation(['users', 'common']);
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState('');
  const dirty = showModal && JSON.stringify([name, [...selectedPerms].sort()]) !== opened;
  useScrollToError(errors, formError);

  const showApiError = (e: unknown) => {
    const { fields, message } = apiFieldErrors(e, t('common:error.failed_save'));
    setErrors(fields);
    setFormError(Object.keys(fields).length ? '' : message);
  };

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/roles');
      return res.data.roles as Role[];
    },
  });

  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await api.get('/permissions');
      return res.data.permissions as Record<string, { id: number; name: string }[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; permissions: string[] }) => api.post('/roles', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); closeModal(); },
    onError: showApiError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; permissions: string[] } }) =>
      api.put(`/roles/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); closeModal(); },
    onError: showApiError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/roles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setDeleteTarget(null); },
    // A role still given to people is refused — say why instead of doing nothing.
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setDeleteTarget(null);
      toast.error(e.response?.data?.message ?? t('common:error.failed_delete'));
    },
  });

  const openCreate = () => {
    setEditRole(null); setName(''); setSelectedPerms([]); setFormError(''); setErrors({});
    setOpened(JSON.stringify(['', []]));
    setShowModal(true);
  };
  const openEdit = (r: Role) => {
    setEditRole(r); setName(r.name); setSelectedPerms(r.permissions ?? []); setFormError(''); setErrors({});
    setOpened(JSON.stringify([r.name, [...(r.permissions ?? [])].sort()]));
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditRole(null); };

  const togglePerm = (perm: string) => {
    setSelectedPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const toggleModule = (perms: { name: string }[]) => {
    const names = perms.map(p => p.name);
    const allSelected = names.every(n => selectedPerms.includes(n));
    setSelectedPerms(prev => allSelected ? prev.filter(p => !names.includes(p)) : [...new Set([...prev, ...names])]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) { setErrors({ name: t('common:form.v.required') }); return; }
    setErrors({});
    const payload = { name, permissions: selectedPerms };
    if (editRole) updateMutation.mutate({ id: editRole.id, data: payload });
    else createMutation.mutate(payload);
  };

  const roles = rolesData ?? [];

  return (
    <div className="space-y-4">
      {/* Dashboard Section Access shortcut */}
      <Link
        href="/settings/dashboard-sections"
        className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5 hover:bg-blue-100 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <PanelTopOpen size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-800">{t('users.dashboard_sections.access_control_title', { ns: 'users' })}</p>
            <p className="text-xs text-blue-600">{t('users.dashboard_sections.access_control_subtitle', { ns: 'users' })}</p>
          </div>
        </div>
        <ArrowRight size={16} className="text-blue-500 rtl:rotate-180 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
      </Link>

      <div className="flex justify-end">
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> {t('roles.add', { ns: 'users' })}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-32 animate-pulse" />
          ))
        ) : roles.map((role) => (
          <div key={role.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Shield size={18} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{roleLabel(role.name, t)}</h3>
                  <p className="text-xs text-slate-400">{t('roles.users_count', { ns: 'users', count: role.users_count })}</p>
                </div>
              </div>
              <div className="flex gap-1 w-full sm:w-auto">
                <button onClick={() => openEdit(role)} aria-label={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
                {isSuperAdmin && (
                  <button
                    onClick={() => setDeleteTarget(role)}
                    aria-label={t('common:btn.delete')}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {(role.permissions ?? []).slice(0, 6).map(p => (
                <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{permissionLabel(p, t)}</span>
              ))}
              {(role.permissions ?? []).length > 6 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {t('roles.more_permissions', { ns: 'users', count: role.permissions.length - 6 })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common:ui.delete_role')}
        message={t('common:ui.delete_role_message')}
        confirmLabel={t('common:btn.delete')}
        cancelLabel={t('common:btn.cancel')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="2xl"
        title={editRole ? t('roles.modal.edit_title', { ns: 'users' }) : t('roles.modal.create_title', { ns: 'users' })}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={createMutation.isPending || updateMutation.isPending} className={btnPrimary}>
            <Check size={14} />{editRole ? t('common:btn.update') : t('common:btn.create')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, ['name', 'permissions', 'permissions.*'])} />
          <Field name="name" label={t('roles.field.name', { ns: 'users' })} required error={errors.name}>
            <input id={fieldId('name')} type="text" value={name} data-autofocus
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
              className={fieldClass(errors.name)} />
          </Field>

          <Field name="permissions" label={t('roles.field.permissions', { ns: 'users' })}
            error={errors.permissions ?? firstErrorWithPrefix(errors, 'permissions.')}>
            <div className="space-y-3 sm:space-y-4 mt-2">
              {permissionsData && Object.entries(permissionsData).map(([module, perms]) => {
                const allSelected = perms.every(p => selectedPerms.includes(p.name));
                return (
                  <div key={module} className="border border-slate-200 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h4 className="text-sm font-semibold text-slate-700 capitalize min-w-0 break-words">
                        {t(`roles.permission_groups.${module}`, { ns: 'users', defaultValue: module })}
                      </h4>
                      <button type="button" onClick={() => toggleModule(perms)} aria-pressed={allSelected}
                        className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${allSelected ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                        {allSelected ? t('common:btn.deselect_all') : t('common:btn.select_all')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {perms.map(p => {
                        const on = selectedPerms.includes(p.name);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => { togglePerm(p.name); setErrors(e => ({ ...e, permissions: '' })); }}
                            className={`max-w-full text-start break-words text-xs px-3 py-2 sm:py-1.5 rounded-lg border transition-colors ${
                              on ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {permissionLabel(p.name, t)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
