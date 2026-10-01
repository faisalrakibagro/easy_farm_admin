'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Baby, Search, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { Birth, PaginatedResponse } from '@/types';
import { animalLabel, apiError, money } from '@/components/breeding/shared';
import { fmtDate, fmtNum } from '@/lib/format';
import BirthModal from '@/components/breeding/BirthModal';
import { useAutoOpen } from '@/lib/hooks/useAutoOpen';

export default function BirthsPage() {
  const { t } = useTranslation('breeding');
  const { t: tc } = useTranslation('cattle');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('farm.breeding.create');
  const canDelete = hasPermission('farm.breeding.delete');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<Birth>>({
    queryKey: ['breeding', 'births', page, search],
    queryFn: async () => (await api.get('/farm/breeding/births', { params: { page, per_page: 15, search: search || undefined } })).data,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/breeding/births/${id}`),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.deleted'));
      invalidateMoney(qc, [['breeding'], ['farm-cattle'], ['cattle-active'], ['cattle-breeding-history'], ['cattle-pedigree']]);
      setDeleteId(null);
    },
    onError: e => { toast.error(apiError(e, t('toast.failed')).message); setDeleteId(null); },
  });

  const rows = data?.data ?? [];

  // Reached from a dashboard quick action (?new=1): open the form straight away.
  useAutoOpen(() => setShowModal(true));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('field.search')}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg">
            <Baby size={15} /> {t('btn.birth')}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 m-3 bg-slate-50 rounded animate-pulse" />)
          : rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">{t('empty')}</p>
          : rows.map(b => (
            <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {b.dam && <Link href={`/farm/cattle/${b.dam.id}`} className="font-semibold text-slate-800 hover:text-blue-600">{animalLabel(b.dam)}</Link>}
                  <span className="text-sm text-slate-500">{fmtDate(b.birth_date)} · {t('delivery_type.' + b.delivery_type)}</span>
                  <span className="text-xs text-slate-400">
                    {t('col.sire')}: {b.semen_straw ? `${t('method.ai')} · ${b.semen_straw.bull_name}` : (b.sire ? animalLabel(b.sire) : '—')}
                  </span>
                  {parseFloat(b.cost) > 0 && <span className="text-xs text-slate-400">{t('col.cost')}: {money(b.cost)}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(b.calves ?? []).map(c => (
                    <Link key={c.id} href={`/farm/cattle/${c.id}`}
                      className={`text-xs px-2 py-1 rounded-lg border ${c.gender === 'female' ? 'border-pink-200 bg-pink-50 text-pink-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}>
                      {c.tag_number} · {tc('gender.' + c.gender)}{c.birth_weight ? ` · ${fmtNum(c.birth_weight)} ${tc('unit.kg')}` : ''}
                    </Link>
                  ))}
                  {b.born_dead > 0 && (
                    <span className="text-xs px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700">{t('field.dead')}: {fmtNum(b.born_dead)}</span>
                  )}
                </div>
              </div>
              {canDelete && (
                <button onClick={() => setDeleteId(b.id)} title={t('btn.delete')} className="self-start p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
      </div>

      {(data?.total ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-500">{t('common:pagination.page_of', { current: page, total: data?.last_page ?? 1 })} &bull; {t('common:pagination.total_count', { count: data?.total ?? 0 })}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.prev')}</button>
            <button disabled={page >= (data?.last_page ?? 1)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.next')}</button>
          </div>
        </div>
      )}

      {showModal && <BirthModal onClose={() => setShowModal(false)} />}
      <ConfirmDialog open={deleteId !== null} title={t('btn.delete')} message={t('confirm.delete_birth')} confirmLabel={t('btn.delete')}
        loading={remove.isPending} onConfirm={() => deleteId !== null && remove.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
