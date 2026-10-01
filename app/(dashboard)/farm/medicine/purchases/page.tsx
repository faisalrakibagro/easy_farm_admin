'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { MedicinePurchase, Medicine, Supplier, AccountingPaymentAccount } from '@/types';
import { Plus, Trash2, Eye, Pencil } from 'lucide-react';
import { normalizeNumber } from '@/lib/normalizeNumbers';
import { apiFieldErrors } from '@/lib/hooks/useFormErrors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { MEDICINE_STOCK_KEYS, MONEY_KEYS, invalidateMoney } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import { useDateRange } from '@/lib/hooks/useDateRange';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import DetailModal from '@/components/medicine/purchases/DetailModal';
import EditModal from '@/components/medicine/purchases/EditModal';
import CreateModal from '@/components/medicine/purchases/CreateModal';
import TrashLink from '@/components/ui/TrashLink';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';

interface MedicinePurchaseFull extends MedicinePurchase {
  payment_account_id?: number | null;
  payment_account?: AccountingPaymentAccount | null;
  payment_status?: 'paid' | 'partial' | 'unpaid';
  paid_amount?: string | number;
  due_amount?: string | number;
}

interface EditItem {
  id: number; name: string; batch_number: string; quantity: string;
  unit_price: string; unit_symbol: string; expiry_date: string;
}

interface PurchaseItem {
  medicine_id: string; batch_number: string; quantity: string;
  unit_price: string; expiry_date: string; notes: string;
}

const medicinePurchasesApi = createCrudService<MedicinePurchaseFull, { data: MedicinePurchaseFull[]; last_page: number; total: number }>('/farm/medicine-purchases');
const medicinePurchasesKeys = createResourceKeys('medicine-purchases');

const EMPTY_ITEM: PurchaseItem = { medicine_id: '', batch_number: '', quantity: '', unit_price: '', expiry_date: '', notes: '' };
const EMPTY_FORM = {
  supplier_id: '', supplier_name: '', supplier_phone: '', invoice_no: '',
  purchase_date: localDateStr(), payment_account_id: '',
  payment_status: 'paid', paid_amount: '',
};

export default function MedicinePurchasesPage() {
  const { t } = useTranslation('medicine');
  const { t: tc } = useTranslation('common');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const receiptRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<MedicinePurchaseFull | null>(null);
  const [editPurchase, setEditPurchase] = useState<MedicinePurchaseFull | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [notes, setNotes] = useState('');
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM, notes: '' });
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([{ ...EMPTY_ITEM }]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MedicinePurchaseFull | null>(null);

  const resource = useCrudResource(medicinePurchasesApi, medicinePurchasesKeys, {
    extraInvalidateKeys: [...MONEY_KEYS, ...MEDICINE_STOCK_KEYS, ['medicine-purchases-trash']],
  });
  const dateRange = useDateRange(setPage);
  const { data, isLoading } = resource.useList({ ...sorting.params, page, per_page: 15, ...dateRange.params });

  const { data: medicinesData } = useQuery<{ medicines: Medicine[] }>({
    queryKey: ['medicines-all'],
    queryFn: async () => (await api.get('/farm/medicine/all')).data,
  });

  const { data: suppliersData } = useQuery<{ suppliers: Supplier[] }>({
    queryKey: ['suppliers-all', 'medicine'],
    queryFn: async () => (await api.get('/suppliers/all', { params: { type: 'medicine' } })).data,
  });

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const validateCreate = () => {
    const e: Record<string, string> = {};
    if (!form.purchase_date) e.purchase_date = t('common:form.v.date_required');
    if (form.payment_status === 'partial' && !(parseFloat(normalizeNumber(form.paid_amount)) > 0)) e.paid_amount = t('common:form.v.paid_amount_required');
    if (form.payment_status !== 'unpaid' && !form.payment_account_id) e.payment_account_id = t('common:form.v.account_required');
    if (!form.supplier_phone && !form.invoice_no) e.supplier_contact = t('common:form.v.contact_required');
    const picked = items.filter(it => it.medicine_id);
    if (!picked.some(it => parseFloat(normalizeNumber(it.quantity)) > 0)) e.items = t('common:form.v.items_required');
    else if (picked.some(it => !it.batch_number.trim() || !(parseFloat(normalizeNumber(it.quantity)) > 0) || it.unit_price.trim() === '')) e.items = t('common:form.v.items_incomplete');
    setErrors(e);
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
        fd.append(`items[${i}][medicine_id]`, item.medicine_id);
        fd.append(`items[${i}][batch_number]`, item.batch_number);
        fd.append(`items[${i}][quantity]`, normalizeNumber(item.quantity));
        fd.append(`items[${i}][unit_price]`, normalizeNumber(item.unit_price));
        if (item.expiry_date) fd.append(`items[${i}][expiry_date]`, item.expiry_date);
        if (item.notes) fd.append(`items[${i}][notes]`, item.notes);
      });
      if (receiptFile) fd.append('receipt_file', receiptFile);
      const res = await api.post('/farm/medicine-purchases', fd);
      invalidateMoney(qc, [...MEDICINE_STOCK_KEYS, ['medicine-purchases']]);
      setShowCreateModal(false);
      setNotes('');
      setForm({ ...EMPTY_FORM });
      setItems([{ ...EMPTY_ITEM }]);
      setReceiptFile(null);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    } catch (err) {
      // Field errors under their fields; anything else at the top.
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
      toast.error(Object.values(fields)[0] ?? message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data, items }: { id: number; data: typeof EMPTY_FORM; items: { id: number; unit_price: string }[] }) => {
      const payload: Record<string, unknown> = { ...data, items };
      if (data.payment_status === 'unpaid') { delete payload.payment_account_id; }
      if (data.payment_status !== 'partial') { delete payload.paid_amount; }
      return api.patch(`/farm/medicine-purchases/${id}`, payload);
    },
    onSuccess: (res) => {
      invalidateMoney(qc, [...MEDICINE_STOCK_KEYS, ['medicine-purchases']]);
      setEditPurchase(null);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setEditErrors(fields);
      setEditError(Object.keys(fields).length ? '' : message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  const deleteMutation = resource.useRemove({
    onSuccess: (res) => {
      setViewPurchase(null);
      setDeleteTarget(null);
      toast.success(res.message ?? trashedMsg());
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? failedMsg());
    },
  });

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: keyof PurchaseItem, val: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const totalCost = items.reduce((s, it) =>
    s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);

  const openEdit = (p: MedicinePurchaseFull) => {
    setEditPurchase(p);
    setEditForm({
      supplier_id: p.supplier_id ? String(p.supplier_id) : '',
      supplier_name: p.supplier_name ?? '',
      supplier_phone: p.supplier_phone ?? '',
      invoice_no: p.invoice_no ?? '',
      purchase_date: p.purchase_date ? p.purchase_date.split('T')[0] : localDateStr(),
      notes: p.notes ?? '',
      payment_account_id: p.payment_account_id ? String(p.payment_account_id) : '',
      payment_status: p.payment_status ?? 'paid',
      paid_amount: p.paid_amount ? String(p.paid_amount) : '',
    });
    setEditItems((p.items ?? []).map(pi => ({
      id: pi.id ?? 0,
      name: pi.medicine?.name ?? '',
      batch_number: pi.batch_number,
      quantity: String(pi.quantity),
      unit_price: String(pi.unit_price),
      unit_symbol: pi.medicine?.unit?.symbol ?? '',
      expiry_date: pi.expiry_date ?? '',
    })));
    setEditError('');
    setEditErrors({});
  };

  const medicines = medicinesData?.medicines ?? [];
  const suppliers = suppliersData?.suppliers ?? [];
  const paymentAccounts = paymentAccountsData?.payment_accounts ?? [];
  const purchases = data?.data ?? [];
  const getSupplierName = (p: MedicinePurchaseFull) => p.supplier?.name ?? p.supplier_name ?? '—';

  const cols: ColDef<MedicinePurchaseFull>[] = [
    { key: 'date', labelKey: 'medicine:purchases.col.date', align: 'left', sortKey: 'date', sortType: 'date', render: p => <span className="font-medium text-slate-700">{new Date(p.purchase_date).toLocaleDateString(localeFor())}</span> },
    { key: 'supplier', labelKey: 'medicine:purchases.col.supplier', align: 'left', render: p => <span className="text-slate-700">{getSupplierName(p)}</span> },
    { key: 'invoice', labelKey: 'medicine:purchases.col.invoice', align: 'left', render: p => <span className="text-slate-500">{p.invoice_no || '—'}</span> },
    { key: 'items', labelKey: 'medicine:purchases.col.items', align: 'left', render: p => <span className="text-slate-500 text-xs">{p.items?.length ?? 0} item{(p.items?.length ?? 0) !== 1 ? 's' : ''}</span> },
    { key: 'total_cost', labelKey: 'medicine:purchases.col.total_cost', align: 'right', sortKey: 'total', sortType: 'number', render: p => <span className="font-medium text-slate-800">{fmtMoney(p.total_cost)}</span> },
    {
      key: 'payment', labelKey: 'medicine:purchases.label.payment', align: 'left',
      render: p => (
        <>
          {p.payment_status === 'paid' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('purchases.label.paid_full')} ✅</span>}
          {p.payment_status === 'partial' && (
            <div>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t('purchases.label.partial')} ⚠️</span>
              <p className="text-xs text-red-500 mt-0.5">{t('purchases.label.due')}: {fmtMoney(p.due_amount ?? 0)}</p>
            </div>
          )}
          {p.payment_status === 'unpaid' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{t('purchases.label.unpaid')} ❌</span>}
          {!p.payment_status && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('purchases.label.paid_full')} ✅</span>}
        </>
      ),
    },
    {
      key: 'paid_from', labelKey: 'medicine:purchases.col.paid_from', align: 'left',
      render: p => p.payment_account ? (
        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{p.payment_account.name}</span>
      ) : p.payment_status === 'unpaid' ? <span className="text-xs text-red-300">—</span> : <span className="text-xs text-slate-300">—</span>,
    },
    {
      key: '_actions', labelKey: '', align: 'right',
      render: p => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setViewPurchase(p)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" title={t('purchases.action.view_details')}>
            <Eye size={14} />
          </button>
          <button onClick={() => openEdit(p)}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400" title={t('purchases.action.edit')}>
            <Pencil size={14} />
          </button>
          {isSuperAdmin && (
            <button onClick={() => setDeleteTarget(p)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title={t('purchases.action.delete')}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('purchases.title')}</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <TrashLink href="/farm/medicine/purchases/trash" label={t('purchases.label.trash')} />
          <button onClick={() => { setShowCreateModal(true); setFormError(''); setErrors({}); }}
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
        emptyKey="medicine:purchases.empty"
        currentPage={page}
        lastPage={data?.last_page ?? 1}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('btn.move_to_trash')}
        message={t('purchases.trash.confirm_move')}
        confirmLabel={tc('btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <DetailModal
        purchase={viewPurchase}
        onClose={() => setViewPurchase(null)}
        isSuperAdmin={isSuperAdmin}
        getSupplierName={getSupplierName}
        onDelete={() => setDeleteTarget(viewPurchase)}
        onEdit={() => { if (!viewPurchase) return; openEdit(viewPurchase); setViewPurchase(null); }}
      />

      <EditModal
        purchase={editPurchase}
        onClose={() => setEditPurchase(null)}
        editForm={editForm}
        setEditForm={setEditForm}
        editError={editError}
        setEditError={setEditError}
        editErrors={editErrors}
        setEditErrors={setEditErrors}
        editItems={editItems}
        setEditItems={setEditItems}
        suppliers={suppliers}
        paymentAccounts={paymentAccounts}
        isPending={updateMutation.isPending}
        onSubmit={e => {
          e.preventDefault();
          if (!editPurchase) return;
          const v: Record<string, string> = {};
          if (!editForm.purchase_date) v.purchase_date = t('common:form.v.date_required');
          if (!editForm.supplier_phone && !editForm.invoice_no) v.supplier_contact = t('common:form.v.contact_required');
          if (editForm.payment_status === 'partial' && !(parseFloat(normalizeNumber(editForm.paid_amount)) > 0)) v.paid_amount = t('common:form.v.paid_amount_required');
          if (editForm.payment_status !== 'unpaid' && !editForm.payment_account_id) v.payment_account_id = t('common:form.v.account_required');
          setEditErrors(v);
          setEditError('');
          if (Object.keys(v).length) return;
          updateMutation.mutate({ id: editPurchase.id, data: editForm, items: editItems.map(it => ({ id: it.id, unit_price: it.unit_price })) });
        }}
      />

      <CreateModal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setReceiptFile(null); }}
        onCancel={() => { setShowCreateModal(false); setReceiptFile(null); setNotes(''); }}
        formError={formError}
        errors={errors}
        setErrors={setErrors}
        form={form}
        setForm={setForm}
        notes={notes}
        setNotes={setNotes}
        items={items}
        addItem={addItem}
        removeItem={removeItem}
        updateItem={updateItem}
        totalCost={totalCost}
        medicines={medicines}
        suppliers={suppliers}
        paymentAccounts={paymentAccounts}
        receiptFile={receiptFile}
        setReceiptFile={setReceiptFile}
        receiptRef={receiptRef}
        isSaving={isSaving}
        onSubmit={handleCreate}
      />
    </div>
  );
}
