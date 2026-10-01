'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Link from '@/components/ui/AppLink';
import api from '@/lib/api';
import { FeedPurchase, FeedItem, Supplier, AccountingPaymentAccount } from '@/types';
import { Plus, Trash2, Eye, Pencil } from 'lucide-react';
import { normalizeNumber } from '@/lib/normalizeNumbers';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { FEED_STOCK_KEYS, MONEY_KEYS, invalidateMoney } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import { useDateRange } from '@/lib/hooks/useDateRange';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import FeedPurchaseDetailModal from '@/components/feed/purchases/FeedPurchaseDetailModal';
import FeedPurchaseEditModal from '@/components/feed/purchases/FeedPurchaseEditModal';
import FeedPurchaseCreateModal from '@/components/feed/purchases/FeedPurchaseCreateModal';
import FeedPurchaseDeleteModal from '@/components/feed/purchases/FeedPurchaseDeleteModal';
import { useAutoOpen } from '@/lib/hooks/useAutoOpen';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';

interface FeedPurchaseFull extends FeedPurchase {
  supplier_id?: number | null;
  supplier?: { id: number; name: string } | null;
  payment_account_id?: number | null;
  payment_account?: AccountingPaymentAccount | null;
  payment_status?: 'paid' | 'partial' | 'unpaid';
  paid_amount?: string | number;
  due_amount?: string | number;
}

interface EditItem {
  id: number; name: string; quantity: string; unit_price: string; unit_symbol: string;
}

interface PurchaseItem { feed_item_id: string; quantity: string; unit_price: string; }

const EMPTY_FORM = {
  supplier_id: '', supplier_name: '', supplier_phone: '', invoice_no: '',
  purchase_date: localDateStr(),
  payment_account_id: '', payment_status: 'paid', paid_amount: '',
};

const feedPurchasesApi = createCrudService<FeedPurchaseFull, { data: FeedPurchaseFull[]; last_page: number; total: number }>('/farm/feed/purchases');
const feedPurchasesKeys = createResourceKeys('feed-purchases');

export default function FeedPurchasesPage() {
  const { t } = useTranslation('feed');
  const { t: tc } = useTranslation('common');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const invoiceRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<FeedPurchaseFull | null>(null);
  const [editPurchase, setEditPurchase] = useState<FeedPurchaseFull | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [notes, setNotes] = useState('');
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM, notes: '' });
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([{ feed_item_id: '', quantity: '', unit_price: '' }]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string[]>>({});
  const [deleteTarget, setDeleteTarget] = useState<FeedPurchaseFull | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const resource = useCrudResource(feedPurchasesApi, feedPurchasesKeys, {
    extraInvalidateKeys: [...MONEY_KEYS, ...FEED_STOCK_KEYS, ['feed-purchases-trash']],
  });
  const dateRange = useDateRange(setPage);
  const { data, isLoading } = resource.useList({ ...sorting.params, page, per_page: 15, ...dateRange.params });

  const { data: itemsData } = useQuery<{ items: FeedItem[] }>({
    queryKey: ['feed-items-all'],
    queryFn: async () => (await api.get('/farm/feed/items/all')).data,
  });

  const { data: suppliersData } = useQuery<{ suppliers: Supplier[] }>({
    queryKey: ['suppliers-all', 'feed'],
    queryFn: async () => (await api.get('/suppliers/all', { params: { type: 'feed' } })).data,
  });

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const validateCreate = () => {
    const e: Record<string, string> = {};
    if (!form.purchase_date) e.purchase_date = t('common:form.v.date_required');
    if (!form.supplier_id && !form.supplier_name.trim()) e.supplier_name = t('common:form.v.supplier_name_required');
    const validItems = items.filter(it => it.feed_item_id && parseFloat(normalizeNumber(it.quantity)) > 0);
    if (validItems.length === 0) e.items = t('common:form.v.items_required');
    if (form.payment_status === 'partial' && !(parseFloat(normalizeNumber(form.paid_amount)) > 0)) e.paid_amount = t('common:form.v.paid_amount_required');
    if (form.payment_status !== 'unpaid' && !form.payment_account_id) e.payment_account_id = t('common:form.v.account_required');
    setClientErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateEdit = () => {
    const e: Record<string, string[]> = {};
    if (!editForm.purchase_date) e.purchase_date = [t('common:form.v.date_required')];
    if (editForm.payment_status === 'partial' && !(parseFloat(normalizeNumber(editForm.paid_amount)) > 0)) e.paid_amount = [t('common:form.v.paid_amount_required')];
    if (editForm.payment_status !== 'unpaid' && !editForm.payment_account_id) e.payment_account_id = [t('common:form.v.account_required')];
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCreate()) return;
    setFormError('');
    setIsSaving(true);
    try {
      const fd = new FormData();
      if (notes) fd.append('notes', notes);
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'paid_amount' && form.payment_status !== 'partial') return;
        if (k === 'payment_account_id' && form.payment_status === 'unpaid') return;
        if (String(v) !== '') fd.append(k, String(v));
      });
      items.forEach((item, i) => {
        fd.append(`items[${i}][feed_item_id]`, item.feed_item_id);
        fd.append(`items[${i}][quantity]`, normalizeNumber(item.quantity));
        fd.append(`items[${i}][unit_price]`, normalizeNumber(item.unit_price));
      });
      if (invoiceFile) fd.append('receipt_file', invoiceFile);
      const res = await api.post('/farm/feed/purchases', fd);
      invalidateMoney(qc, [...FEED_STOCK_KEYS, ['feed-purchases']]);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
      setShowCreateModal(false);
      setNotes('');
      setForm({ ...EMPTY_FORM });
      setItems([{ feed_item_id: '', quantity: '', unit_price: '' }]);
      setInvoiceFile(null);
      setFormErrors({});
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const fieldErrors = e.response?.data?.errors ?? {};
      setFormErrors(fieldErrors);
      // Field errors show under their fields; only anything else goes to the top.
      setFormError(Object.keys(fieldErrors).length ? '' : e.response?.data?.message ?? failedMsg());
      toast.error(Object.values(fieldErrors)[0]?.[0] ?? e.response?.data?.message ?? failedMsg());
    } finally {
      setIsSaving(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data, items }: { id: number; data: typeof EMPTY_FORM; items: { id: number; unit_price: string }[] }) => {
      const payload: Record<string, unknown> = { ...data, items };
      if (data.payment_status === 'unpaid') { delete payload.payment_account_id; }
      if (data.payment_status !== 'partial') { delete payload.paid_amount; }
      return api.patch(`/farm/feed/purchases/${id}`, payload);
    },
    onSuccess: (res) => {
      invalidateMoney(qc, [...FEED_STOCK_KEYS, ['feed-purchases']]);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
      setEditPurchase(null);
      setEditErrors({});
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const fieldErrors = err.response?.data?.errors ?? {};
      setEditErrors(fieldErrors);
      setEditError(Object.keys(fieldErrors).length ? '' : err.response?.data?.message ?? failedMsg());
      toast.error(Object.values(fieldErrors)[0]?.[0] ?? err.response?.data?.message ?? failedMsg());
    },
  });

  const deleteMutation = resource.useRemove({
    onSuccess: (res) => {
      toast.success(res.message ?? trashedMsg());
      setViewPurchase(null);
      setDeleteTarget(null);
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    },
  });

  const addItem = () => setItems(prev => [...prev, { feed_item_id: '', quantity: '', unit_price: '' }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: keyof PurchaseItem, val: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const totalCost = items.reduce((sum, it) =>
    sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);

  const openEdit = (p: FeedPurchaseFull) => {
    setEditPurchase(p);
    setEditForm({
      supplier_id: p.supplier_id ? String(p.supplier_id) : '',
      supplier_name: p.supplier_name ?? '',
      supplier_phone: p.supplier_phone ?? '',
      invoice_no: p.invoice_no ?? '',
      purchase_date: p.purchase_date ? p.purchase_date.split('T')[0] : '',
      notes: p.notes ?? '',
      payment_account_id: p.payment_account_id ? String(p.payment_account_id) : '',
      payment_status: p.payment_status ?? 'paid',
      paid_amount: p.paid_amount ? String(p.paid_amount) : '',
    });
    setEditItems((p.items ?? []).map((pi: { id?: number; item?: { name?: string; unit?: { symbol?: string } }; quantity: string; unit_price: string }) => ({
      id: pi.id ?? 0,
      name: pi.item?.name ?? '',
      quantity: String(pi.quantity),
      unit_price: String(pi.unit_price),
      unit_symbol: pi.item?.unit?.symbol ?? '',
    })));
    setEditError('');
    setEditErrors({});
  };

  const purchases = data?.data ?? [];
  const feedItems = itemsData?.items ?? [];
  const suppliers = suppliersData?.suppliers ?? [];
  const paymentAccounts = paymentAccountsData?.payment_accounts ?? [];

  const getSupplierName = (p: FeedPurchaseFull) => p.supplier?.name ?? p.supplier_name ?? '—';

  const cols: ColDef<FeedPurchaseFull>[] = [
    { key: 'date', labelKey: 'feed:purchases.col.date', align: 'left', sortKey: 'date', sortType: 'date', render: p => <span className="font-medium text-slate-700">{new Date(p.purchase_date).toLocaleDateString(localeFor())}</span> },
    { key: 'supplier', labelKey: 'feed:purchases.col.supplier', align: 'left', render: p => <span className="text-slate-700">{getSupplierName(p)}</span> },
    { key: 'invoice', labelKey: 'feed:purchases.col.invoice', align: 'left', render: p => <span className="text-slate-500">{p.invoice_no || '—'}</span> },
    { key: 'total_cost', labelKey: 'feed:purchases.col.total_cost', align: 'right', sortKey: 'total', sortType: 'number', render: p => <span className="font-medium text-slate-800">{fmtMoney(p.total_cost)}</span> },
    {
      key: 'payment', labelKey: 'feed:purchases.col.payment', align: 'left',
      render: p => (
        <>
          {p.payment_status === 'paid' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('purchases.status.paid')}</span>}
          {p.payment_status === 'partial' && (
            <div>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t('purchases.status.partial')}</span>
              <p className="text-xs text-red-500 mt-0.5">{t('purchases.status.due')}: {fmtMoney(p.due_amount ?? 0)}</p>
            </div>
          )}
          {p.payment_status === 'unpaid' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{t('purchases.status.unpaid')}</span>}
          {!p.payment_status && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('purchases.status.paid')}</span>}
        </>
      ),
    },
    {
      key: 'paid_from', labelKey: 'feed:purchases.col.paid_from', align: 'left',
      render: p => p.payment_account ? (
        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{p.payment_account.name}</span>
      ) : p.payment_status === 'unpaid' ? <span className="text-xs text-red-300">—</span> : <span className="text-xs text-slate-300">—</span>,
    },
    {
      key: '_actions', labelKey: '', align: 'right',
      render: p => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setViewPurchase(p)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" title={t('purchases.tooltip.view_details')}>
            <Eye size={14} />
          </button>
          <button onClick={() => openEdit(p)}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400" title={tc('btn.edit')}>
            <Pencil size={14} />
          </button>
          {isSuperAdmin && (
            <button onClick={() => setDeleteTarget(p)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title={tc('btn.delete')}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Reached from a dashboard quick action (?new=1): open the form straight away.
  useAutoOpen(() => { setShowCreateModal(true); setFormError(''); setFormErrors({}); setClientErrors({}); });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('purchases.title')}</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link href="/farm/feed/purchases/trash"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg flex-1 sm:flex-none justify-center">
            <Trash2 size={14} /> {t('purchases.trash.btn.view_trash')}
          </Link>
          <button onClick={() => { setShowCreateModal(true); setFormError(''); setFormErrors({}); setClientErrors({}); }}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
            <Plus size={16} /> {t('purchases.record')}
          </button>
        </div>
      </div>

      <DateRangeFilter value={dateRange.range} onChange={dateRange.setRange} />

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={purchases}
        isLoading={isLoading}
        keyExtractor={p => p.id}
        emptyKey="feed:purchases.empty"
        currentPage={page}
        lastPage={data?.last_page ?? 1}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      {/* Detail Modal */}
      {viewPurchase && (
        <FeedPurchaseDetailModal
          purchase={viewPurchase}
          onClose={() => setViewPurchase(null)}
          isSuperAdmin={isSuperAdmin}
          getSupplierName={getSupplierName}
          onEdit={() => { openEdit(viewPurchase); setViewPurchase(null); }}
          onDelete={() => { setDeleteTarget(viewPurchase); setViewPurchase(null); }}
        />
      )}

      {/* Edit Modal */}
      {editPurchase && (
        <FeedPurchaseEditModal
          onClose={() => setEditPurchase(null)}
          onSubmit={e => { e.preventDefault(); setEditError(''); if (!validateEdit()) return; updateMutation.mutate({ id: editPurchase.id, data: editForm, items: editItems.map(it => ({ id: it.id, unit_price: it.unit_price })) }); }}
          editForm={editForm}
          setEditForm={setEditForm}
          editItems={editItems}
          setEditItems={setEditItems}
          editError={editError}
          editErrors={editErrors}
          suppliers={suppliers}
          paymentAccounts={paymentAccounts}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <FeedPurchaseCreateModal
          onClose={() => { setShowCreateModal(false); setInvoiceFile(null); }}
          onCancel={() => { setShowCreateModal(false); setInvoiceFile(null); setNotes(''); }}
          onSubmit={handleCreate}
          form={form}
          setForm={setForm}
          notes={notes}
          setNotes={setNotes}
          items={items}
          addItem={addItem}
          removeItem={removeItem}
          updateItem={updateItem}
          totalCost={totalCost}
          clientErrors={clientErrors}
          setClientErrors={setClientErrors}
          formErrors={formErrors}
          formError={formError}
          feedItems={feedItems}
          suppliers={suppliers}
          paymentAccounts={paymentAccounts}
          invoiceFile={invoiceFile}
          setInvoiceFile={setInvoiceFile}
          invoiceRef={invoiceRef}
          isSaving={isSaving}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <FeedPurchaseDeleteModal
          purchase={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          isPending={deleteMutation.isPending}
          getSupplierName={getSupplierName}
        />
      )}
    </div>
  );
}
