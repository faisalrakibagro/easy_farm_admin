'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import {
  FeedUsage, FeedAllocation, FeedStock, FeedFormulation,
  PaginatedResponse, AnimalType, AnimalAgeCategory, Shed,
} from '@/types';
import { Fragment } from 'react';
import Link from '@/components/ui/AppLink';
import { Plus, X, Check, Trash2, Beaker, Filter, Pencil, ChevronDown, ChevronUp, Package, ArchiveX, CopyPlus, AlertTriangle, Layers } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { CATTLE_COST_KEYS, FEED_STOCK_KEYS, invalidateKeys } from '@/lib/invalidateGroups';
import { useAuth } from '@/contexts/AuthContext';
import { useDateRange } from '@/lib/hooks/useDateRange';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import { useAutoOpen } from '@/lib/hooks/useAutoOpen';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import { fmtNum, fmtMoney, fmtPct } from '@/lib/format';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { SerialCell, SerialHeader, SortHeader, SortSelect, TablePagination } from '@/components/ui/TableControls';

// One line per feed; the server takes it from the lots, oldest first.
interface UsageItem { feed_item_id: string; quantity_used: string; quantity_unit: string; }
interface FeedOption { feed_item_id: string; name: string; category: string; unit: string; available: number; }

function getUnitOptions(baseUnit: string): { label: string; value: string; factor: number }[] {
  const u = (baseUnit ?? '').toLowerCase().trim();
  if (u === 'kg') return [{ label: 'KG', value: 'kg', factor: 1 }, { label: 'g', value: 'g', factor: 0.001 }];
  if (u === 'l' || u === 'liter' || u === 'litre') return [{ label: 'L', value: 'l', factor: 1 }, { label: 'mL', value: 'ml', factor: 0.001 }];
  return [{ label: baseUnit || '—', value: baseUnit?.toLowerCase() || 'unit', factor: 1 }];
}

const FORM_ID = 'daily-feed';
const EMPTY_ITEM: UsageItem = { feed_item_id: '', quantity_used: '', quantity_unit: '' };
const round3 = (n: number) => Math.round(n * 1000) / 1000;
/** A unit symbol as the unit pickers name it (grams may be set up as "gm"). */
const unitKey = (symbol?: string | null) => { const u = (symbol ?? '').toLowerCase().trim(); return ['gm', 'gram', 'grams'].includes(u) ? 'g' : u; };

/** A line's amount in the feed's own unit (grams become kilograms). */
function toBase(it: UsageItem, opt: FeedOption): number {
  const opts = getUnitOptions(opt.unit);
  const chosen = opts.find(o => o.value === it.quantity_unit) ?? opts[0];
  return round3(parseFloat(it.quantity_used) * chosen.factor);
}
const emptyForm = () => ({
  usage_date: localDateStr(),
  animal_type_id: '',
  age_category_id: '',
  allocation_method: 'weight_based',
  milk_share_percent: '40',
  shed_id: '',
  profit_center: '',
  selected_formulation_id: '',
  notes: '',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UsageItemRecord = Record<string, any>;

/** The lines of a usage with the lots of one feed added together. */
function byFeed(items: UsageItemRecord[]): UsageItemRecord[] {
  const out = new Map<string, UsageItemRecord>();
  for (const it of items) {
    const key = String(it.feed_item_id);
    const prev = out.get(key);
    out.set(key, prev ? { ...prev, quantity_used: round3(parseFloat(prev.quantity_used) + parseFloat(it.quantity_used)) } : { ...it });
  }
  return [...out.values()];
}

export default function DailyFeedingPage() {
  const { t } = useTranslation(['feed', 'common']);
  const qc = useQueryClient();
  const toast = useToast();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [items, setItems] = useState<UsageItem[]>([{ ...EMPTY_ITEM }]);
  const [form, setForm] = useState(emptyForm);
  const [opened, setOpened] = useState('');
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterAnimalTypeId, setFilterAnimalTypeId] = useState('');
  const [filterAgeCategoryId, setFilterAgeCategoryId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FeedUsage | null>(null);
  // Formula lines left out because that feed has no stock.
  const [missing, setMissing] = useState<string[]>([]);
  // While editing, what this record already took counts as available again.
  const [credit, setCredit] = useState<Record<string, FeedOption>>({});
  // Which formula/group size the lines were last filled for.
  const [filledKey, setFilledKey] = useState('');
  const dateRange = useDateRange(setPage);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);

  const { data, isLoading } = useQuery<PaginatedResponse<FeedUsage> & { data: FeedUsage[] }>({
    queryKey: ['feed-usages', page, filterAnimalTypeId, filterAgeCategoryId, dateRange.params, sorting.params],
    queryFn: async () => (await api.get('/farm/feed/usages', {
      params: { page, per_page: 15, animal_type_id: filterAnimalTypeId || undefined, age_category_id: filterAgeCategoryId || undefined, ...dateRange.params, ...sorting.params },
    })).data,
  });
  const { data: stocksData } = useQuery<{ stocks: FeedStock[] }>({
    queryKey: ['feed-available-stocks'],
    queryFn: async () => (await api.get('/farm/feed/usages/available-stocks')).data,
  });
  const { data: animalTypesData } = useQuery<AnimalType[]>({
    queryKey: ['animal-types-all'],
    queryFn: async () => (await api.get('/farm/animal-types/all')).data,
  });
  const { data: shedsData } = useQuery({
    queryKey: ['sheds-all'],
    queryFn: async () => (await api.get('/farm/sheds/all')).data.sheds as Shed[],
    enabled: showModal,
  });
  const { data: modalAgeCatsData } = useQuery<{ categories: AnimalAgeCategory[] }>({
    queryKey: ['age-categories-modal', form.animal_type_id],
    queryFn: async () => (await api.get(`/farm/animal-age-categories/by-type/${form.animal_type_id}`)).data,
    enabled: showModal && !!form.animal_type_id,
  });
  const { data: filterAgeCatsData } = useQuery<{ categories: AnimalAgeCategory[] }>({
    queryKey: ['age-categories-filter', filterAnimalTypeId],
    queryFn: async () => (await api.get(`/farm/animal-age-categories/by-type/${filterAnimalTypeId}`)).data,
    enabled: !!filterAnimalTypeId,
  });
  // How many animals share this feeding (a per-animal formula is multiplied by it).
  const { data: groupData } = useQuery<{ count: number }>({
    queryKey: ['feed-group-count', form.animal_type_id, form.age_category_id, form.shed_id, form.profit_center, form.usage_date],
    queryFn: async () => (await api.get('/farm/feed/usages/group-count', {
      params: { animal_type_id: form.animal_type_id, age_category_id: form.age_category_id || undefined, shed_id: form.shed_id || undefined,
        profit_center: form.profit_center || undefined, usage_date: form.usage_date || undefined },
    })).data,
    enabled: showModal && !!form.animal_type_id,
  });
  const groupCount = groupData?.count;
  const { data: formulationsData, isLoading: formulationsLoading } = useQuery<{ formulations: FeedFormulation[] }>({
    queryKey: ['feed-formulations-list', form.animal_type_id, form.age_category_id],
    queryFn: async () => (await api.get('/farm/feed/formulations/all', {
      params: { animal_type_id: form.animal_type_id || undefined, age_category_id: form.age_category_id || undefined },
    })).data,
    enabled: showModal,
  });

  // Field errors under their fields; anything else at the top.
  const showApiError = (e: unknown) => {
    const { fields, message } = apiFieldErrors(e, failedMsg());
    setErrors(fields);
    if (!Object.keys(fields).length) setFormError(message);
    toast.error(Object.values(fields)[0] ?? message);
  };

  const createMutation = useMutation({
    mutationFn: (d: object) => api.post('/farm/feed/usages', d),
    onSuccess: () => {
      invalidateKeys(qc, [...FEED_STOCK_KEYS, ...CATTLE_COST_KEYS, ['feed-usages'], ['feed-usages-trash'], ['farm-cattle']]);
    },
    onError: (e: unknown) => showApiError(e),
  });
  const updateMutation = useMutation({
    mutationFn: (d: { id: number; data: object }) => api.put(`/farm/feed/usages/${d.id}`, d.data),
    onSuccess: (res) => {
      invalidateKeys(qc, [...FEED_STOCK_KEYS, ...CATTLE_COST_KEYS, ['feed-usages'], ['feed-usages-trash'], ['farm-cattle']]);
      setShowModal(false); setEditingId(null); resetForm();
      toast.success(res?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => showApiError(e),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/feed/usages/${id}`),
    onSuccess: (res) => { invalidateKeys(qc, [...FEED_STOCK_KEYS, ...CATTLE_COST_KEYS, ['feed-usages'], ['feed-usages-trash'], ['farm-cattle']]); setDeleteTarget(null); toast.success(res?.data?.message ?? trashedMsg()); },
    onError: (e: unknown) => { const err = e as { response?: { data?: { message?: string } } }; toast.error(err.response?.data?.message ?? failedMsg()); },
  });

  const resetForm = () => {
    setForm(emptyForm());
    setItems([{ ...EMPTY_ITEM }]);
    setMissing([]); setCredit({});
  };

  // Every feed once, with all its lots added up (plus, while editing, what
  // this record took and gets back).
  const feedOptions = useMemo<FeedOption[]>(() => {
    const out = new Map<string, FeedOption>(Object.entries(credit).map(([k, v]) => [k, { ...v }]));
    for (const st of stocksData?.stocks ?? []) {
      const key = String(st.feed_item_id);
      const prev = out.get(key);
      const qty = parseFloat(String(st.remaining_quantity)) || 0;
      out.set(key, prev
        ? { ...prev, name: st.item_name ?? prev.name, category: st.category_name ?? prev.category, unit: st.unit ?? prev.unit, available: round3(prev.available + qty) }
        : { feed_item_id: key, name: st.item_name ?? '', category: st.category_name ?? '', unit: st.unit ?? '', available: qty });
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [stocksData, credit]);
  const openCreateModal = () => {
    setEditingId(null); resetForm(); setFormError(''); setErrors({});
    setOpened(JSON.stringify({ form: emptyForm(), items: [EMPTY_ITEM] }));
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingId(null); };
  const setField = (key: keyof typeof form, value: string) => { setForm(f => ({ ...f, [key]: value })); clearError(key); };
  const clearError = (...keys: string[]) =>
    setErrors(p => (keys.some(k => p[k]) ? { ...p, ...Object.fromEntries(keys.map(k => [k, ''])) } : p));
  const openEditModal = (u: FeedUsage) => {
    setEditingId(u.id);
    const nextForm = { usage_date: u.usage_date.split('T')[0], animal_type_id: u.animal_type_id?.toString() ?? '', age_category_id: u.age_category_id?.toString() ?? '', allocation_method: u.allocation_method, milk_share_percent: String(u.milk_share_percent ?? 40), shed_id: u.shed_id?.toString() ?? '', profit_center: u.profit_center ?? '', selected_formulation_id: '', notes: u.notes ?? '' };
    setForm(nextForm);
    const lines = byFeed((u.items ?? []) as unknown as UsageItemRecord[]);
    setCredit(Object.fromEntries(lines.map(it => [String(it.feed_item_id), {
      feed_item_id: String(it.feed_item_id), name: getItemName(it), category: it.item?.category?.name ?? '',
      unit: it.item?.unit?.symbol ?? '', available: parseFloat(it.quantity_used) || 0,
    }])));
    const editItems = lines.map(it => ({
      feed_item_id: String(it.feed_item_id), quantity_used: String(it.quantity_used),
      quantity_unit: getUnitOptions(it.item?.unit?.symbol ?? '')[0]?.value ?? '',
    }));
    const nextItems = editItems.length > 0 ? editItems : [{ ...EMPTY_ITEM }];
    setItems(nextItems); setMissing([]);
    setOpened(JSON.stringify({ form: nextForm, items: nextItems }));
    setFormError(''); setErrors({}); setShowModal(true);
  };
  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: keyof UsageItem, val: string) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));
  // Each line in the formula's own unit (100 g stays 100 g); a per-animal
  // formula is multiplied by the animals in the group.
  const fillFromFormula = (formulationId: string, count: number | undefined) => {
    const selected = (formulationsData?.formulations ?? []).find(f => f.id.toString() === formulationId);
    if (!selected?.items) return;
    const times = selected.per_animal ? (count ?? 0) : 1;
    const left: string[] = [];
    const rows: UsageItem[] = selected.items.flatMap(fi => {
      const opt = feedOptions.find(o => o.feed_item_id === String(fi.feed_item_id));
      if (!opt || opt.available <= 0) { left.push(fi.feed_item?.name ?? t('common:ui.item_n', { id: fi.feed_item_id })); return []; }
      const opts = getUnitOptions(opt.unit);
      const sym = unitKey(fi.unit?.symbol);
      const unit = opts.find(o => o.value === sym || o.label.toLowerCase() === sym)?.value ?? opts[0].value;
      return [{ feed_item_id: opt.feed_item_id, quantity_used: String(round3(parseFloat(fi.quantity) * times)), quantity_unit: unit }];
    });
    setMissing(left);
    setItems(rows.length ? rows : [{ ...EMPTY_ITEM }]);
    clearError('items');
  };
  const handleFormulationSelect = (formulationId: string) => {
    setForm(f => ({ ...f, selected_formulation_id: formulationId }));
    if (formulationId) fillFromFormula(formulationId, groupCount); else setMissing([]);
  };
  const selectedFormulation = (formulationsData?.formulations ?? []).find(f => f.id.toString() === form.selected_formulation_id);
  // The group changed under a per-animal formula: the amounts follow it
  // (set during render, React's pattern for state that follows other state).
  const fillKey = selectedFormulation?.per_animal && groupCount !== undefined ? `${selectedFormulation.id}:${groupCount}` : '';
  if (fillKey && fillKey !== filledKey) {
    setFilledKey(fillKey);
    fillFromFormula(String(selectedFormulation?.id), groupCount);
  }
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.usage_date) e.usage_date = t('daily.validation.date_required');
    if (!form.animal_type_id) e.animal_type_id = t('daily.validation.animal_type_required');
    if (items.filter(it => it.feed_item_id && parseFloat(it.quantity_used) > 0).length === 0) e.items = t('daily.validation.items_required');
    // No more than there is of each feed (all its lots, all its lines).
    const asked: Record<string, number> = {};
    items.forEach((it, i) => {
      const opt = feedOptions.find(o => o.feed_item_id === it.feed_item_id);
      if (!opt || !(parseFloat(it.quantity_used) > 0)) return;
      asked[it.feed_item_id] = (asked[it.feed_item_id] ?? 0) + toBase(it, opt);
      if (asked[it.feed_item_id] > opt.available + 0.001)
        e[`items.${i}.quantity_used`] = t('daily.validation.stock_short', { available: fmtNum(round3(opt.available)), unit: opt.unit });
    });
    setErrors(e); return Object.keys(e).length === 0;
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // "Save & add another" keeps the form open for the next group.
    const again = !!((e.nativeEvent as SubmitEvent).submitter as HTMLElement | null)?.dataset.again;
    setFormError(''); if (!validate()) return;
    const convertedItems = items.filter(it => it.feed_item_id && parseFloat(it.quantity_used) > 0).map(item => {
      const opt = feedOptions.find(o => o.feed_item_id === item.feed_item_id);
      return { feed_item_id: item.feed_item_id, quantity_used: String(opt ? toBase(item, opt) : parseFloat(item.quantity_used)) };
    });
    const payload = {
      usage_date: form.usage_date, animal_type_id: form.animal_type_id || null, age_category_id: form.age_category_id || null,
      shed_id: form.shed_id || null, profit_center: form.profit_center || null,
      allocation_method: form.allocation_method,
      milk_share_percent: form.allocation_method === 'milk_based' ? Number(form.milk_share_percent || 40) : null,
      notes: form.notes, items: convertedItems,
    };
    if (editingId) { updateMutation.mutate({ id: editingId, data: payload }); return; }
    createMutation.mutate(payload, {
      onSuccess: (res) => {
        if (again) {
          // Same date and allocation; the animals and items are cleared for the next group.
          setForm(f => ({ ...emptyForm(), usage_date: f.usage_date, allocation_method: f.allocation_method, milk_share_percent: f.milk_share_percent, shed_id: f.shed_id, profit_center: f.profit_center }));
          setItems([{ ...EMPTY_ITEM }]);
          setErrors({}); setMissing([]);
          toast.success(t('common:form.saved_add_another'));
        } else {
          setShowModal(false); setEditingId(null); resetForm();
          toast.success(res?.data?.message ?? savedMsg());
        }
      },
    });
  };
  const getItemName = (item: UsageItemRecord) => { const feedItem = item.item as UsageItemRecord | undefined; return (feedItem?.name as string) || t('common:ui.item_n', { id: item.feed_item_id }); };

  const saving = createMutation.isPending || updateMutation.isPending;
  const dirty = showModal && JSON.stringify({ form, items }) !== opened;
  const known = ['usage_date', 'animal_type_id', 'age_category_id', 'allocation_method', 'milk_share_percent', 'shed_id', 'profit_center', 'notes', 'items',
    ...items.flatMap((_, i) => [`items.${i}.feed_item_id`, `items.${i}.quantity_used`])];
  useScrollToError(errors, formError);

  const usages = data?.data ?? [];
  const animalTypes = animalTypesData ?? [];
  const modalAgeCats = modalAgeCatsData?.categories ?? [];
  const filterAgeCats = filterAgeCatsData?.categories ?? [];

  // Reached from a dashboard quick action (?new=1): open the form straight away.
  useAutoOpen(openCreateModal);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('daily.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('daily.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Link href="/farm/feed/formulations" className="flex items-center gap-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-1 sm:flex-none min-w-[9rem] sm:min-w-0 justify-center">
            <Beaker size={16} /> {t('daily.btn.formulations')}
          </Link>
          <Link href="/farm/feed/batches" className="flex items-center gap-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-1 sm:flex-none min-w-[9rem] sm:min-w-0 justify-center">
            <Layers size={16} /> {t('daily.btn.batches')}
          </Link>
          <Link href="/farm/feed/daily/trash" className="flex items-center gap-2 border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-500 hover:text-red-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-1 sm:flex-none min-w-[9rem] sm:min-w-0 justify-center">
            <ArchiveX size={16} /> {t('daily.btn.trash')}
          </Link>
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none min-w-[9rem] sm:min-w-0 justify-center">
            <Plus size={16} /> {t('daily.record')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={16} className="text-slate-400" />
        <select value={filterAnimalTypeId} onChange={e => { setFilterAnimalTypeId(e.target.value); setFilterAgeCategoryId(''); }}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('common:filter.all_types')}</option>
          {animalTypes.map(at => <option key={at.id} value={at.id}>{at.name}</option>)}
        </select>
        {filterAnimalTypeId && (
          <select value={filterAgeCategoryId} onChange={e => setFilterAgeCategoryId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">{t('common:filter.all_ages')}</option>
            {filterAgeCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {(filterAnimalTypeId || filterAgeCategoryId) && (
          <button onClick={() => { setFilterAnimalTypeId(''); setFilterAgeCategoryId(''); }} className="text-xs text-red-500 hover:underline flex items-center gap-1">
            <X size={12} /> {t('daily.btn.clear_filter')}
          </button>
        )}
      </div>

      <DateRangeFilter value={dateRange.range} onChange={dateRange.setRange} />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="block sm:hidden divide-y divide-slate-100">
          <SortSelect options={[
            { key: 'date', label: t('daily.col.date'), type: 'date' },
            { key: 'total', label: t('daily.col.total_cost'), type: 'number' },
          ]} sorting={sorting} className="px-4 py-2.5" />
          {isLoading ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1.5"><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /><div className="h-3 w-16 bg-slate-100 rounded animate-pulse" /></div>
                <div className="flex gap-1"><div className="h-7 w-7 bg-slate-100 rounded animate-pulse" /><div className="h-7 w-7 bg-slate-100 rounded animate-pulse" /></div>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
            </div>
          )) : usages.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">{t('daily.empty')}</div>
          ) : usages.map(u => {
            const isExpanded = expandedId === u.id;
            const usageItems = byFeed((u.items ?? []) as unknown as Array<UsageItemRecord>);
            return (
              <div key={u.id} className="divide-y divide-slate-50">
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap gap-3">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{new Date(u.usage_date).toLocaleDateString(localeFor())}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {u.animalType && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{u.animalType.name}</span>}
                        {u.ageCategory && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{u.ageCategory.name}</span>}
                        {!u.animalType && !u.ageCategory && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t('daily.label.all_animals')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditModal(u)} aria-label={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={14} /></button>
                      {isSuperAdmin && (
                        <button onClick={() => setDeleteTarget(u)} aria-label={t('common:btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {usageItems.slice(0, 3).map((it, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                        <Package size={10} /> {getItemName(it)} ({fmtNum(it.quantity_used)} {it.unit?.symbol ?? ''})
                      </span>
                    ))}
                    {usageItems.length > 3 && <span className="text-xs text-slate-400 self-center">{t('daily.label.more_n', { count: usageItems.length - 3 })}</span>}
                    {usageItems.length === 0 && <span className="text-xs text-slate-400">{t('daily.label.no_items')}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><p className="text-slate-400">{t('daily.col.total_cost')}</p><p className="font-semibold text-slate-800">{fmtMoney(u.total_feed_cost)}</p></div>
                    <div><p className="text-slate-400">{t('daily.col.cattle')}</p><p className="font-medium text-slate-700">{fmtNum(u.active_cattle_count)}</p></div>
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : u.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {t('daily.feeding_details')}
                  </button>
                </div>
                {isExpanded && (
                  <div className="px-4 py-3 bg-slate-50 space-y-2">
                    {u.notes && <p className="text-xs text-slate-500 italic">{u.notes}</p>}
                    {(u.allocations ?? []).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('daily.label.allocation_by_count', { count: (u.allocations ?? []).length })}</p>
                        {(u.allocations as FeedAllocation[]).map((alloc) => (
                          <div key={alloc.id} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                            <div><p className="font-medium text-slate-700">{alloc.cattle?.tag_number ?? `#${alloc.cattle_id}`}</p></div>
                            <p className="text-green-700 font-semibold">{fmtMoney(alloc.allocated_cost)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <SerialHeader />
                <th className="text-start px-4 py-3 font-medium text-slate-600 w-8"></th>
                <SortHeader label={t('daily.col.date')} sortKey="date" sortType="date" sorting={sorting} />
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('daily.col.animal_type')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('daily.col.age_category')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('daily.col.food_items')}</th>
                <SortHeader label={t('daily.col.total_cost')} align="right" sortKey="total" sortType="number" sorting={sorting} />
                <th className="text-center px-4 py-3 font-medium text-slate-600">{t('daily.col.cattle')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('common:actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
              )) : usages.map((u, i) => {
                const isExpanded = expandedId === u.id;
                const usageItems = byFeed((u.items ?? []) as unknown as Array<UsageItemRecord>);
                const lotLines = (u.items ?? []) as unknown as Array<UsageItemRecord>;
                return (
                  <Fragment key={u.id}>
                    <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : u.id)}>
                      <SerialCell index={i} page={page} perPage={15} />
                      <td className="px-4 py-3"><button className="p-1">{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button></td>
                      <td className="px-4 py-3 font-medium text-slate-700">{new Date(u.usage_date).toLocaleDateString(localeFor())}</td>
                      <td className="px-4 py-3">{u.animalType ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{u.animalType.name}</span> : <span className="text-xs text-slate-400">{t('daily.label.all')}</span>}</td>
                      <td className="px-4 py-3">{u.ageCategory ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{u.ageCategory.name}</span> : <span className="text-xs text-slate-400">{t('daily.label.all')}</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {usageItems.slice(0, 3).map((it, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                              <Package size={10} /> {getItemName(it)} ({fmtNum(it.quantity_used)} {it.unit?.symbol ?? ''})
                            </span>
                          ))}
                          {usageItems.slice(3).length > 0 && <span className="text-xs text-slate-400">{t('daily.label.more_n', { count: usageItems.length - 3 })}</span>}
                          {usageItems.length === 0 && <span className="text-xs text-slate-400">{t('daily.label.no_items')}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end font-medium text-slate-700">{fmtMoney(u.total_feed_cost)}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{fmtNum(u.active_cattle_count)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => openEditModal(u)} aria-label={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={14} /></button>
                          {isSuperAdmin && (
                            <button onClick={() => setDeleteTarget(u)} aria-label={t('common:btn.delete')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${u.id}-expanded`}>
                        <td colSpan={9} className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{t('daily.feeding_details')}</h4>
                              <span className="text-xs text-slate-500">({t('daily.method.' + u.allocation_method)}{u.allocation_method === 'milk_based' && u.milk_share_percent != null ? ` · ${u.milk_share_percent}%` : ''}{u.profit_center ? ` · ${t('daily.center.' + u.profit_center)}` : ''})</span>
                              {u.notes && <span className="text-xs text-slate-500 italic">{u.notes}</span>}
                            </div>
                            <table className="w-full text-xs">
                              <thead><tr className="border-b border-slate-200">
                                <th className="text-start py-2 font-medium text-slate-600">{t('daily.col.food_item')}</th>
                                <th className="text-end py-2 font-medium text-slate-600">{t('daily.col.qty_used')}</th>
                                <th className="text-end py-2 font-medium text-slate-600">{t('daily.col.unit_price')}</th>
                                <th className="text-end py-2 font-medium text-slate-600">{t('daily.col.total_cost')}</th>
                              </tr></thead>
                              <tbody className="divide-y divide-slate-100">
                                {lotLines.map((it, idx) => (
                                  <tr key={idx} className="hover:bg-white">
                                    <td className="py-2 font-medium text-slate-700">{getItemName(it)}</td>
                                    <td className="py-2 text-end text-slate-600">{fmtNum(it.quantity_used)}</td>
                                    <td className="py-2 text-end text-slate-600">{fmtMoney(it.unit_price)}</td>
                                    <td className="py-2 text-end font-medium text-amber-700">{fmtMoney(it.total_cost)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {(u.allocations ?? []).length > 0 && (
                              <div>
                                <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">{t('daily.label.allocation_by_count', { count: (u.allocations ?? []).length })}</h5>
                                <table className="w-full text-xs">
                                  <thead><tr className="border-b border-slate-200">
                                    <th className="text-start py-2 font-medium text-slate-600">{t('daily.col.tag_no')}</th>
                                    <th className="text-start py-2 font-medium text-slate-600">{t('daily.col.name')}</th>
                                    <th className="text-end py-2 font-medium text-slate-600">{t('daily.col.share_pct')}</th>
                                    <th className="text-end py-2 font-medium text-slate-600">{t('daily.col.allocated_cost')}</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {(u.allocations as FeedAllocation[]).map((alloc) => (
                                      <tr key={alloc.id} className="hover:bg-white">
                                        <td className="py-2 font-medium text-slate-700">{alloc.cattle?.tag_number ?? `#${alloc.cattle_id}`}</td>
                                        <td className="py-2 text-slate-500">{alloc.cattle?.name ?? '—'}</td>
                                        <td className="py-2 text-end text-slate-500">{fmtPct(parseFloat(alloc.weight_ratio) * 100, 1)}</td>
                                        <td className="py-2 text-end font-semibold text-green-700">{fmtMoney(alloc.allocated_cost)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot><tr className="border-t border-slate-300">
                                    <td colSpan={3} className="py-2 font-semibold text-slate-700 text-xs">{t('daily.label.total_allocated_cost')}</td>
                                    <td className="py-2 text-end font-bold text-green-800">{fmtMoney((u.allocations as FeedAllocation[]).reduce((s, a) => s + parseFloat(a.allocated_cost), 0))}</td>
                                  </tr></tfoot>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!isLoading && usages.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">{t('daily.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {(data?.total ?? 0) > 0 && (
          <TablePagination page={page} lastPage={data?.last_page ?? 1} total={data?.total} perPage={15} onPageChange={setPage} />
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('daily.confirm.delete_title')}
        message={t('daily.confirm.delete_message', { date: deleteTarget ? new Date(deleteTarget.usage_date).toLocaleDateString(localeFor()) : '' })}
        confirmLabel={t('daily.confirm.delete_label')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="2xl"
        title={editingId ? t('daily.edit_title') : t('daily.create_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          {!editingId && (
            <button type="submit" form={FORM_ID} data-again="1" disabled={saving} className={btnSecondary}>
              <CopyPlus size={15} /> {t('common:form.save_add_another')}
            </button>
          )}
          <button type="submit" form={FORM_ID} disabled={saving} className={btnPrimary}>
            <Check size={15} /> {editingId ? t('daily.btn.update_reallocate') : t('daily.btn.record_allocate')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-5">
          <FormAlert message={formError} extra={otherErrors(errors, known)} />

          <FormRow>
            <Field name="usage_date" label={t('daily.field.date')} required error={errors.usage_date}>
              <input id={fieldId('usage_date')} type="date" value={form.usage_date}
                onChange={e => setField('usage_date', e.target.value)} className={fieldClass(errors.usage_date)} />
            </Field>
            <Field name="allocation_method" label={t('daily.field.allocation_method')} error={errors.allocation_method}>
              <select id={fieldId('allocation_method')} value={form.allocation_method} onChange={e => setField('allocation_method', e.target.value)}
                className={fieldClass(errors.allocation_method)}>
                <option value="weight_based">{t('daily.field.allocation_weight')}</option>
                <option value="equal">{t('daily.field.allocation_equal')}</option>
                <option value="milk_based">{t('daily.field.allocation_milk')}</option>
              </select>
            </Field>
          </FormRow>

          <FormRow>
            <Field name="animal_type_id" label={t('daily.field.animal_type')} required error={errors.animal_type_id}>
              <SearchSelect id={fieldId('animal_type_id')} value={form.animal_type_id} label={t('daily.field.animal_type')}
                placeholder={t('daily.label.select_animal_type')} error={errors.animal_type_id}
                onChange={v => { setForm(f => ({ ...f, animal_type_id: v, age_category_id: '', selected_formulation_id: '' })); clearError('animal_type_id'); }}
                options={animalTypes.map(at => ({ value: String(at.id), label: at.name }))} />
            </Field>
            <Field name="age_category_id" label={t('daily.field.age_category')} error={errors.age_category_id}>
              <SearchSelect id={fieldId('age_category_id')} value={form.age_category_id} label={t('daily.field.age_category')}
                disabled={!form.animal_type_id} error={errors.age_category_id}
                placeholder={form.animal_type_id ? t('daily.label.all_age_animals') : t('daily.label.select_animal_type_first')}
                onChange={v => setForm(f => ({ ...f, age_category_id: v, selected_formulation_id: '' }))}
                options={form.animal_type_id
                  ? [{ value: '', label: t('daily.label.all_age_animals') }, ...modalAgeCats.map(c => ({ value: String(c.id), label: c.name }))]
                  : []} />
            </Field>
          </FormRow>

          <FormRow>
            <Field name="shed_id" label={t('daily.field.shed')} error={errors.shed_id}>
              <SearchSelect id={fieldId('shed_id')} value={form.shed_id} label={t('daily.field.shed')} error={errors.shed_id}
                onChange={v => setField('shed_id', v)}
                options={[{ value: '', label: t('daily.label.all_sheds') }, ...(shedsData ?? []).map(sh => ({ value: String(sh.id), label: sh.name }))]} />
            </Field>
            <Field name="profit_center" label={t('daily.field.profit_center')} error={errors.profit_center}>
              <select id={fieldId('profit_center')} value={form.profit_center} onChange={e => setField('profit_center', e.target.value)}
                className={fieldClass(errors.profit_center)}>
                <option value="">{t('daily.label.all_centers')}</option>
                {['fattening', 'breeding', 'dairy'].map(pc => <option key={pc} value={pc}>{t('daily.center.' + pc)}</option>)}
              </select>
            </Field>
          </FormRow>

          {form.allocation_method === 'milk_based' && (
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
              <Field name="milk_share_percent" label={t('daily.field.milk_share_percent')} error={errors.milk_share_percent}
                hint={<span className="text-sky-800">{t('daily.label.milk_based_hint', { pct: form.milk_share_percent || 40 })}</span>}>
                <NumberInput id={fieldId('milk_share_percent')} value={form.milk_share_percent} suffix="%" className="w-32"
                  onChange={v => setField('milk_share_percent', v)} error={errors.milk_share_percent} />
              </Field>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <Field name="selected_formulation_id"
              label={<span className="text-blue-700"><Beaker size={14} className="inline me-1" />{t('daily.field.formulation')} <span className="font-normal text-blue-500">({t('daily.label.formulation_auto_hint')})</span></span>}
              hint={form.selected_formulation_id
                ? <span className="text-blue-600 inline-flex items-center gap-1"><Check size={12} /> {selectedFormulation?.per_animal
                    ? t('daily.label.formulation_per_animal', { count: groupCount ?? 0 })
                    : t('daily.label.formulation_filled_check')}</span>
                : (!formulationsLoading && form.animal_type_id && (formulationsData?.formulations ?? []).length === 0 ? t('daily.label.no_formulation') : undefined)}>
              {formulationsLoading && form.animal_type_id ? (
                <div className={fieldClass(false, 'text-slate-400 animate-pulse')}>{t('common:status.loading')}</div>
              ) : (
                <SearchSelect id={fieldId('selected_formulation_id')} value={form.selected_formulation_id} clearable
                  label={t('daily.field.formulation')} disabled={!form.animal_type_id}
                  placeholder={form.animal_type_id ? t('daily.label.select_formulation') : t('daily.label.formulation_load_hint')}
                  onChange={handleFormulationSelect}
                  options={(formulationsData?.formulations ?? []).map(f => ({ value: String(f.id), label: f.name,
                    sub: [f.ageCategory?.name, f.per_animal ? t('daily.label.per_animal_tag') : ''].filter(Boolean).join(' · ') || undefined }))} />
              )}
            </Field>
            {selectedFormulation?.per_animal && groupCount === 0 && (
              <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle size={14} className="shrink-0 mt-px" /> {t('daily.label.group_empty')}</p>
            )}
            {missing.length > 0 && (
              <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle size={14} className="shrink-0 mt-px" /> {t('daily.label.formula_missing', { items: missing.join(', ') })}</p>
            )}
          </div>

          <Field name="items" error={errors.items}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-medium text-slate-600">
                {t('daily.field.feed_items')}<span className="text-red-500 ms-0.5" aria-hidden="true">*</span>
              </p>
              <button type="button" onClick={addItem}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1 -me-2 rounded-lg hover:bg-blue-50">
                {t('daily.btn.add_item')}
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => {
                const selectedFeed = feedOptions.find(o => o.feed_item_id === item.feed_item_id);
                const unitOpts = getUnitOptions(selectedFeed?.unit ?? '');
                const showUnitDropdown = item.feed_item_id && unitOpts.length > 1;
                const stockKey = `items.${i}.feed_item_id`;
                const qtyKey = `items.${i}.quantity_used`;
                return (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_11rem] gap-2">
                        <Field name={stockKey} error={errors[stockKey]}>
                          <SearchSelect id={fieldId(stockKey)} value={item.feed_item_id} label={t('daily.field.item')}
                            placeholder={t('daily.label.select_item')} error={errors[stockKey]}
                            onChange={feedId => {
                              const opt = feedOptions.find(o => o.feed_item_id === feedId);
                              const opts = getUnitOptions(opt?.unit ?? '');
                              setItems(prev => prev.map((it, idx) => idx === i ? { ...it, feed_item_id: feedId, quantity_unit: opts[0]?.value ?? '' } : it));
                              clearError('items', stockKey);
                            }}
                            options={feedOptions.map(o => ({
                              value: o.feed_item_id, label: o.name, keywords: o.category,
                              sub: t('daily.label.feed_available', { category: o.category, qty: fmtNum(round3(o.available)), unit: o.unit }),
                            }))} />
                        </Field>
                        <Field name={qtyKey} error={errors[qtyKey]}>
                          <NumberInput id={fieldId(qtyKey)} value={item.quantity_used} placeholder={t('daily.placeholder.quantity')}
                            aria-label={t('daily.placeholder.quantity')} error={errors[qtyKey]}
                            onChange={v => { updateItem(i, 'quantity_used', v); clearError('items', qtyKey); }}
                            suffix={showUnitDropdown ? (
                              <select value={item.quantity_unit || unitOpts[0]?.value} aria-label={t('daily.unit_fallback')}
                                onChange={e => updateItem(i, 'quantity_unit', e.target.value)}
                                className="-mx-3 h-full bg-transparent px-2 text-sm font-medium text-slate-600 focus:outline-none cursor-pointer">
                                {unitOpts.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                              </select>
                            ) : (selectedFeed ? selectedFeed.unit : t('daily.unit_fallback'))} />
                        </Field>
                      </div>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} aria-label={t('common:ui.remove_item')}
                          className="p-2 -me-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>

          <Field name="notes" label={t('common:field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} value={form.notes} dir="auto"
              onChange={e => setField('notes', e.target.value)} className={fieldClass(errors.notes)} />
          </Field>

          <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">{t('daily.cost_allocation_hint')}</p>
        </form>
      </Modal>
    </div>
  );
}
