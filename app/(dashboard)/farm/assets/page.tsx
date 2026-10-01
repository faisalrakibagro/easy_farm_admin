'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Package, Cpu, Armchair, Car, MoreHorizontal, ShoppingBag, TrendingUp, TrendingDown } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import type { FixedAsset, FixedAssetCategory, AccountingPaymentAccount } from '@/types';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { MONEY_KEYS, invalidateMoney } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import { useDateRange } from '@/lib/hooks/useDateRange';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import { localDateStr } from '@/lib/dates';
import { fmtDate, fmtMoney, fmtNum } from '@/lib/format';

const CATEGORY_ICONS: Record<FixedAssetCategory, React.ReactNode> = {
  equipment:   <Package        size={14} />,
  furniture:   <Armchair       size={14} />,
  electronics: <Cpu            size={14} />,
  vehicle:     <Car            size={14} />,
  other:       <MoreHorizontal size={14} />,
};

const CATEGORY_COLORS: Record<FixedAssetCategory, string> = {
  equipment:   'bg-blue-100 text-blue-700',
  furniture:   'bg-amber-100 text-amber-700',
  electronics: 'bg-purple-100 text-purple-700',
  vehicle:     'bg-green-100 text-green-700',
  other:       'bg-slate-100 text-slate-600',
};

const CATEGORIES: FixedAssetCategory[] = ['equipment', 'furniture', 'electronics', 'vehicle', 'other'];

const EMPTY_FORM = {
  name:               '',
  category:           '' as FixedAssetCategory | '',
  purchase_date:      localDateStr(),
  purchase_price:     '',
  current_value:      '',
  payment_account_id: '',
  vendor_name:        '',
  invoice_no:         '',
  description:        '',
};

type FormErrors = Partial<Record<string, string>>;

const fmt = (n: number | string) => fmtMoney(Math.abs(Number(n)));

const FORM_ID = 'asset-form';
const DISPOSE_FORM_ID = 'asset-dispose';
const KNOWN = Object.keys(EMPTY_FORM);

const assetsApi = createCrudService<FixedAsset, { data: FixedAsset[]; last_page: number; total: number }>('/farm/assets');
const assetsKeys = createResourceKeys('fixed-assets');

export default function FixedAssetsPage() {
  const { t } = useTranslation(['assets', 'common']);
  const toast        = useToast();
  const queryClient  = useQueryClient();
  const { hasPermission } = useAuth();

  const canCreate = hasPermission('farm.assets.create');
  const canEdit   = hasPermission('farm.assets.edit');
  const canDelete = hasPermission('farm.assets.delete');

  const [page, setPage]           = useState(1);

  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setStatus] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId]       = useState<number | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [errors, setErrors]       = useState<FormErrors>({});
  const [saving, setSaving]       = useState(false);
  const [opened, setOpened]       = useState('');

  // Dispose modal
  const [showDispose, setShowDispose]   = useState(false);
  const [disposeTarget, setDisposeTarget] = useState<FixedAsset | null>(null);
  const [disposeForm, setDisposeForm]   = useState({
    disposed_date:       localDateStr(),
    disposal_amount:     '',
    disposal_account_id: '',
    disposal_note:       '',
  });
  const [disposeErrors, setDisposeErrors] = useState<Record<string, string | undefined>>({});
  const [disposeSaving, setDisposeSaving] = useState(false);
  const [disposeOpened, setDisposeOpened] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FixedAsset | null>(null);
  const dirty = showModal && JSON.stringify(form) !== opened;
  const disposeDirty = showDispose && JSON.stringify(disposeForm) !== disposeOpened;
  useScrollToError(errors);
  useScrollToError(disposeErrors);

  // Queries
  const resource = useCrudResource(assetsApi, assetsKeys, {
    extraInvalidateKeys: [...MONEY_KEYS, ['fixed-assets-summary'], ['fixed-assets-trash']],
  });
  const dateRange = useDateRange(setPage);
  const { data, isLoading, isError, refetch } = resource.useList({ ...sorting.params, page, per_page: 15, category: filterCat || undefined, status: filterStatus || undefined, ...dateRange.params });

  const { data: summaryData } = useQuery({
    queryKey: ['fixed-assets-summary'],
    queryFn:  async () => (await api.get('/farm/assets/summary')).data,
  });

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn:  async () => (await api.get('/accounting/payment-accounts')).data,
    enabled: showModal || showDispose,
  });

  const defaultAccountId = paymentAccountsData?.payment_accounts.find(p => p.is_default)?.id?.toString() ?? '';

  // Mutations
  const createMut = resource.useCreate({
    onSuccess:  (res) => {
      toast.success(res.message ?? t('common:saved'));
      closeModal();
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common:error.failed_create')),
  });

  const updateMut = resource.useUpdate({
    onSuccess:  (res) => {
      toast.success(res.message ?? t('common:updated'));
      closeModal();
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common:error.failed_update')),
  });

  const deleteMut = resource.useRemove({
    onSuccess:  (res) => {
      toast.success(res.message ?? t('common:deleted'));
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common:error.failed_delete')),
  });

  const disposeMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Record<string, unknown> }) =>
      api.post(`/farm/assets/${id}/dispose`, d),
    onSuccess: (res) => {
      toast.success(res?.data?.message ?? t('common:saved'));
      // Disposal proceeds land in a payment account.
      invalidateMoney(queryClient, [['fixed-assets'], ['fixed-assets-summary']]);
      setShowDispose(false);
      setDisposeTarget(null);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common:error.failed_save')),
  });

  // Form helpers
  function openCreate() {
    setEditId(null);
    setErrors({});
    const next = { ...EMPTY_FORM, payment_account_id: defaultAccountId };
    setForm(next);
    setOpened(JSON.stringify(next));
    setShowModal(true);
  }

  function openEdit(a: FixedAsset) {
    setEditId(a.id);
    setErrors({});
    const next = {
      name:               a.name,
      category:           a.category,
      purchase_date:      a.purchase_date.split('T')[0],
      purchase_price:     String(a.purchase_price),
      current_value:      a.current_value ? String(a.current_value) : '',
      payment_account_id: String(a.payment_account_id),
      vendor_name:        a.vendor_name ?? '',
      invoice_no:         a.invoice_no ?? '',
      description:        a.description ?? '',
    };
    setForm(next);
    setOpened(JSON.stringify(next));
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditId(null); }

  function setField(k: keyof typeof EMPTY_FORM, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.name.trim())        e.name = t('error.name_required');
    if (!form.category)           e.category = t('error.category_required');
    if (!form.purchase_date)      e.purchase_date = t('error.purchase_date_required');
    if (!form.purchase_price)     e.purchase_price = t('error.purchase_price_required');
    else if (Number(form.purchase_price) <= 0) e.purchase_price = t('error.purchase_price_min');
    if (form.current_value && Number(form.current_value) < 0) e.current_value = t('error.current_value_min');
    if (!form.payment_account_id) e.payment_account_id = t('error.payment_account_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      name:               form.name.trim(),
      category:           form.category,
      purchase_date:      form.purchase_date,
      purchase_price:     form.purchase_price,
      current_value:      form.current_value ? form.current_value : null,
      payment_account_id: Number(form.payment_account_id),
      vendor_name:        form.vendor_name || null,
      invoice_no:         form.invoice_no || null,
      description:        form.description || null,
    };
    try {
      if (editId) await updateMut.mutateAsync({ id: editId, payload });
      else        await createMut.mutateAsync(payload);
    } catch (err) {
      setErrors(apiFieldErrors(err, '').fields);
    } finally { setSaving(false); }
  }

  function openDispose(a: FixedAsset) {
    setDisposeTarget(a);
    setDisposeErrors({});
    const next = {
      disposed_date:       localDateStr(),
      disposal_amount:     '',
      disposal_account_id: '',
      disposal_note:       '',
    };
    setDisposeForm(next);
    setDisposeOpened(JSON.stringify(next));
    setShowDispose(true);
  }

  function setDisposeField(k: keyof typeof disposeForm, v: string) {
    setDisposeForm(f => ({ ...f, [k]: v }));
    setDisposeErrors(e => ({ ...e, [k]: undefined }));
  }

  function validateDispose(): boolean {
    const e: Record<string, string> = {};
    if (!disposeForm.disposed_date)       e.disposed_date = t('dispose.error.date_required');
    if (!disposeForm.disposal_amount || Number(disposeForm.disposal_amount) < 0)
                                          e.disposal_amount = t('dispose.error.amount_required');
    if (!disposeForm.disposal_account_id) e.disposal_account_id = t('dispose.error.account_required');
    setDisposeErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleDispose(e: React.FormEvent) {
    e.preventDefault();
    if (!disposeTarget || !validateDispose()) return;
    setDisposeSaving(true);
    try {
      await disposeMut.mutateAsync({
        id: disposeTarget.id,
        d: {
          disposed_date:       disposeForm.disposed_date,
          disposal_amount:     disposeForm.disposal_amount,
          disposal_account_id: Number(disposeForm.disposal_account_id),
          disposal_note:       disposeForm.disposal_note || null,
        },
      });
    } catch (err) {
      setDisposeErrors(apiFieldErrors(err, '').fields);
    } finally { setDisposeSaving(false); }
  }

  const disposeBookValue = disposeTarget
    ? (disposeTarget.current_value !== null ? Number(disposeTarget.current_value) : Number(disposeTarget.purchase_price))
    : 0;
  const disposeGainLoss = disposeForm.disposal_amount
    ? Number(disposeForm.disposal_amount) - disposeBookValue
    : null;

  const assets   = data?.data ?? [];
  const lastPage = data?.last_page ?? 1;

  const cols: ColDef<FixedAsset>[] = [
    {
      key: 'name', labelKey: 'assets:table.name', align: 'left', sortKey: 'name', sortType: 'text',
      render: a => (
        <div>
          <p className="font-medium text-slate-800">{a.name}</p>
          {a.vendor_name && <p className="text-xs text-slate-400 font-normal">{a.vendor_name}</p>}
        </div>
      ),
    },
    {
      key: 'category', labelKey: 'assets:table.category', align: 'left',
      render: a => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[a.category]}`}>
          {CATEGORY_ICONS[a.category]}{t(`category.${a.category}`)}
        </span>
      ),
    },
    { key: 'purchase_date', labelKey: 'assets:table.purchase_date', align: 'left', sortKey: 'date', sortType: 'date', render: a => <span className="text-slate-600">{fmtDate(a.purchase_date)}</span> },
    { key: 'purchase_price', labelKey: 'assets:table.purchase_price', align: 'right', sortKey: 'price', sortType: 'number', render: a => <span className="font-medium text-slate-800">{fmt(a.purchase_price)}</span> },
    {
      key: 'book_value', labelKey: 'assets:table.book_value', align: 'right',
      render: a => a.status === 'active' ? (
        <>
          <span className="font-medium text-emerald-700">{fmt(a.book_value)}</span>
          {a.current_value !== null && (
            <p className="text-xs text-slate-400 mt-0.5">{t('table.custom_value_badge')}</p>
          )}
        </>
      ) : (
        <>
          <span className="text-xs text-slate-400 line-through">{fmt(a.purchase_price)}</span>
          <p className="font-medium text-slate-500">{fmt(Number(a.disposal_amount))}</p>
          {a.gain_loss > 0 && (
            <p className="text-xs text-emerald-600 flex items-center justify-end gap-0.5">
              <TrendingUp size={10} />{fmt(a.gain_loss)} {t('table.profit_word')}
            </p>
          )}
          {a.gain_loss < 0 && (
            <p className="text-xs text-red-500 flex items-center justify-end gap-0.5">
              <TrendingDown size={10} />{fmt(Math.abs(a.gain_loss))} {t('table.loss_word')}
            </p>
          )}
        </>
      ),
    },
    {
      key: 'status', labelKey: 'assets:table.status', align: 'center',
      render: a => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {a.status === 'disposed' ? t('dispose.sold_badge') : t(`status.${a.status}`)}
        </span>
      ),
    },
    {
      key: '_actions', labelKey: '', align: 'right',
      render: a => (
        <div className="flex justify-end gap-1">
          {canEdit && a.status === 'active' && (
            <button onClick={() => openDispose(a)}
              title={t('dispose.btn')} aria-label={t('dispose.btn')}
              className="p-1.5 pointer-coarse:size-10 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg">
              <ShoppingBag size={14} />
            </button>
          )}
          {canEdit && a.status === 'active' && (
            <button onClick={() => openEdit(a)} aria-label={t('common:btn.edit')}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => setDeleteTarget(a)} aria-label={t('common:btn.delete')}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('title')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {canDelete && (
            <Link href="/farm/assets/trash"
              className="flex flex-1 sm:flex-none items-center justify-center px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
              {t('trash_link')}
            </Link>
          )}
          {canCreate && (
            <button onClick={openCreate}
              className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
              <Plus size={16} />{t('add_btn')}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summaryData && (
        <div className="@container grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 gap-3 [&>*]:min-w-0">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{t('summary.count')}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{fmtNum(summaryData.count)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{t('summary.total_cost')}</p>
            <p className="text-xl font-bold text-blue-700 mt-1">{fmt(summaryData.total_cost)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{t('summary.book_value')}</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{fmt(summaryData.total_book)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="@container">
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-2 [&>*]:min-w-0">
          <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">{t('category.label')} — {t('common:filter.all')}</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </select>
          <select value={filterStatus} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">{t('status.label')} — {t('common:filter.all')}</option>
            <option value="active">{t('status.active')}</option>
            <option value="disposed">{t('status.disposed')}</option>
          </select>
        </div>
      </div>

      <DateRangeFilter value={dateRange.range} onChange={dateRange.setRange} />

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={assets}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        keyExtractor={a => a.id}
        emptyKey="assets:empty"
        currentPage={page}
        lastPage={lastPage}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        message={t('confirm.delete_asset', { name: deleteTarget?.name ?? '' })}
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) })}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Dispose Modal */}
      <Modal open={showDispose && !!disposeTarget} onClose={() => setShowDispose(false)} dirty={disposeDirty} size="md"
        title={t('modal.dispose_title')} subtitle={disposeTarget?.name}
        footer={<>
          <button type="button" onClick={() => setShowDispose(false)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={DISPOSE_FORM_ID} disabled={disposeSaving} className={btnPrimary}>
            {disposeSaving ? t('common:status.saving') : t('dispose.confirm')}
          </button>
        </>}>
        <form id={DISPOSE_FORM_ID} onSubmit={handleDispose} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          {/* Book value info */}
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">{t('dispose.book_at_disposal')}</span>
              <span className="font-semibold text-slate-800">{fmt(disposeBookValue)}</span>
            </div>
          </div>

          <Field name="disposed_date" label={t('dispose.date')} required error={disposeErrors.disposed_date}>
            <input id={fieldId('disposed_date')} type="date" value={disposeForm.disposed_date}
              onChange={e => setDisposeField('disposed_date', e.target.value)} className={fieldClass(disposeErrors.disposed_date)} />
          </Field>

          <Field name="disposal_amount" label={t('dispose.amount')} required error={disposeErrors.disposal_amount}>
            <NumberInput id={fieldId('disposal_amount')} value={disposeForm.disposal_amount} prefix="৳"
              onChange={v => setDisposeField('disposal_amount', v)} placeholder={t('placeholder.zero')} error={disposeErrors.disposal_amount} />
            {/* Real-time gain/loss */}
            {disposeGainLoss !== null && (
              <div className={`mt-1.5 flex items-center gap-1.5 text-sm font-semibold ${
                disposeGainLoss > 0 ? 'text-emerald-600' : disposeGainLoss < 0 ? 'text-red-500' : 'text-slate-500'
              }`}>
                {disposeGainLoss > 0 && <TrendingUp size={14} />}
                {disposeGainLoss < 0 && <TrendingDown size={14} />}
                {disposeGainLoss > 0
                  ? `${t('dispose.gain_label')}: ${fmt(disposeGainLoss)}`
                  : disposeGainLoss < 0
                    ? `${t('dispose.loss_label')}: ${fmt(Math.abs(disposeGainLoss))}`
                    : t('dispose.no_gain_loss')}
              </div>
            )}
          </Field>

          <Field name="disposal_account_id" label={t('dispose.account')} required error={disposeErrors.disposal_account_id}>
            <PaymentAccountSelect id={fieldId('disposal_account_id')} accounts={paymentAccountsData?.payment_accounts}
              value={disposeForm.disposal_account_id} onChange={v => setDisposeField('disposal_account_id', v)}
              error={disposeErrors.disposal_account_id} placeholder={t('placeholder.select_account')} label={t('dispose.account')} />
          </Field>

          <Field name="disposal_note" label={t('dispose.note')} error={disposeErrors.disposal_note}>
            <input id={fieldId('disposal_note')} type="text" value={disposeForm.disposal_note} dir="auto"
              onChange={e => setDisposeField('disposal_note', e.target.value)}
              placeholder={t('dispose.note_placeholder')} className={fieldClass(disposeErrors.disposal_note)} />
          </Field>
        </form>
      </Modal>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="lg"
        title={editId ? t('modal.edit_title') : t('modal.add_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={saving} className={btnPrimary}>
            {saving ? t('common:status.saving') : editId ? t('common:btn.update') : t('common:btn.save')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert extra={otherErrors(errors, KNOWN)} />

          <Field name="name" label={t('field.name')} required error={errors.name}>
            <input id={fieldId('name')} type="text" value={form.name} dir="auto" data-autofocus
              onChange={e => setField('name', e.target.value)}
              placeholder={t('placeholder.name')} className={fieldClass(errors.name)} />
          </Field>

          <FormRow>
            <Field name="category" label={t('field.category')} required error={errors.category}>
              <select id={fieldId('category')} value={form.category} onChange={e => setField('category', e.target.value as FixedAssetCategory)}
                className={fieldClass(errors.category)}>
                <option value="">{t('category.select_placeholder')}</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
              </select>
            </Field>
            <Field name="purchase_date" label={t('field.purchase_date')} required error={errors.purchase_date}>
              <input id={fieldId('purchase_date')} type="date" value={form.purchase_date}
                onChange={e => setField('purchase_date', e.target.value)} className={fieldClass(errors.purchase_date)} />
            </Field>
          </FormRow>

          <FormRow>
            <Field name="purchase_price" label={t('field.purchase_price')} required error={errors.purchase_price}>
              <NumberInput id={fieldId('purchase_price')} value={form.purchase_price} prefix="৳"
                onChange={v => setField('purchase_price', v)} placeholder={t('placeholder.zero')} error={errors.purchase_price} />
            </Field>
            <Field name="current_value" label={t('field.current_value')} error={errors.current_value}
              hint={t('placeholder.current_value_hint')}>
              <NumberInput id={fieldId('current_value')} value={form.current_value} prefix="৳"
                onChange={v => setField('current_value', v)} placeholder={t('placeholder.current_value')} error={errors.current_value} />
            </Field>
          </FormRow>

          <Field name="payment_account_id" label={t('field.payment_account')} required error={errors.payment_account_id}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccountsData?.payment_accounts}
              value={form.payment_account_id} onChange={v => setField('payment_account_id', v)}
              amount={editId ? undefined : form.purchase_price}
              error={errors.payment_account_id} placeholder={t('placeholder.select_account')} label={t('field.payment_account')} />
          </Field>

          <FormRow>
            <Field name="vendor_name" label={t('field.vendor')} error={errors.vendor_name}>
              <input id={fieldId('vendor_name')} type="text" value={form.vendor_name} dir="auto"
                onChange={e => setField('vendor_name', e.target.value)}
                placeholder={t('placeholder.vendor')} className={fieldClass(errors.vendor_name)} />
            </Field>
            <Field name="invoice_no" label={t('field.invoice_no')} error={errors.invoice_no}>
              <input id={fieldId('invoice_no')} type="text" value={form.invoice_no} dir="auto"
                onChange={e => setField('invoice_no', e.target.value)}
                placeholder={t('placeholder.invoice_no')} className={fieldClass(errors.invoice_no)} />
            </Field>
          </FormRow>

          <Field name="description" label={t('field.description')} error={errors.description}>
            <textarea id={fieldId('description')} rows={2} value={form.description} dir="auto"
              onChange={e => setField('description', e.target.value)}
              placeholder={t('placeholder.description')} className={fieldClass(errors.description, 'resize-none')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
