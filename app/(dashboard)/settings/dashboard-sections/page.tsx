'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Role } from '@/types';
import { Loader2, LayoutDashboard, Lock, Info } from 'lucide-react';
import { roleLabel } from '@/lib/permissionLabels';
import { useToast } from '@/components/ui/Toast';
import LoadError from '@/components/ui/LoadError';

// All 9 controllable dashboard sections
const SECTIONS = [
  { perm: 'dashboard-sections.quick-access',    labelKey: 'quick_access' },
  { perm: 'dashboard-sections.animals',         labelKey: 'animals' },
  { perm: 'dashboard-sections.financials',      labelKey: 'financials' },
  { perm: 'dashboard-sections.expenses',        labelKey: 'expenses' },
  { perm: 'dashboard-sections.todays-costs',    labelKey: 'todays_costs' },
  { perm: 'dashboard-sections.top-cattle',      labelKey: 'top_cattle' },
  { perm: 'dashboard-sections.projected-profit', labelKey: 'projected_profit' },
  { perm: 'dashboard-sections.vaccines',        labelKey: 'vaccines' },
  { perm: 'dashboard-sections.alerts',          labelKey: 'alerts' },
] as const;

const SUPER_ADMIN = 'Super Admin';

function Toggle({ checked, disabled, loading, label, onChange }: {
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Accessible name, e.g. "Show Alerts to Manager". */
  label?: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-center">
      {loading ? (
        <Loader2 size={16} className="animate-spin text-blue-500" />
      ) : disabled ? (
        <div className="flex items-center gap-1">
          <div className="w-9 h-5 rounded-full bg-blue-500 flex items-center justify-end pe-0.5">
            <div className="w-4 h-4 rounded-full bg-white shadow" />
          </div>
          <Lock size={11} className="text-slate-400" />
        </div>
      ) : (
        // The padding gives the small switch a 56x40 tap area; the negative
        // margin keeps the row height as it was.
        <button
          type="button"
          onClick={onChange}
          className="group p-2.5 -my-2.5 rounded-full focus:outline-none"
          aria-checked={checked}
          aria-label={label}
          role="switch"
        >
          <span className={`flex items-center w-9 h-5 rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-blue-500 group-focus-visible:ring-offset-1 ${
            checked ? 'bg-blue-500' : 'bg-slate-200'
          }`}>
            <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${
              checked ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
            }`} />
          </span>
        </button>
      )}
    </div>
  );
}

export default function DashboardSectionsPage() {
  const { t } = useTranslation('settings');
  const { t: tDash } = useTranslation('dashboard');
  const qc = useQueryClient();
  const toast = useToast();

  // Track which role is being saved right now (role_id → Set of section perms being toggled)
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const { data: rolesData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/roles');
      return res.data.roles as Role[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: string[] }) =>
      api.put(`/roles/${id}`, { permissions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
    // The switches show the saved state, so re-reading the roles puts the flipped one back.
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('dashboard_sections.save_failed'));
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const handleToggle = useCallback(async (role: Role, sectionPerm: string) => {
    const currentPerms: string[] = role.permissions ?? [];
    const hasPerm = currentPerms.includes(sectionPerm);
    const newPerms = hasPerm
      ? currentPerms.filter(p => p !== sectionPerm)
      : [...currentPerms, sectionPerm];

    setSaving(prev => ({ ...prev, [role.id]: true }));
    try {
      await updateMutation.mutateAsync({ id: role.id, permissions: newPerms });
    } catch {
      // Reported by onError.
    } finally {
      setSaving(prev => ({ ...prev, [role.id]: false }));
    }
  }, [updateMutation]);

  const roles = (rolesData ?? []).filter(r => r.name !== SUPER_ADMIN);
  const superAdmin = (rolesData ?? []).find(r => r.name === SUPER_ADMIN);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!rolesData) {
    return (
      <div className="bg-white rounded-xl border border-slate-200">
        <LoadError onRetry={() => refetch()} retrying={isFetching} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <LayoutDashboard size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-800">{t('dashboard_sections.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('dashboard_sections.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <Info size={15} className="mt-0.5 shrink-0" />
        <span>{t('dashboard_sections.refresh_note')}</span>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* The section column stays put while the role columns scroll sideways. */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky start-0 z-10 bg-slate-50 border-e border-slate-100 sm:border-e-0 text-start px-3 sm:px-5 py-3 font-semibold text-slate-700 min-w-[8.5rem] sm:min-w-[180px]">
                  {t('dashboard_sections.section_col')}
                </th>
                {/* Super Admin — always locked */}
                {superAdmin && (
                  <th className="px-2 sm:px-4 py-3 font-semibold text-slate-500 text-center min-w-[88px] sm:min-w-[110px]">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs">{superAdmin.name}</span>
                      <Lock size={11} className="text-slate-400" />
                    </div>
                  </th>
                )}
                {roles.map(role => (
                  <th key={role.id} className="px-2 sm:px-4 py-3 font-semibold text-slate-600 text-center min-w-[88px] sm:min-w-[110px]">
                    <span className="text-xs">{roleLabel(role.name, tDash)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SECTIONS.map(({ perm, labelKey }) => {
                const sectionName = tDash(`section.${labelKey}`, { defaultValue: labelKey });
                return (
                <tr key={perm} className="hover:bg-slate-50/50 transition-colors">
                  <td className="sticky start-0 z-10 bg-white border-e border-slate-100 sm:border-e-0 px-3 sm:px-5 py-3.5">
                    <span className="font-medium text-slate-700">{sectionName}</span>
                    {/* The technical key only helps on a wide screen. */}
                    <span className="hidden sm:block text-xs text-slate-400 font-mono mt-0.5" dir="ltr">{perm}</span>
                  </td>
                  {/* Super Admin always enabled */}
                  {superAdmin && (
                    <td className="px-2 sm:px-4 py-3.5">
                      <Toggle checked={true} disabled={true} onChange={() => {}} />
                    </td>
                  )}
                  {roles.map(role => {
                    const hasSection = (role.permissions ?? []).includes(perm);
                    return (
                      <td key={role.id} className="px-2 sm:px-4 py-3.5">
                        <Toggle
                          checked={hasSection}
                          loading={saving[role.id]}
                          label={t('dashboard_sections.toggle_label', { section: sectionName, role: roleLabel(role.name, tDash) })}
                          onChange={() => handleToggle(role, perm)}
                        />
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-3.5 rounded-full bg-blue-500" />
            <span>{t('dashboard_sections.legend_visible')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-3.5 rounded-full bg-slate-200" />
            <span>{t('dashboard_sections.legend_hidden')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock size={11} />
            <span>{t('dashboard_sections.legend_locked')}</span>
          </div>
        </div>
      </div>

      {/* Mobile scroll hint */}
      <p className="sm:hidden text-xs text-slate-400 text-center -mt-2">
        {t('dashboard_sections.mobile_scroll_hint')}
      </p>
    </div>
  );
}
