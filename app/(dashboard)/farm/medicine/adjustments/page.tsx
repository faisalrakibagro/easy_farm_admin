'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Trash2, AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useFormErrors, otherErrors } from '@/lib/hooks/useFormErrors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import Link from '@/components/ui/AppLink';
import type { Medicine } from '@/types';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { MEDICINE_STOCK_KEYS } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import { useDateRange } from '@/lib/hooks/useDateRange';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import { fmtNum, fmtMoney } from '@/lib/format';

type Adjustment = {
  id: number;
  medicine_id: number;
  medicine?: { id: number; name: string };
  medicine_batch_id?: number | null;
  adjustment_type: string;
  quantity: string;
  unit_price: string;
  total_cost: string;
  adjustment_date: string;
  reason?: string | null;
  created_by?: number | null;
};

const TYPES_MED = ['wastage', 'damage', 'expiry', 'spillage', 'theft', 'other'] as const;

const fmt = (d: string | null | undefined) =>
  d ? new Date(d.split('T')[0] + 'T00:00:00').toLocaleDateString(localeFor()) : '—';

const TODAY = localDateStr();

const EMPTY_FORM = {
  medicine_id: '',
  adjustment_type: 'wastage',
  quantity: '',
  adjustment_date: TODAY,
  reason: '',
};

const FORM_ID = 'medicine-adjustment';
const KNOWN = ['medicine_id', 'adjustment_type', 'quantity', 'adjustment_date', 'reason'];

const medicineAdjustmentsApi = createCrudService<Adjustment, { data: Adjustment[]; last_page: number; total: number }>('/farm/medicine/adjustments');
const medicineAdjustmentsKeys = createResourceKeys('medicine-adjustments');

export default function MedicineAdjustmentsPage() {
  const { t } = useTranslation(['medicine', 'common']);
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);

  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [opened, setOpened]         = useState('');
  const { errors, formError, clear, check, fromApi, reset } = useFormErrors();

  const [deleteId, setDeleteId]     = useState<number | null>(null);

  const resource = useCrudResource(medicineAdjustmentsApi, medicineAdjustmentsKeys, {
    extraInvalidateKeys: [...MEDICINE_STOCK_KEYS, ['medicine-adjustments-trash']],
  });
  const dateRange = useDateRange(setPage);
  const { data, isLoading } = resource.useList({ ...sorting.params, page, per_page: 30, ...dateRange.params });
  const createMutation = resource.useCreate();
  const deleteMutation = resource.useRemove({
    onSuccess: () => { toast.success(t('medicine:adjustments.toast.deleted')); },
    onError: () => { toast.error(t('medicine:adjustments.toast.delete_error')); },
  });

  const { data: medData } = useQuery<{ medicines: Medicine[] }>({
    queryKey: ['medicines-all'],
    queryFn: async () => (await api.get('/farm/medicine/all')).data,
  });

  const adjustments = data?.data ?? [];
  const medicines   = medData?.medicines ?? [];

  const unitSymbol = medicines.find(m => String(m.id) === form.medicine_id)?.unit?.symbol ?? '';
  const dirty = showModal && JSON.stringify(form) !== opened;

  const set = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    clear(key);
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setOpened(JSON.stringify(EMPTY_FORM));
    reset();
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = check({
      medicine_id:     !form.medicine_id && t('medicine:adjustments.validation.item_required'),
      quantity:        (!form.quantity || parseFloat(form.quantity) <= 0) && t('medicine:adjustments.validation.quantity_required'),
      adjustment_date: !form.adjustment_date && t('medicine:adjustments.validation.date_required'),
    });
    if (!ok) return;
    try {
      await createMutation.mutateAsync({
        medicine_id:     parseInt(form.medicine_id),
        adjustment_type: form.adjustment_type,
        quantity:        parseFloat(form.quantity),
        adjustment_date: form.adjustment_date,
        reason:          form.reason || null,
      });
      toast.success(t('medicine:adjustments.toast.recorded'));
      setShowModal(false);
    } catch (err: unknown) {
      fromApi(err, t('medicine:adjustments.toast.save_error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
    } finally {
      setDeleteId(null);
    }
  };

  const typeLabel = (type: string) => t(`medicine:adjustments.type.${type}`, type);

  const canCreate = hasPermission('farm.medicine.create');
  const canDelete = isSuperAdmin;

  const cols: ColDef<Adjustment>[] = [
    { key: 'date', labelKey: 'medicine:adjustments.col.date', align: 'left', sortKey: 'date', sortType: 'date', render: adj => <span className="whitespace-nowrap">{fmt(adj.adjustment_date)}</span> },
    { key: 'item', labelKey: 'medicine:adjustments.col.item', align: 'left', render: adj => <span className="font-medium text-gray-800">{adj.medicine?.name ?? '—'}</span> },
    {
      key: 'type', labelKey: 'medicine:adjustments.col.type', align: 'left',
      render: adj => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          {typeLabel(adj.adjustment_type)}
        </span>
      ),
    },
    { key: 'quantity', labelKey: 'medicine:adjustments.col.quantity', align: 'right', sortKey: 'quantity', sortType: 'number', render: adj => <span className="tabular-nums">{fmtNum(adj.quantity, 3)}</span> },
    { key: 'unit_price', labelKey: 'medicine:adjustments.col.unit_price', align: 'right', render: adj => <span className="tabular-nums">{fmtMoney(adj.unit_price)}</span> },
    { key: 'total_cost', labelKey: 'medicine:adjustments.col.total_cost', align: 'right', sortKey: 'total', sortType: 'number', render: adj => <span className="font-semibold tabular-nums text-red-600">{fmtMoney(adj.total_cost)}</span> },
    { key: 'reason', labelKey: 'medicine:adjustments.col.reason', align: 'left', render: adj => <span className="text-gray-500 max-w-[180px] truncate block">{adj.reason ?? '—'}</span> },
    {
      key: '_actions', labelKey: '', align: 'right',
      render: adj => canDelete ? (
        <button onClick={() => setDeleteId(adj.id)} aria-label={t('common:btn.delete')} className="text-gray-400 hover:text-red-500 p-1 rounded">
          <Trash2 size={14} />
        </button>
      ) : null,
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {t('medicine:adjustments.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('medicine:adjustments.subtitle')}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link href="/farm/medicine/adjustments/trash"
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2">
            {t('common:btn.trash')}
          </Link>
          {canCreate && (
            <button onClick={openCreate}
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
              <AlertTriangle size={15} />
              {t('medicine:adjustments.btn_add')}
            </button>
          )}
        </div>
      </div>

      <DateRangeFilter value={dateRange.range} onChange={dateRange.setRange} />

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={30}
        data={adjustments}
        isLoading={isLoading}
        keyExtractor={adj => adj.id}
        emptyKey="medicine:adjustments.empty"
        currentPage={page}
        lastPage={data?.last_page ?? 1}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} dirty={dirty} size="md"
        title={t('medicine:adjustments.modal_title')}
        footer={<>
          <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={createMutation.isPending} className={btnPrimary}>
            {createMutation.isPending ? t('common:status.loading') : t('medicine:adjustments.btn_add')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, KNOWN)} />
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            {t('medicine:adjustments.modal_hint')}
          </div>

          <Field name="medicine_id" label={t('medicine:adjustments.field.item')} required error={errors.medicine_id}>
            <SearchSelect id={fieldId('medicine_id')} value={form.medicine_id} onChange={v => set('medicine_id', v)}
              placeholder={t('medicine:adjustments.select_item')} label={t('medicine:adjustments.field.item')} error={errors.medicine_id}
              emptyText={t('medicine:search_select.no_results')}
              options={medicines.map(m => ({
                value: String(m.id), label: m.name,
                sub: t('medicine:search_select.stock_suffix', { qty: m.remaining_quantity ?? 0, symbol: m.unit?.symbol ?? '' }),
              }))} />
          </Field>

          <Field name="adjustment_type" label={t('medicine:adjustments.field.type')} required error={errors.adjustment_type}>
            <select id={fieldId('adjustment_type')} value={form.adjustment_type} onChange={e => set('adjustment_type', e.target.value)}
              className={fieldClass(errors.adjustment_type)}>
              {TYPES_MED.map(ty => (
                <option key={ty} value={ty}>{typeLabel(ty)}</option>
              ))}
            </select>
          </Field>

          <FormRow>
            <Field name="quantity" label={t('medicine:adjustments.field.quantity')} required error={errors.quantity}>
              <NumberInput id={fieldId('quantity')} value={form.quantity} onChange={v => set('quantity', v)}
                suffix={unitSymbol || undefined} error={errors.quantity} placeholder="0.000" />
            </Field>
            <Field name="adjustment_date" label={t('medicine:adjustments.field.date')} required error={errors.adjustment_date}>
              <input id={fieldId('adjustment_date')} type="date" value={form.adjustment_date}
                onChange={e => set('adjustment_date', e.target.value)} className={fieldClass(errors.adjustment_date)} />
            </Field>
          </FormRow>

          <Field name="reason" label={t('medicine:adjustments.field.reason')} error={errors.reason}>
            <textarea id={fieldId('reason')} rows={2} value={form.reason} dir="auto"
              onChange={e => set('reason', e.target.value)}
              className={fieldClass(errors.reason, 'resize-none')}
              placeholder={t('medicine:adjustments.field.notes_placeholder')} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title={t('medicine:adjustments.confirm_delete.title')}
        message={t('medicine:adjustments.confirm_delete.message')}
        confirmLabel={t('medicine:adjustments.confirm_delete.label')}
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
