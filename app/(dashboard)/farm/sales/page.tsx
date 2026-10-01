'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CattleSale, AccountingPaymentAccount } from '@/types';
import { Pencil, Printer, Check, Banknote, Plus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import Link from '@/components/ui/AppLink';
import { useToast } from '@/components/ui/Toast';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { MONEY_KEYS } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import { useDateRange } from '@/lib/hooks/useDateRange';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import { localeFor } from '@/lib/languages';
import { fmtNum, fmtMoney } from '@/lib/format';
import { escapeHtml as esc } from '@/lib/escapeHtml';

const EDIT_EMPTY = { sale_date: '', buyer_name: '', buyer_phone: '', sale_weight: '', sale_price: '', notes: '', payment_account_id: '' };

const EDIT_FORM_ID = 'sale-edit';
const EDIT_KNOWN = Object.keys(EDIT_EMPTY);

const salesApi = createCrudService<CattleSale, { data: CattleSale[]; last_page: number; total: number }>('/farm/sales');
const salesKeys = createResourceKeys('cattle-sales');

export default function SalesPage() {
  const { t } = useTranslation('finance');
  const { hasPermission, hasRole } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EDIT_EMPTY);
  const [editFormError, setEditFormError] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [editOpened, setEditOpened] = useState('');
  const editDirty = showEditModal && JSON.stringify(editForm) !== editOpened;
  useScrollToError(editErrors, editFormError);

  function setEditField(key: keyof typeof EDIT_EMPTY, value: string) {
    setEditForm(f => ({ ...f, [key]: value }));
    if (editErrors[key]) setEditErrors(p => ({ ...p, [key]: '' }));
  }

  function validateEdit(): boolean {
    const e: Record<string, string> = {};
    if (!editForm.sale_date) e.sale_date = t('sales.edit.error.date_required');
    if (!editForm.buyer_name.trim()) e.buyer_name = t('sales.edit.error.buyer_required');
    const price = parseFloat(editForm.sale_price);
    if (!editForm.sale_price || isNaN(price) || price <= 0) e.sale_price = t('sales.edit.error.price_positive');
    if (!editForm.payment_account_id) e.payment_account_id = t('sales.edit.error.account_required');
    setEditErrors(e);
    return !Object.keys(e).length;
  }

  function openEdit(s: CattleSale) {
    const pa = (s as unknown as { payment_account?: AccountingPaymentAccount }).payment_account;
    setEditId(s.id);
    const next = {
      sale_date:          s.sale_date.split('T')[0],
      buyer_name:         s.buyer_name ?? '',
      buyer_phone:        (s as unknown as { buyer_phone?: string }).buyer_phone ?? '',
      sale_weight:        s.sale_weight ? String(parseFloat(s.sale_weight)) : '',
      sale_price:         String(parseFloat(s.sale_price)),
      notes:              s.notes ?? '',
      payment_account_id: pa ? String(pa.id) : String(s.payment_account_id ?? ''),
    };
    setEditForm(next);
    setEditOpened(JSON.stringify(next));
    setEditFormError('');
    setEditErrors({});
    setShowEditModal(true);
  }

  function printInvoice(s: CattleSale) {
    const pa          = (s as unknown as { payment_account?: AccountingPaymentAccount }).payment_account;
    const buyerPhone  = (s as unknown as { buyer_phone?: string }).buyer_phone;
    const tagNumber   = s.cattle?.tag_number ?? String(s.cattle_id);
    const cattleName  = s.cattle?.name ? ` (${s.cattle.name})` : '';
    const saleDate    = new Date(s.sale_date).toLocaleDateString(localeFor(), { year: 'numeric', month: 'long', day: 'numeric' });
    const pl          = parseFloat(s.profit_loss);

    const html = [
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(t('receipt.title'))}</title>`,
      '<style>',
      'body{font-family:sans-serif;padding:32px;max-width:580px;margin:0 auto}',
      'h2{text-align:center;margin-bottom:2px;font-size:20px}',
      '.sub{text-align:center;color:#666;font-size:13px;margin-bottom:24px}',
      'table{width:100%;border-collapse:collapse;margin:0}',
      'tr{border-bottom:1px solid #f0f0f0}',
      'td{padding:10px 12px;font-size:13px}',
      'td:first-child{color:#666;width:45%}',
      'td:last-child{font-weight:600;text-align:right;color:#1e293b}',
      '.section-title{background:#f8fafc;font-weight:700;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#64748b;padding:8px 12px;border-bottom:1px solid #e2e8f0}',
      '.profit td:last-child{color:#16a34a}',
      '.loss td:last-child{color:#dc2626}',
      '.footer{text-align:center;margin-top:32px;color:#aaa;font-size:11px;border-top:1px solid #eee;padding-top:12px}',
      '@media print{button{display:none!important}}',
      '</style></head><body>',
      `<h2>${esc(t('receipt.title'))}</h2>`,
      `<div class="sub">${esc(t('receipt.date_label'))}: ${esc(saleDate)}</div>`,
      '<table>',
      `<tr><td colspan="2" class="section-title">${esc(t('receipt.section_animal_info'))}</td></tr>`,
      `<tr><td>${esc(t('receipt.col_cattle'))}</td><td>${esc(tagNumber)}${esc(cattleName)}</td></tr>`,
      `<tr><td>${esc(t('receipt.col_sale_weight'))}</td><td>${s.sale_weight ? `${esc(fmtNum(s.sale_weight))} ${esc(t('cattle:unit.kg'))}` : '—'}</td></tr>`,
      `<tr><td colspan="2" class="section-title">${esc(t('receipt.section_buyer_info'))}</td></tr>`,
      `<tr><td>${esc(t('receipt.col_buyer_name'))}</td><td>${esc(s.buyer_name || '—')}</td></tr>`,
      buyerPhone ? `<tr><td>${esc(t('receipt.col_phone'))}</td><td>${esc(buyerPhone)}</td></tr>` : '',
      `<tr><td colspan="2" class="section-title">${esc(t('receipt.section_financial_info'))}</td></tr>`,
      `<tr><td>${esc(t('receipt.col_sale_price'))}</td><td>${esc(fmtMoney(s.sale_price))}</td></tr>`,
      `<tr><td>${esc(t('receipt.col_total_cost'))}</td><td>${esc(fmtMoney(s.total_cost))}</td></tr>`,
      `<tr class="${pl >= 0 ? 'profit' : 'loss'}"><td>${esc(pl >= 0 ? t('receipt.profit_label') : t('receipt.loss_label'))}</td><td>${esc(pl >= 0 ? '\u200E+' : '\u200E-')}${esc(fmtMoney(Math.abs(pl)))}</td></tr>`,
      pa ? `<tr><td>${esc(t('receipt.col_payment_account'))}</td><td>${esc(pa.name)}</td></tr>` : '',
      '</table>',
      `<div class="footer">${esc(t('receipt.footer'))}</div>`,
      `<br><button onclick="window.print()" style="display:block;margin:12px auto;padding:8px 28px;cursor:pointer;font-size:14px">🖨️ ${esc(t('receipt.print_button'))}</button>`,
      '</body></html>',
    ].join('');

    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => URL.revokeObjectURL(url));
    } else {
      URL.revokeObjectURL(url);
      toast.error(t('receipt.popup_blocked'));
    }
  }

  const resource = useCrudResource(salesApi, salesKeys, {
    extraInvalidateKeys: [...MONEY_KEYS, ['sales-summary'], ['sales-trash'], ['farm-cattle'], ['cattle-active']],
  });
  const dateRange = useDateRange(setPage);
  const { data, isLoading, isError, refetch } = resource.useList({ ...sorting.params, page, per_page: 15, ...dateRange.params });

  const { data: summaryData } = useQuery({
    queryKey: ['sales-summary'],
    queryFn: async () => (await api.get('/farm/sales/summary')).data.summary as {
      total_sold: number; total_revenue: number; total_cost: number; total_profit_loss: number; profitable_count: number; loss_count: number;
    },
  });

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const editMutation = resource.useUpdate({
    onSuccess: (res) => {
      setShowEditModal(false);
      toast.success(res.message ?? t('sales.edit.msg.updated'));
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, t('sales.edit.msg.update_failed'));
      setEditErrors(fields);
      if (!Object.keys(fields).length) setEditFormError(message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');
    if (!validateEdit() || editId === null) return;
    editMutation.mutate({ id: editId, payload: { ...editForm } });
  };

  const sales   = data?.data ?? [];
  const canEdit = hasRole('Super Admin') || hasPermission('farm.sales.edit');

  const cols: ColDef<CattleSale>[] = [
    { key: 'date', labelKey: 'finance:sales.col.date', align: 'left', sortKey: 'date', sortType: 'date', render: s => <span className="text-slate-600">{new Date(s.sale_date).toLocaleDateString(localeFor())}</span> },
    { key: 'cattle', labelKey: 'finance:sales.col.cattle', align: 'left', render: s => <span className="font-medium text-slate-800">{s.cattle?.tag_number ?? s.cattle_id}</span> },
    { key: 'buyer', labelKey: 'finance:sales.col.buyer', align: 'left', render: s => <span className="text-slate-600">{s.buyer_name || '—'}</span> },
    { key: 'sale_price', labelKey: 'finance:sales.col.sale_price', align: 'right', sortKey: 'price', sortType: 'number', render: s => <span className="text-slate-700">{fmtMoney(s.sale_price)}</span> },
    {
      key: 'received_in', labelKey: 'finance:sales.col.received_in', align: 'left',
      render: s => {
        const paymentAccount = (s as unknown as { payment_account?: AccountingPaymentAccount }).payment_account;
        return paymentAccount ? (
          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
            <Banknote size={10} />{paymentAccount.name}
          </span>
        ) : <span className="text-xs text-slate-300">—</span>;
      },
    },
    {
      key: 'profit_loss', labelKey: 'finance:sales.col.profit_loss', align: 'right', sortKey: 'profit', sortType: 'number',
      render: s => {
        const pl = parseFloat(s.profit_loss);
        return <span className={`font-bold ${pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pl >= 0 ? '\u200E+' : ''}{fmtMoney(pl)}</span>;
      },
    },
    {
      key: '_actions', labelKey: '', align: 'right',
      render: s => (
        <div className="flex justify-end gap-1">
          <button onClick={() => printInvoice(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title={t('sales.tooltip.print_invoice')} aria-label={t('sales.tooltip.print_invoice')}>
            <Printer size={14} />
          </button>
          {canEdit && (
            <button onClick={() => openEdit(s)} aria-label={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
              <Pencil size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summaryData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            [t('sales.summary.total_sold'),  fmtNum(summaryData.total_sold),         ''],
            [t('sales.summary.revenue'),     fmtMoney(summaryData.total_revenue),    ''],
            [t('sales.summary.total_cost'),  fmtMoney(summaryData.total_cost),       ''],
            [t('sales.summary.profit_loss'), fmtMoney(summaryData.total_profit_loss), +summaryData.total_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'],
            [t('sales.summary.profitable'),  fmtNum(summaryData.profitable_count),                                    'text-green-600'],
            [t('sales.summary.loss'),        fmtNum(summaryData.loss_count),                                         'text-red-600'],
          ].map(([label, value, color]) => (
            <div key={label as string} className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{label as string}</p>
              <p className={`amount-fit [--amount-max:1.25rem] font-bold mt-1 ${(color as string) || 'text-slate-800'}`}>{value as string}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('sales.title')}</h1>
        {/* A sale starts from the animals: pick them on the animal list, then price them. */}
        {hasPermission('farm.sales.create') && (
          <Link href="/farm/cattle?new=sell"
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
            <Plus size={16} /> {t('sales.btn.new')}
          </Link>
        )}
      </div>

      <DateRangeFilter value={dateRange.range} onChange={dateRange.setRange} />

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={sales}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        keyExtractor={s => s.id}
        emptyKey="finance:sales.empty"
        currentPage={page}
        lastPage={data?.last_page ?? 1}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      {/* Edit Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} dirty={editDirty} size="md"
        title={t('sales.edit.modal_title')}
        footer={<>
          <button type="button" onClick={() => setShowEditModal(false)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={EDIT_FORM_ID} disabled={editMutation.isPending} className={btnPrimary}>
            <Check size={15} /> {t('common:btn.save')}
          </button>
        </>}>
        <form id={EDIT_FORM_ID} onSubmit={handleEditSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={editFormError} extra={otherErrors(editErrors, EDIT_KNOWN)} />
          <FormRow>
            <Field name="sale_date" label={t('sales.field.date')} required error={editErrors.sale_date}>
              <input id={fieldId('sale_date')} type="date" value={editForm.sale_date}
                onChange={e => setEditField('sale_date', e.target.value)} className={fieldClass(editErrors.sale_date)} />
            </Field>
            <Field name="sale_price" label={t('sales.field.sale_price')} required error={editErrors.sale_price}>
              <NumberInput id={fieldId('sale_price')} value={editForm.sale_price} prefix="৳" placeholder="0"
                onChange={v => setEditField('sale_price', v)} error={editErrors.sale_price} />
            </Field>
            <Field name="buyer_name" label={t('sales.field.buyer_name')} required error={editErrors.buyer_name}>
              <input id={fieldId('buyer_name')} type="text" value={editForm.buyer_name} dir="auto"
                onChange={e => setEditField('buyer_name', e.target.value)} className={fieldClass(editErrors.buyer_name)} />
            </Field>
            <Field name="buyer_phone" label={t('sales.field.buyer_phone')} error={editErrors.buyer_phone}>
              <input id={fieldId('buyer_phone')} type="tel" value={editForm.buyer_phone} dir="ltr"
                onChange={e => setEditField('buyer_phone', e.target.value)} className={fieldClass(editErrors.buyer_phone)} />
            </Field>
            <Field name="sale_weight" label={t('sales.field.sale_weight')} error={editErrors.sale_weight}>
              <NumberInput id={fieldId('sale_weight')} value={editForm.sale_weight} placeholder="0"
                onChange={v => setEditField('sale_weight', v)} error={editErrors.sale_weight} />
            </Field>
          </FormRow>
          <Field name="payment_account_id" required error={editErrors.payment_account_id}
            label={<span className="inline-flex items-center gap-1"><Banknote size={12} />{t('sales.field.account')}</span>}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccountsData?.payment_accounts}
              value={editForm.payment_account_id} onChange={v => setEditField('payment_account_id', v)}
              error={editErrors.payment_account_id} placeholder={t('sales.field.select_account')} label={t('sales.field.account')} />
          </Field>
          <Field name="notes" label={t('sales.field.notes')} error={editErrors.notes}>
            <textarea id={fieldId('notes')} rows={2} value={editForm.notes} dir="auto"
              onChange={e => setEditField('notes', e.target.value)} className={fieldClass(editErrors.notes)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
