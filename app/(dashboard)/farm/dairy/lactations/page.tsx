'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { SerialCell, SerialHeader, SortHeader, SortSelect, TablePagination } from '@/components/ui/TableControls';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { invalidateKeys } from '@/lib/invalidateGroups';
import type { Lactation, PaginatedResponse } from '@/types';
import { animalLabel, apiError, dateOnly } from '@/components/breeding/shared';
import { DryOffModal, StartLactationModal } from '@/components/dairy/LactationModals';
import { fmtDate, fmtNum } from '@/lib/format';

export default function LactationsPage() {
  const { t } = useTranslation('dairy');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const [dryOff, setDryOff] = useState<Lactation | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<Lactation>>({
    queryKey: ['dairy', 'lactations', page, search, activeOnly, sorting.params],
    queryFn: async () => (await api.get('/farm/dairy/lactations', {
      params: { page, per_page: 20, search: search || undefined, active: activeOnly ? 1 : undefined, ...sorting.params },
    })).data,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/dairy/lactations/${id}`),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.deleted')); invalidateKeys(qc, [['dairy'], ['cattle-dairy-history']]); setDeleteId(null); },
    onError: e => { toast.error(apiError(e, t('toast.failed')).message); setDeleteId(null); },
  });

  const rows = data?.data ?? [];
  const today = new Date();
  const daysOf = (l: Lactation) =>
    Math.floor(((l.dry_off_date ? new Date(dateOnly(l.dry_off_date)) : today).getTime() - new Date(dateOnly(l.start_date)).getTime()) / 86400000) + 1;

  const animal = (l: Lactation) => l.cattle && (
    <Link href={`/farm/cattle/${l.cattle.id}`} className="font-medium text-slate-800 hover:text-blue-600">{animalLabel(l.cattle)}</Link>
  );
  const end = (l: Lactation) => (l.dry_off_date
    ? <span className="text-slate-600">{fmtDate(l.dry_off_date)} <span className="text-xs text-slate-400">· {t('end_reason.' + (l.end_reason ?? 'other'))}</span></span>
    : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-50 text-sky-700">{t('history.active')}</span>);
  const actions = (l: Lactation) => (
    <div className="flex justify-end gap-1.5">
      {!l.dry_off_date && hasPermission('farm.dairy.edit') && (
        <button onClick={() => setDryOff(l)} className="text-xs px-2.5 py-2 sm:py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">{t('btn.dry_off')}</button>
      )}
      {hasPermission('farm.dairy.delete') && !Number(l.total_kg ?? 0) && (
        <button onClick={() => setDeleteId(l.id)} title={t('btn.delete')} aria-label={t('btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('field.search')}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 px-2">
          <input type="checkbox" checked={activeOnly} onChange={e => { setActiveOnly(e.target.checked); setPage(1); }} className="accent-blue-500" />
          {t('field.active_only')}
        </label>
        {hasPermission('farm.dairy.create') && (
          <button onClick={() => setShowStart(true)} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
            <Plus size={15} /> {t('btn.start_lactation')}
          </button>
        )}
      </div>

      {/* Phones: one card per lactation */}
      <div className="sm:hidden bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <SortSelect options={[
          { key: 'start', label: t('col.start'), type: 'date' },
          { key: 'end', label: t('col.end'), type: 'date' },
          { key: 'total_kg', label: t('col.total_kg'), type: 'number' },
        ]} sorting={sorting} className="px-4 py-2.5" />
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 m-3 bg-slate-50 rounded animate-pulse" />)
          : rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">{t('empty')}</p>
          : rows.map(l => (
            <div key={l.id} className="p-4 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 break-words">
                  {animal(l)}
                  <p className="text-xs text-slate-500">#{fmtNum(l.lactation_no)} · {t('history.days', { count: fmtNum(daysOf(l)) })}</p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-xs text-slate-400">{t('col.total_kg')}</p>
                  <p className="font-semibold text-slate-800">{fmtNum(l.total_kg ?? 0)}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">{t('col.start')}: {fmtDate(l.start_date)}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">{end(l)}</div>
                {actions(l)}
              </div>
            </div>
          ))}
      </div>

      <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-start text-slate-600">
              <SerialHeader />
              <th className="px-4 py-3 font-medium">{t('col.animal')}</th>
              <th className="px-4 py-3 font-medium">{t('col.lactation')}</th>
              <SortHeader label={t('col.start')} sortKey="start" sortType="date" sorting={sorting} />
              <SortHeader label={t('col.end')} sortKey="end" sortType="date" sorting={sorting} />
              <SortHeader label={t('col.total_kg')} align="right" sortKey="total_kg" sortType="number" sorting={sorting} />
              <th className="px-4 py-3 font-medium text-end">{t('col.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-6"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{t('empty')}</td></tr>
            ) : rows.map((l, i) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <SerialCell index={i} page={page} perPage={20} />
                <td className="px-4 py-3">{animal(l)}</td>
                <td className="px-4 py-3 text-slate-600">#{fmtNum(l.lactation_no)} · {t('history.days', { count: fmtNum(daysOf(l)) })}</td>
                <td className="px-4 py-3 text-slate-600">{fmtDate(l.start_date)}</td>
                <td className="px-4 py-3">{end(l)}</td>
                <td className="px-4 py-3 text-end text-slate-800">{fmtNum(l.total_kg ?? 0)}</td>
                <td className="px-4 py-3">{actions(l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data?.total ?? 0) > 0 && (
        <TablePagination page={page} lastPage={data?.last_page ?? 1} total={data?.total} perPage={20} onPageChange={setPage} className="" />
      )}

      {showStart && <StartLactationModal onClose={() => setShowStart(false)} />}
      {dryOff && <DryOffModal lactation={dryOff} onClose={() => setDryOff(null)} />}
      <ConfirmDialog open={deleteId !== null} title={t('btn.delete')} message={t('confirm.delete_lactation')} confirmLabel={t('btn.delete')}
        loading={remove.isPending} onConfirm={() => deleteId !== null && remove.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
