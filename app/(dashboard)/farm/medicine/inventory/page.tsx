'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Medicine, MedicineCategory, Unit } from '@/types';
import { Plus, Search, Pencil, Trash2, Check, AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useFormErrors, otherErrors } from '@/lib/hooks/useFormErrors';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { MEDICINE_STOCK_KEYS } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import TrashLink from '@/components/ui/TrashLink';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import PageTitle from '@/components/ui/PageTitle';
import { fmtNum } from '@/lib/format';

const DEFAULT_MED: Record<string, string> = {
  name: '', category_id: '', unit_id: '', manufacturer: '',
  low_stock_alert: '', milk_withdrawal_days: '0', notes: '',
};

const FORM_ID = 'medicine-form';
const KNOWN = Object.keys(DEFAULT_MED);

const medicinesApi = createCrudService<Medicine, { data: Medicine[]; last_page: number; total: number }>('/farm/medicine');
const medicinesKeys = createResourceKeys('medicines');

export default function MedicineInventoryPage() {
  const { t } = useTranslation();
  const { t: tc } = useTranslation('common');
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMed, setEditMed] = useState<Medicine | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...DEFAULT_MED });
  const [isVaccine, setIsVaccine] = useState(false);
  const [opened, setOpened] = useState('');
  const { errors, formError, clear, check, fromApi, reset } = useFormErrors();
  const [isSaving, setIsSaving] = useState(false);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null);

  const resource = useCrudResource(medicinesApi, medicinesKeys, {
    extraInvalidateKeys: [...MEDICINE_STOCK_KEYS, ['medicine-trash']],
  });
  const { data, isLoading } = resource.useList({ ...sorting.params, page, search, per_page: 15, low_stock: showLowOnly ? 1 : undefined, category_id: filterCategory || undefined });

  const { data: categoriesData } = useQuery<{ categories: MedicineCategory[] }>({
    queryKey: ['medicine-categories'],
    queryFn: async () => (await api.get('/farm/medicine/categories')).data,
  });

  const { data: unitsData } = useQuery<{ units: Unit[] }>({
    queryKey: ['units'],
    queryFn: async () => (await api.get('/farm/units')).data,
  });

  const createMutation = resource.useCreate();
  const updateMutation = resource.useUpdate();
  const deleteMutation = resource.useRemove({
    onSuccess: (res) => {
      setDeleteTarget(null);
      toast.success(res.message ?? trashedMsg());
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? failedMsg());
    },
  });

  const openCreate = () => {
    setEditMed(null);
    setForm({ ...DEFAULT_MED });
    setIsVaccine(false);
    setOpened(JSON.stringify({ ...DEFAULT_MED, is_vaccine: false }));
    reset();
    setShowModal(true);
  };

  const openEdit = (m: Medicine) => {
    setEditMed(m);
    const next = {
      name: m.name ?? '',
      category_id: m.category_id ? String(m.category_id) : '',
      unit_id: String(m.unit_id),
      manufacturer: m.manufacturer ?? '',
      low_stock_alert: m.low_stock_alert ?? '',
      milk_withdrawal_days: String(m.milk_withdrawal_days ?? 0),
      notes: m.notes ?? '',
    };
    setForm(next);
    setIsVaccine(!!m.is_vaccine);
    setOpened(JSON.stringify({ ...next, is_vaccine: !!m.is_vaccine }));
    reset();
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditMed(null); };

  const set = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    clear(key);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const alertVal = parseFloat(form.low_stock_alert);
    const ok = check({
      name: !form.name.trim() && tc('form.v.required'),
      unit_id: !form.unit_id && tc('form.v.required'),
      // A new medicine needs a threshold above 0; an existing one just needs a value.
      low_stock_alert: (editMed ? !form.low_stock_alert : (!form.low_stock_alert || isNaN(alertVal) || alertVal <= 0))
        && t('medicine:inventory.validation.low_stock_alert_required'),
    });
    if (!ok) return;

    setIsSaving(true);
    try {
      const payload = { ...form, is_vaccine: isVaccine };
      if (editMed) {
        const res = await updateMutation.mutateAsync({ id: editMed.id, payload });
        toast.success(res.message ?? savedMsg());
      } else {
        const res = await createMutation.mutateAsync(payload);
        toast.success(res.message ?? savedMsg());
      }
      closeModal();
    } catch (err) {
      toast.error(fromApi(err, t('common:error.failed_save'), KNOWN));
    } finally {
      setIsSaving(false);
    }
  };

  const meds = data?.data ?? [];
  const categories = categoriesData?.categories ?? [];
  const units = unitsData?.units ?? [];
  const unitSymbol = units.find(u => String(u.id) === form.unit_id)?.symbol ?? '';
  const dirty = showModal && JSON.stringify({ ...form, is_vaccine: isVaccine }) !== opened;
  const isLow = (m: Medicine) =>
    parseFloat(m.remaining_quantity) <= parseFloat(m.low_stock_alert) && parseFloat(m.low_stock_alert) > 0;

  const cols: ColDef<Medicine>[] = [
    {
      key: 'name', labelKey: 'medicine:inventory.col.name', align: 'left', sortKey: 'name', sortType: 'text',
      render: m => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800">{m.name}</p>
            {m.is_vaccine && (
              <span className="text-xs bg-cyan-50 text-cyan-700 border border-cyan-200 px-1.5 py-0.5 rounded-full font-medium">{t('medicine:inventory.badge.vaccine')}</span>
            )}
          </div>
          {m.manufacturer && <p className="text-xs text-slate-400">{m.manufacturer}</p>}
        </div>
      ),
    },
    {
      key: 'category', labelKey: 'medicine:inventory.col.category', align: 'left',
      render: m => m.category
        ? <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{m.category.name}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      key: 'unit', labelKey: 'medicine:inventory.col.unit', align: 'left',
      render: m => <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{m.unit?.symbol}</span>,
    },
    {
      key: 'remaining_quantity', labelKey: 'medicine:inventory.col.stock', align: 'right', sortKey: 'stock', sortType: 'number',
      render: m => (
        <span className={isLow(m) ? 'text-red-600 font-medium' : 'text-slate-700'}>
          {fmtNum(m.remaining_quantity)} {m.unit?.symbol}
          {isLow(m) && <AlertTriangle size={12} className="inline ms-1 text-red-400" />}
        </span>
      ),
    },
    {
      key: 'low_stock_alert', labelKey: 'medicine:inventory.col.low_alert', align: 'right', sortKey: 'low_alert', sortType: 'number',
      render: m => (
        <span className="text-slate-500">
          {parseFloat(m.low_stock_alert) > 0 ? `${fmtNum(m.low_stock_alert)} ${m.unit?.symbol}` : '—'}
        </span>
      ),
    },
    {
      key: '_actions', labelKey: 'common:actions', align: 'right',
      render: m => (
        <div className="flex justify-end gap-1">
          {hasPermission('farm.medicine.edit') && (
            <button onClick={() => openEdit(m)} aria-label={tc('btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400">
              <Pencil size={14} />
            </button>
          )}
          {isSuperAdmin && (
            <button
              onClick={() => setDeleteTarget(m)}
              aria-label={tc('btn.move_to_trash')}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
            >
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
        <PageTitle title={t('medicine:inventory.title')} subtitle={t('medicine:inventory.subtitle')} />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <TrashLink href="/farm/medicine/trash" label={t('medicine:inventory.label.trash')} />
          )}
          {hasPermission('farm.medicine.create') && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center"
            >
              <Plus size={16} /> {t('medicine:inventory.add')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('medicine:inventory.search_placeholder')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('common:filter.all_categories')}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setShowLowOnly(!showLowOnly)}
          className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
            showLowOnly ? 'bg-red-50 border-red-200 text-red-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle size={14} className="inline me-1" />
          {t('medicine:inventory.filter.low_stock')}
        </button>
      </div>

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={meds}
        isLoading={isLoading}
        keyExtractor={m => m.id}
        rowClassName={m => isLow(m) ? 'bg-red-50/30' : ''}
        emptyKey="medicine:inventory.empty"
        currentPage={page}
        lastPage={data?.last_page}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('btn.move_to_trash')}
        message={t('medicine:inventory.trash.confirm_move')}
        confirmLabel={tc('btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="lg"
        title={editMed ? t('medicine:inventory.modal.edit_title') : t('medicine:inventory.modal.create_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{tc('btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={15} /> {editMed ? tc('btn.update') : tc('btn.add')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, KNOWN)} />

          <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 select-none">
            <div className={`relative w-10 h-6 rounded-full transition-colors ${isVaccine ? 'bg-cyan-500' : 'bg-slate-200'}`}>
              <span className={`absolute top-1 start-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isVaccine ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'}`} />
            </div>
            <input type="checkbox" className="sr-only" checked={isVaccine} onChange={e => setIsVaccine(e.target.checked)} />
            <div>
              <p className="text-sm font-medium text-slate-700">{t('medicine:inventory.label.is_vaccine')}</p>
              <p className="text-xs text-slate-400">{isVaccine ? t('medicine:inventory.label.vaccine_yes') : t('medicine:inventory.label.vaccine_no')}</p>
            </div>
          </label>

          <Field name="name" label={t('medicine:inventory.field.name')} required error={errors.name}>
            <input id={fieldId('name')} type="text" value={form.name} dir="auto" data-autofocus
              onChange={e => set('name', e.target.value)} className={fieldClass(errors.name)} />
          </Field>

          <FormRow>
            <Field name="category_id" label={t('medicine:inventory.field.category')} error={errors.category_id}>
              <SearchSelect id={fieldId('category_id')} value={form.category_id} onChange={v => set('category_id', v)} clearable
                placeholder="—" label={t('medicine:inventory.field.category')} error={errors.category_id}
                options={categories.map(c => ({ value: String(c.id), label: c.name }))} />
            </Field>
            <Field name="unit_id" label={t('medicine:inventory.field.unit')} required error={errors.unit_id}>
              <SearchSelect id={fieldId('unit_id')} value={form.unit_id} onChange={v => set('unit_id', v)}
                placeholder="—" label={t('medicine:inventory.field.unit')} error={errors.unit_id}
                options={units.map(u => ({ value: String(u.id), label: `${u.name} (${u.symbol})`, keywords: u.symbol }))} />
            </Field>
          </FormRow>

          <Field name="manufacturer" label={t('medicine:inventory.field.manufacturer')} error={errors.manufacturer}>
            <input id={fieldId('manufacturer')} type="text" value={form.manufacturer} dir="auto"
              onChange={e => set('manufacturer', e.target.value)} className={fieldClass(errors.manufacturer)} />
          </Field>

          <FormRow>
            <Field name="low_stock_alert" label={t('medicine:inventory.field.low_stock_alert')} required error={errors.low_stock_alert}
              hint={t('medicine:inventory.field.low_stock_alert_hint')}>
              <NumberInput id={fieldId('low_stock_alert')} value={form.low_stock_alert} onChange={v => set('low_stock_alert', v)}
                suffix={unitSymbol || undefined} error={errors.low_stock_alert} />
            </Field>
            <Field name="milk_withdrawal_days" label={t('medicine:inventory.field.milk_withdrawal_days')} error={errors.milk_withdrawal_days}
              hint={t('medicine:inventory.field.milk_withdrawal_days_hint')}>
              <NumberInput id={fieldId('milk_withdrawal_days')} value={form.milk_withdrawal_days} allowDecimal={false}
                onChange={v => set('milk_withdrawal_days', v)} error={errors.milk_withdrawal_days} />
            </Field>
          </FormRow>

          <Field name="notes" label={tc('field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} value={form.notes} dir="auto"
              onChange={e => set('notes', e.target.value)} className={fieldClass(errors.notes)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
