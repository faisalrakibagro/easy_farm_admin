'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { MedicineBatch, MedicineBatchSummary, Medicine } from '@/types';
import { Package, AlertTriangle, CheckCircle } from 'lucide-react';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { BatchSource, BatchStatCards, initialParam } from '@/components/stock/BatchParts';
import type { ColDef } from '@/lib/schemas/types';
import { fmtDate, fmtMoney, fmtNum } from '@/lib/format';

export default function MedicineBatchesPage() {
  const { t } = useTranslation('medicine');
  const [availableOnly, setAvailableOnly] = useState(false);
  // The overview links here with ?medicine_id=… to show one medicine's batches.
  const [selectedMedicine, setSelectedMedicine] = useState(() => initialParam('medicine_id'));
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'expiry', dir: 'asc' }, setPage);

  const { data: batchesData, isLoading, isError, refetch } = useQuery<{ batches: MedicineBatch[]; summary?: MedicineBatchSummary; last_page?: number; total?: number }>({
    queryKey: ['medicine-batches', availableOnly, selectedMedicine, page, sorting.params],
    queryFn: async () => (await api.get('/farm/medicine-purchases/batches', {
      params: {
        available_only: availableOnly ? 1 : undefined,
        medicine_id: selectedMedicine || undefined,
        page,
        per_page: 15,
        ...sorting.params,
      },
    })).data,
  });

  const { data: medicinesData } = useQuery<{ medicines: Medicine[] }>({
    queryKey: ['medicines-all'],
    queryFn: async () => (await api.get('/farm/medicine/all')).data,
  });

  const batches = batchesData?.batches ?? [];
  const summary = batchesData?.summary;
  const medicines = medicinesData?.medicines ?? [];

  // "Now" is read once when the page opens, so the badges don't change between renders.
  const [now] = useState(() => Date.now());

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const diff = (new Date(date).getTime() - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date).getTime() < now;
  };

  const unit = (b: MedicineBatch) => b.medicine?.unit?.symbol ?? '';

  const cols: ColDef<MedicineBatch>[] = [
    {
      key: 'medicine', labelKey: 'medicine:batches.col.medicine', align: 'left',
      render: b => (
        <div className="flex items-center gap-2">
          <Package size={13} className="text-slate-400 shrink-0" />
          {b.medicine ? b.medicine.name : ''}
        </div>
      ),
    },
    {
      key: 'supplier', labelKey: 'medicine:batches.col.supplier', align: 'left',
      render: b => <BatchSource name={b.supplier_name} invoice={b.invoice_no ? t('batches.invoice', { no: b.invoice_no }) : null} />,
    },
    { key: 'batch_number', labelKey: 'medicine:batches.col.batch_no', align: 'left', render: b => <span className="font-mono text-slate-600 text-xs">{b.batch_number}</span> },
    { key: 'purchase_date', labelKey: 'medicine:batches.col.purchase_date', align: 'left', sortKey: 'purchased', sortType: 'date', render: b => <span className="text-slate-500">{b.purchase_date ? fmtDate(b.purchase_date) : '—'}</span> },
    {
      key: 'expiry_date', labelKey: 'medicine:batches.col.expiry_date', align: 'left', sortKey: 'expiry', sortType: 'due',
      render: b => (
        <span className={isExpired(b.expiry_date) ? 'text-red-600 font-medium' : isExpiringSoon(b.expiry_date) ? 'text-orange-500 font-medium' : 'text-slate-500'}>
          {b.expiry_date ? fmtDate(b.expiry_date) : '—'}
        </span>
      ),
    },
    { key: 'quantity_received', labelKey: 'medicine:batches.col.received', align: 'right', render: b => <span className="text-slate-600">{fmtNum(b.quantity_received)} {unit(b)}</span> },
    { key: 'quantity_used', labelKey: 'medicine:batches.col.used', align: 'right', render: b => <span className="text-slate-500">{fmtNum(b.quantity_used)} {unit(b)}</span> },
    {
      key: 'quantity_remaining', labelKey: 'medicine:batches.col.remaining', align: 'right', sortKey: 'remaining', sortType: 'number',
      render: b => (
        <span className={`font-semibold ${parseFloat(b.quantity_remaining) === 0 ? 'text-slate-400' : 'text-slate-700'}`}>
          {fmtNum(b.quantity_remaining)} {unit(b)}
        </span>
      ),
    },
    { key: 'unit_price', labelKey: 'medicine:batches.col.unit_price', align: 'right', render: b => <span className="text-slate-600">{fmtMoney(b.unit_price)}</span> },
    {
      key: 'remaining_value', labelKey: 'medicine:batches.col.remaining_value', align: 'right', sortKey: 'value', sortType: 'number',
      render: b => <span className="text-slate-700">{fmtMoney(parseFloat(b.quantity_remaining) * parseFloat(b.unit_price))}</span>,
    },
    {
      key: 'status', labelKey: 'medicine:batches.col.status', align: 'left',
      render: b => {
        const expired = isExpired(b.expiry_date);
        const expiringSoon = isExpiringSoon(b.expiry_date);
        const empty = parseFloat(b.quantity_remaining) === 0;
        return empty ? (
          <span className="text-xs text-slate-400">{t('common:ui.empty')}</span>
        ) : expired ? (
          <span className="flex items-center gap-1 text-xs text-red-600"><AlertTriangle size={11} /> {t('common:ui.expired')}</span>
        ) : expiringSoon ? (
          <span className="flex items-center gap-1 text-xs text-orange-500"><AlertTriangle size={11} /> {t('common:ui.expiring_soon')}</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={11} /> {t('common:ui.available')}</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{t('batches.title')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t('batches.hint')}</p>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <select value={selectedMedicine} onChange={e => { setSelectedMedicine(e.target.value); setPage(1); }}
          aria-label={t('usage.filter.all_medicines')}
          className="min-w-0 flex-1 sm:flex-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('usage.filter.all_medicines')}</option>
          {medicines.map(m => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
        </select>
        <label className="flex items-center gap-2 min-h-10 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={availableOnly} onChange={e => { setAvailableOnly(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded border-slate-300" />
          {t('common:ui.available_only')}
        </label>
      </div>

      {/* Totals over the whole filtered list, not just this page. */}
      <BatchStatCards items={[
        { label: t('batches.total'), value: fmtNum(summary?.total ?? batchesData?.total ?? batches.length) },
        { label: t('common:ui.expiring_soon_30'), value: fmtNum(summary?.expiring_soon ?? batches.filter(b => isExpiringSoon(b.expiry_date)).length), tone: 'orange' },
        { label: t('common:ui.expired'), value: fmtNum(summary?.expired ?? batches.filter(b => isExpired(b.expiry_date)).length), tone: 'red' },
        { label: t('batches.remaining_value'), value: fmtMoney(summary?.remaining_value ?? 0), tone: 'blue' },
      ]} />

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={batches}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        keyExtractor={b => b.id}
        rowClassName={b => isExpired(b.expiry_date) && parseFloat(b.quantity_remaining) > 0 ? 'bg-red-50/30' : ''}
        emptyKey="medicine:batches.empty"
        currentPage={page}
        lastPage={batchesData?.last_page ?? 1}
        totalCount={batchesData?.total}
        onPageChange={setPage}
      />
    </div>
  );
}
