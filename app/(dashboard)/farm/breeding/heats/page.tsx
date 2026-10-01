'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Flame, Search, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { invalidateKeys } from '@/lib/invalidateGroups';
import type { HeatRecord, PaginatedResponse } from '@/types';
import { animalLabel, apiError, dateOnly } from '@/components/breeding/shared';
import { fmtDate } from '@/lib/format';
import HeatModal from '@/components/breeding/HeatModal';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { SerialCell, SerialHeader, SortHeader, SortSelect, TablePagination } from '@/components/ui/TableControls';
import ServiceModal from '@/components/breeding/ServiceModal';

export default function HeatRecordsPage() {
  const { t } = useTranslation('breeding');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('farm.breeding.create');
  const canDelete = hasPermission('farm.breeding.delete');

  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);
  const [search, setSearch] = useState('');
  const [showHeat, setShowHeat] = useState(false);
  const [serviceFor, setServiceFor] = useState<HeatRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<HeatRecord>>({
    queryKey: ['breeding', 'heats', page, search, sorting.params],
    queryFn: async () => (await api.get('/farm/breeding/heats', { params: { page, per_page: 20, search: search || undefined, ...sorting.params } })).data,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/breeding/heats/${id}`),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.deleted')); invalidateKeys(qc, [['breeding'], ['cattle-breeding-history']]); setDeleteId(null); },
    onError: e => { toast.error(apiError(e, t('toast.failed')).message); setDeleteId(null); },
  });

  const rows = data?.data ?? [];

  const actions = (h: HeatRecord) => (
    <div className="flex justify-end gap-1.5">
      {canCreate && (
        <button onClick={() => setServiceFor(h)} className="text-xs px-2.5 py-2 sm:py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap">{t('btn.service')}</button>
      )}
      {canDelete && (
        <button onClick={() => setDeleteId(h.id)} title={t('btn.delete')} aria-label={t('btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('field.search')}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {canCreate && (
          <button onClick={() => setShowHeat(true)} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
            <Flame size={15} /> {t('btn.heat')}
          </button>
        )}
      </div>

      {/* Phones: one card per heat */}
      <div className="sm:hidden bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <SortSelect options={[{ key: 'date', label: t('col.date'), type: 'date' }]} sorting={sorting} className="px-4 py-2.5" />
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 m-3 bg-slate-50 rounded animate-pulse" />)
          : rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">{t('empty')}</p>
          : rows.map(h => (
            <div key={h.id} className="p-4 space-y-2 text-sm">
              <div className="min-w-0 break-words">
                {h.cattle && <Link href={`/farm/cattle/${h.cattle.id}`} className="font-medium text-slate-800 hover:text-blue-600">{animalLabel(h.cattle)}</Link>}
                <p className="text-xs text-slate-500">
                  {fmtDate(h.detected_on)}{h.next_expected_on ? ` · ${t('col.next_heat')}: ${fmtDate(h.next_expected_on)}` : ''}
                </p>
              </div>
              {h.signs && <p className="text-slate-600 break-words">{h.signs}</p>}
              {actions(h)}
            </div>
          ))}
      </div>

      <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-start text-slate-600">
              <SerialHeader />
              <th className="px-4 py-3 font-medium">{t('col.female')}</th>
              <SortHeader label={t('col.date')} sortKey="date" sortType="date" sorting={sorting} />
              <th className="px-4 py-3 font-medium">{t('col.signs')}</th>
              <th className="px-4 py-3 font-medium">{t('col.next_heat')}</th>
              <th className="px-4 py-3 font-medium text-end">{t('col.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{t('empty')}</td></tr>
            ) : rows.map((h, i) => (
              <tr key={h.id} className="hover:bg-slate-50">
                <SerialCell index={i} page={page} perPage={20} />
                <td className="px-4 py-3">
                  {h.cattle && <Link href={`/farm/cattle/${h.cattle.id}`} className="font-medium text-slate-800 hover:text-blue-600">{animalLabel(h.cattle)}</Link>}
                </td>
                <td className="px-4 py-3 text-slate-600">{fmtDate(h.detected_on)}</td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{h.signs || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{fmtDate(h.next_expected_on) || '—'}</td>
                <td className="px-4 py-3">{actions(h)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data?.total ?? 0) > 0 && (
        <TablePagination page={page} lastPage={data?.last_page ?? 1} total={data?.total} perPage={20} onPageChange={setPage} className="" />
      )}

      {showHeat && <HeatModal onClose={() => setShowHeat(false)} />}
      {serviceFor && (
        <ServiceModal onClose={() => setServiceFor(null)} initialFemaleId={serviceFor.cattle_id}
          heatRecordId={serviceFor.id} initialDate={dateOnly(serviceFor.detected_on)} />
      )}
      <ConfirmDialog open={deleteId !== null} title={t('btn.delete')} message={t('confirm.delete_heat')} confirmLabel={t('btn.delete')}
        loading={remove.isPending} onConfirm={() => deleteId !== null && remove.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
