'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { SerialCell, SerialHeader, SortHeader, SortSelect, TablePagination } from '@/components/ui/TableControls';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { MilkSale, PaginatedResponse } from '@/types';
import { apiError, dateOnly, money } from '@/components/breeding/shared';
import MilkSaleModal from '@/components/dairy/MilkSaleModal';
import { useAutoOpen } from '@/lib/hooks/useAutoOpen';
import { fmtDate, fmtNum } from '@/lib/format';

const STATUS_CLS: Record<string, string> = {
  paid: 'bg-green-50 text-green-700', partial: 'bg-amber-50 text-amber-700', unpaid: 'bg-red-50 text-red-700',
};

export default function MilkSalesPage() {
  const { t } = useTranslation('dairy');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);
  const [saleType, setSaleType] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<MilkSale | null | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<MilkSale>>({
    queryKey: ['dairy', 'sales', page, saleType, status, sorting.params],
    queryFn: async () => (await api.get('/farm/dairy/sales', {
      params: { page, per_page: 15, sale_type: saleType || undefined, payment_status: status || undefined, ...sorting.params },
    })).data,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/dairy/sales/${id}`),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.deleted'));
      invalidateMoney(qc, [['dairy'], ['customers'], ['cattle-dairy-history'], ['cattle-ledger']]);
      setDeleteId(null);
    },
    onError: e => { toast.error(apiError(e, t('toast.failed')).message); setDeleteId(null); },
  });

  const rows = data?.data ?? [];

  // Reached from a dashboard quick action (?new=1): open the form straight away.
  useAutoOpen(() => setEditing(null));

  const buyer = (s: MilkSale) => (s.customer
    ? <Link href={`/customers/${s.customer.id}`} className="text-slate-800 hover:text-blue-600">{s.customer.company_name || s.customer.name}</Link>
    : <span className="text-slate-500">{s.buyer_name || '—'}</span>);
  const period = (s: MilkSale) => (dateOnly(s.period_from) === dateOnly(s.period_to) ? fmtDate(s.period_from) : `${fmtDate(s.period_from)} – ${fmtDate(s.period_to)}`);
  const payment = (s: MilkSale) => (
    <>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[s.payment_status]}`}>{t('payment_status.' + s.payment_status)}</span>
      {parseFloat(s.due_amount) > 0 && <span className="block text-xs text-red-600 mt-0.5">{t('field.due_amount')} {money(s.due_amount)}</span>}
    </>
  );
  const actions = (s: MilkSale) => (
    <div className="flex justify-end gap-1">
      {hasPermission('farm.dairy.edit') && (
        <button onClick={() => setEditing(s)} title={t('btn.edit')} aria-label={t('btn.edit')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
      )}
      {hasPermission('farm.dairy.delete') && (
        <button onClick={() => setDeleteId(s.id)} title={t('btn.delete')} aria-label={t('btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={saleType} onChange={e => { setSaleType(e.target.value); setPage(1); }} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('field.all')}</option>
          <option value="wholesale">{t('sale_type.wholesale')}</option>
          <option value="retail">{t('sale_type.retail')}</option>
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('field.payment_status')}</option>
          {['paid', 'partial', 'unpaid'].map(s => <option key={s} value={s}>{t('payment_status.' + s)}</option>)}
        </select>
        <div className="flex-1" />
        {hasPermission('farm.dairy.create') && (
          <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
            <Plus size={15} /> {t('btn.add_sale')}
          </button>
        )}
      </div>

      {/* Phones: one card per sale */}
      <div className="sm:hidden bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <SortSelect options={[
          { key: 'date', label: t('col.date'), type: 'date' },
          { key: 'quantity', label: t('col.kg_rate'), type: 'number' },
          { key: 'amount', label: t('col.amount'), type: 'number' },
        ]} sorting={sorting} className="px-4 py-2.5" />
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 m-3 bg-slate-50 rounded animate-pulse" />)
          : rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">{t('empty')}</p>
          : rows.map(s => (
            <div key={s.id} className="p-4 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 break-words">
                  <p className="font-medium">{buyer(s)}</p>
                  <p className="text-xs text-slate-500">
                    {fmtDate(s.sale_date)} · <span className={s.sale_type === 'wholesale' ? 'text-indigo-600' : ''}>{t('sale_type.' + s.sale_type)}</span>
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-slate-800">{money(s.amount)}</p>
              </div>
              <p className="text-xs text-slate-500">{fmtNum(s.quantity_kg)} × {money(s.rate)} · {t('col.period')}: {period(s)}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">{payment(s)}</div>
                {actions(s)}
              </div>
            </div>
          ))}
      </div>

      <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-start text-slate-600">
              <SerialHeader />
              <SortHeader label={t('col.date')} sortKey="date" sortType="date" sorting={sorting} />
              <th className="px-4 py-3 font-medium">{t('col.buyer')}</th>
              <SortHeader label={t('col.kg_rate')} sortKey="quantity" sortType="number" sorting={sorting} />
              <SortHeader label={t('col.amount')} align="right" sortKey="amount" sortType="number" sorting={sorting} />
              <th className="px-4 py-3 font-medium">{t('col.status')}</th>
              <th className="px-4 py-3 font-medium">{t('col.period')}</th>
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
                <td className="px-4 py-3 text-slate-700">{fmtDate(s.sale_date)}
                  <span className={`block text-xs ${s.sale_type === 'wholesale' ? 'text-indigo-600' : 'text-slate-400'}`}>{t('sale_type.' + s.sale_type)}</span>
                </td>
                <td className="px-4 py-3">{buyer(s)}</td>
                <td className="px-4 py-3 text-slate-600">{fmtNum(s.quantity_kg)} × {money(s.rate)}</td>
                <td className="px-4 py-3 text-end font-medium text-slate-800">{money(s.amount)}</td>
                <td className="px-4 py-3">{payment(s)}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{period(s)}</td>
                <td className="px-4 py-3">{actions(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data?.total ?? 0) > 0 && (
        <TablePagination page={page} lastPage={data?.last_page ?? 1} total={data?.total} perPage={15} onPageChange={setPage} className="" />
      )}

      {editing !== undefined && <MilkSaleModal sale={editing} onClose={() => setEditing(undefined)} />}
      <ConfirmDialog open={deleteId !== null} title={t('btn.delete')} message={t('confirm.delete_sale')} confirmLabel={t('btn.delete')}
        loading={remove.isPending} onConfirm={() => deleteId !== null && remove.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
