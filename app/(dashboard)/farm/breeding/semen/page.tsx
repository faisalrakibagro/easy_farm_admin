'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { SerialCell, SerialHeader, SortHeader, SortSelect, TablePagination } from '@/components/ui/TableControls';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { PaginatedResponse, SemenStraw } from '@/types';
import { apiError, dateOnly, money, todayStr } from '@/components/breeding/shared';
import SemenModal from '@/components/breeding/SemenModal';
import { fmtDate, fmtNum } from '@/lib/format';

export default function SemenStockPage() {
  const { t } = useTranslation('breeding');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('farm.breeding.create');
  const canEdit = hasPermission('farm.breeding.edit');
  const canDelete = hasPermission('farm.breeding.delete');

  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);
  const [search, setSearch] = useState('');
  const [available, setAvailable] = useState(false);
  const [editing, setEditing] = useState<SemenStraw | null | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<SemenStraw>>({
    queryKey: ['breeding', 'semen', page, search, available, sorting.params],
    queryFn: async () => (await api.get('/farm/breeding/semen', {
      params: { page, per_page: 15, search: search || undefined, available: available ? 1 : undefined, ...sorting.params },
    })).data,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/breeding/semen/${id}`),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.deleted')); invalidateMoney(qc, [['breeding'], ['breeding-semen-all']]); setDeleteId(null); },
    onError: e => { toast.error(apiError(e, t('toast.failed')).message); setDeleteId(null); },
  });

  const rows = data?.data ?? [];
  const today = todayStr();
  const isExpired = (s: SemenStraw) => !!s.expiry_date && dateOnly(s.expiry_date) < today;

  const bull = (s: SemenStraw) => (
    <>
      <p className="font-medium text-slate-800">{s.bull_name}{s.bull_code ? ` (${s.bull_code})` : ''}</p>
      <p className="text-xs text-slate-400">{[s.breed, s.batch_no, s.supplier?.name].filter(Boolean).join(' · ') || '—'}</p>
    </>
  );
  const stock = (s: SemenStraw) => (
    <>
      <span className={`font-semibold ${s.remaining === 0 ? 'text-slate-400' : s.remaining <= 2 ? 'text-amber-600' : 'text-slate-800'}`}>{fmtNum(s.remaining)}</span>
      <span className="text-xs text-slate-400"> / {fmtNum(s.quantity)}</span>
    </>
  );
  const due = (s: SemenStraw) => parseFloat(s.due_amount) > 0 && (
    <span className="block text-xs text-red-600">{t('field.due_amount')}: {money(s.due_amount)}</span>
  );
  const actions = (s: SemenStraw) => (
    <div className="flex justify-end gap-1">
      {canEdit && (
        <button onClick={() => setEditing(s)} title={t('btn.edit')} aria-label={t('btn.edit')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
      )}
      {canDelete && s.remaining === s.quantity && (
        <button onClick={() => setDeleteId(s.id)} title={t('btn.delete')} aria-label={t('btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('field.search_semen')}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 px-2">
          <input type="checkbox" checked={available} onChange={e => { setAvailable(e.target.checked); setPage(1); }} className="accent-blue-500" />
          {t('col.stock')} &gt; 0
        </label>
        {canCreate && (
          <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
            <Plus size={15} /> {t('btn.semen')}
          </button>
        )}
      </div>

      {/* Phones: one card per batch */}
      <div className="sm:hidden bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <SortSelect options={[
          { key: 'date', label: t('field.purchase_date'), type: 'date' },
          { key: 'stock', label: t('col.stock'), type: 'number' },
          { key: 'price', label: t('col.price'), type: 'number' },
          { key: 'expiry', label: t('col.expiry'), type: 'due' },
        ]} sorting={sorting} className="px-4 py-2.5" />
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 m-3 bg-slate-50 rounded animate-pulse" />)
          : rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">{t('empty')}</p>
          : rows.map(s => (
            <div key={s.id} className="p-4 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 break-words">{bull(s)}</div>
                <div className="shrink-0 text-end">
                  <p className="text-xs text-slate-400">{t('col.stock')}</p>
                  <p>{stock(s)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div>
                  <p className="text-xs text-slate-400">{t('col.type')}</p>
                  <p className="text-slate-600">{s.animal_type?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t('col.price')}</p>
                  <p className="text-slate-600">{money(s.cost_per_straw)}</p>
                  {due(s)}
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t('field.purchase_date')}</p>
                  <p className="text-slate-600">{fmtDate(s.purchase_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t('col.expiry')}</p>
                  <p className={isExpired(s) ? 'text-red-600 font-medium' : 'text-slate-600'}>{fmtDate(s.expiry_date) || '—'}</p>
                </div>
              </div>
              {actions(s)}
            </div>
          ))}
      </div>

      <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-start text-slate-600">
              <SerialHeader />
              <th className="px-4 py-3 font-medium">{t('col.bull')}</th>
              <th className="px-4 py-3 font-medium">{t('col.type')}</th>
              <SortHeader label={t('col.stock')} align="right" sortKey="stock" sortType="number" sorting={sorting} />
              <SortHeader label={t('col.price')} align="right" sortKey="price" sortType="number" sorting={sorting} />
              <SortHeader label={t('field.purchase_date')} sortKey="date" sortType="date" sorting={sorting} />
              <SortHeader label={t('col.expiry')} sortKey="expiry" sortType="due" sorting={sorting} />
              <th className="px-4 py-3 font-medium text-end">{t('col.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-6"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">{t('empty')}</td></tr>
            ) : rows.map((s, i) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <SerialCell index={i} page={page} perPage={15} />
                <td className="px-4 py-3">{bull(s)}</td>
                <td className="px-4 py-3 text-slate-600">{s.animal_type?.name ?? '—'}</td>
                <td className="px-4 py-3 text-end">{stock(s)}</td>
                <td className="px-4 py-3 text-end text-slate-600">
                  {money(s.cost_per_straw)}
                  {due(s)}
                </td>
                <td className="px-4 py-3 text-slate-600">{fmtDate(s.purchase_date)}</td>
                <td className={`px-4 py-3 ${isExpired(s) ? 'text-red-600 font-medium' : 'text-slate-600'}`}>{fmtDate(s.expiry_date) || '—'}</td>
                <td className="px-4 py-3">{actions(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data?.total ?? 0) > 0 && (
        <TablePagination page={page} lastPage={data?.last_page ?? 1} total={data?.total} perPage={15} onPageChange={setPage} className="" />
      )}

      {editing !== undefined && <SemenModal semen={editing} onClose={() => setEditing(undefined)} />}
      <ConfirmDialog open={deleteId !== null} title={t('btn.delete')} message={t('confirm.delete_semen')} confirmLabel={t('btn.delete')}
        loading={remove.isPending} onConfirm={() => deleteId !== null && remove.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
