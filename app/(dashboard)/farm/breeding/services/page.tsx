'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Trash2, X } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { BreedingRecord, PaginatedResponse } from '@/types';
import { StatusBadge, animalLabel, apiError, money } from '@/components/breeding/shared';
import { fmtDate, fmtNum } from '@/lib/format';
import ServiceModal from '@/components/breeding/ServiceModal';
import PregnancyCheckModal from '@/components/breeding/PregnancyCheckModal';
import BirthModal from '@/components/breeding/BirthModal';
import AbortModal from '@/components/breeding/AbortModal';

type Modal =
  | { kind: 'create' }
  | { kind: 'check' | 'abort'; service: BreedingRecord }
  | { kind: 'birth'; service: BreedingRecord }
  | null;
type Confirm = { kind: 'service' | 'check'; id: number } | null;

export default function BreedingServicesPage() {
  const { t } = useTranslation('breeding');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('farm.breeding.create');
  const canEdit = hasPermission('farm.breeding.edit');
  const canDelete = hasPermission('farm.breeding.delete');

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<BreedingRecord>>({
    queryKey: ['breeding', 'services', page, status, method, search],
    queryFn: async () => (await api.get('/farm/breeding/services', {
      params: { page, per_page: 15, status: status || undefined, method: method || undefined, search: search || undefined },
    })).data,
  });

  const remove = useMutation({
    mutationFn: (c: NonNullable<Confirm>) => api.delete(c.kind === 'service' ? `/farm/breeding/services/${c.id}` : `/farm/breeding/pregnancy-checks/${c.id}`),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.deleted'));
      invalidateMoney(qc, [['breeding'], ['farm-cattle'], ['cattle-active'], ['cattle-breeding-history'], ['breeding-semen-all']]);
      setConfirm(null);
    },
    onError: e => { toast.error(apiError(e, t('toast.failed')).message); setConfirm(null); },
  });

  const rows = data?.data ?? [];
  const isOpen = (s: BreedingRecord) => s.status === 'pending' || s.status === 'pregnant';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('field.search')}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('field.all_status')}</option>
          {['open', 'pending', 'pregnant', 'failed', 'aborted', 'delivered'].map(s => <option key={s} value={s}>{t('status.' + s)}</option>)}
        </select>
        <select value={method} onChange={e => { setMethod(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('field.all_methods')}</option>
          <option value="ai">{t('method.ai')}</option>
          <option value="natural">{t('method.natural')}</option>
        </select>
        {canCreate && (
          <button onClick={() => setModal({ kind: 'create' })} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
            <Plus size={15} /> {t('btn.service')}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {isLoading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 m-3 bg-slate-50 rounded animate-pulse" />)
          : rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">{t('empty')}</p>
          : rows.map(s => {
            const lastCheck = s.pregnancy_checks?.[s.pregnancy_checks.length - 1];
            return (
              <div key={s.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-sm">
                  <div className="col-span-2 sm:col-span-1">
                    {s.female && (
                      <Link href={`/farm/cattle/${s.female.id}`} className="font-semibold text-slate-800 hover:text-blue-600">{animalLabel(s.female)}</Link>
                    )}
                    <p className="text-xs text-slate-400">{fmtDate(s.service_date)} · {t('col.attempt')} #{fmtNum(s.attempt_no)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{s.method === 'ai' ? t('method.ai') : t('method.natural')}</p>
                    <p className="text-slate-700 truncate">
                      {s.method === 'ai'
                        ? `${s.semen_straw?.bull_name ?? '—'}${s.semen_straw?.bull_code ? ` (${s.semen_straw.bull_code})` : ''}`
                        : (s.sire ? animalLabel(s.sire) : '—')}
                    </p>
                  </div>
                  <div>
                    {s.status === 'pending' && s.pregnancy_check_due_on && (
                      <><p className="text-xs text-slate-400">{t('col.check_due')}</p><p className="text-slate-700">{fmtDate(s.pregnancy_check_due_on)}</p></>
                    )}
                    {s.status === 'pregnant' && (
                      <><p className="text-xs text-slate-400">{t('col.expected')}</p><p className="text-slate-700">{fmtDate(s.expected_delivery_date) || '—'}</p></>
                    )}
                    {s.status === 'delivered' && s.birth && (
                      <><p className="text-xs text-slate-400">{t('field.birth_date')}</p><p className="text-slate-700">{fmtDate(s.birth.birth_date)} · {fmtNum(s.birth.born_alive)}/{fmtNum(s.birth.born_alive + s.birth.born_dead)}</p></>
                    )}
                  </div>
                  <div className="space-y-1">
                    <StatusBadge status={s.status} />
                    <p className="text-xs text-slate-400">{t('col.cost')}: {money(s.total_cost)}</p>
                  </div>
                  {lastCheck && (
                    <div className="col-span-2 sm:col-span-4 text-xs text-slate-500 flex items-center gap-2">
                      <span className="min-w-0">{t('history.checks')}: {fmtDate(lastCheck.check_date)} · {t('check_method.' + lastCheck.method)} · {t('result.' + lastCheck.result)}</span>
                      {canDelete && (isOpen(s) || s.status === 'failed') && (
                        <button onClick={() => setConfirm({ kind: 'check', id: lastCheck.id })} title={t('btn.delete_check')} aria-label={t('btn.delete_check')}
                          className="shrink-0 grid place-items-center w-10 h-10 -my-2.5 sm:w-6 sm:h-6 sm:my-0 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"><X size={14} /></button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 lg:justify-end lg:w-80 lg:flex-shrink-0">
                  {canCreate && isOpen(s) && (
                    <button onClick={() => setModal({ kind: 'check', service: s })} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">{t('btn.check')}</button>
                  )}
                  {canCreate && isOpen(s) && (
                    <button onClick={() => setModal({ kind: 'birth', service: s })} className="text-xs px-2.5 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50">{t('btn.birth')}</button>
                  )}
                  {canEdit && isOpen(s) && (
                    <button onClick={() => setModal({ kind: 'abort', service: s })} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">{t('btn.abort')}</button>
                  )}
                  {canDelete && !s.pregnancy_checks?.length && !s.birth && (
                    <button onClick={() => setConfirm({ kind: 'service', id: s.id })} title={t('btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            );
          })}
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

      {modal?.kind === 'create' && <ServiceModal onClose={() => setModal(null)} />}
      {modal?.kind === 'check' && <PregnancyCheckModal service={modal.service} onClose={() => setModal(null)} />}
      {modal?.kind === 'abort' && <AbortModal service={modal.service} onClose={() => setModal(null)} />}
      {modal?.kind === 'birth' && <BirthModal onClose={() => setModal(null)} initialDamId={modal.service.female_id} initialServiceId={modal.service.id} />}

      <ConfirmDialog
        open={!!confirm}
        title={t('btn.delete')}
        message={confirm?.kind === 'check' ? t('confirm.delete_check') : t('confirm.delete_service')}
        confirmLabel={t('btn.delete')}
        loading={remove.isPending}
        onConfirm={() => confirm && remove.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
