'use client';

import { Fragment, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { invalidateKeys } from '@/lib/invalidateGroups';
import { FeedFormulation, FeedFormulationItem, FeedItem, Unit, AnimalType, AnimalAgeCategory } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, X, Check, Trash2, Beaker, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { failedMsg } from '@/lib/feedback';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import TrashLink from '@/components/ui/TrashLink';
import { fmtNum } from '@/lib/format';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { SerialCell, SerialHeader, SortHeader, SortSelect, TablePagination } from '@/components/ui/TableControls';

function getCompatibleUnits(feedItemId: string, feedItemsList: FeedItem[], allUnits: Unit[]): Unit[] {
  const fi = feedItemsList.find(item => item.id.toString() === feedItemId);
  if (!fi?.unit) return allUnits;
  const baseSymbol = fi.unit.symbol.toLowerCase().trim();
  // Grams may be set up as "g" or "gm".
  const subSymbols = baseSymbol === 'kg' ? ['g', 'gm', 'gram'] : (baseSymbol === 'l' || baseSymbol === 'liter' || baseSymbol === 'litre') ? ['ml'] : null;
  const base = allUnits.find(u => u.id === fi.unit_id) ?? (fi.unit as Unit);
  const result: Unit[] = [base];
  if (subSymbols) {
    const sub = allUnits.find(u => subSymbols.includes(u.symbol.toLowerCase().trim()));
    if (sub) result.push(sub);
  }
  return result.length > 0 ? result : allUnits;
}

type FormItem = { feed_item_id: string; quantity: string; unit_id: string; notes: string };

type FormState = {
  name: string; animal_type_id: string; age_category_id: string;
  notes: string; is_active: boolean;
  /** The amounts are for one animal; daily entry multiplies by the group. */
  per_animal: boolean;
  items: FormItem[];
};

const DEFAULT_FORM: FormState = {
  name: '', animal_type_id: '', age_category_id: '',
  notes: '', is_active: true, per_animal: false,
  items: [{ feed_item_id: '', quantity: '1', unit_id: '', notes: '' }],
};

const FORM_ID = 'feed-formulation';

export default function FeedFormulationsPage() {
  const { t } = useTranslation('feed');
  const { t: tc } = useTranslation('common');
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [opened, setOpened] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FeedFormulation | null>(null);

  const { data, isLoading } = useQuery<{ data: FeedFormulation[]; last_page: number; total: number }>({
    queryKey: ['feed-formulations', page, sorting.params],
    queryFn: async () => (await api.get('/farm/feed/formulations', { params: { page, per_page: 15, ...sorting.params } })).data,
  });

  const { data: feedItemsData } = useQuery<{ items: FeedItem[] }>({
    queryKey: ['feed-items-all'],
    queryFn: async () => (await api.get('/farm/feed/items/all')).data,
  });

  const { data: feedUnitsData } = useQuery<{ units: Unit[] }>({
    queryKey: ['units'],
    queryFn: async () => (await api.get('/farm/units')).data,
  });

  const { data: animalTypesData } = useQuery<AnimalType[]>({
    queryKey: ['animal-types-all'],
    queryFn: async () => (await api.get('/farm/animal-types/all')).data,
  });

  const { data: modalAgeCatsData } = useQuery<{ categories: AnimalAgeCategory[] }>({
    queryKey: ['age-categories-formulation-modal', form.animal_type_id],
    queryFn: async () => (await api.get(`/farm/animal-age-categories/by-type/${form.animal_type_id}`)).data,
    enabled: showModal && !!form.animal_type_id,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/feed/formulations/${id}`),
    onSuccess: () => {
      invalidateKeys(qc, [['feed-formulations'], ['feed-formulations-trash'], ['feed-formulations-list']]);
      setDeleteTarget(null);
    },
  });

  const feedItems = feedItemsData?.items ?? [];
  const feedUnits = feedUnitsData?.units ?? [];
  const animalTypes = animalTypesData ?? [];
  const formulations = data?.data ?? [];
  const modalAgeCats = modalAgeCatsData?.categories ?? [];

  const openCreate = () => {
    setEditingId(null);
    const next = { ...DEFAULT_FORM, items: [{ feed_item_id: '', quantity: '1', unit_id: '', notes: '' }] };
    setForm(next);
    setOpened(JSON.stringify(next));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const openEditModal = (f: FeedFormulation) => {
    setEditingId(f.id);
    const next: FormState = {
      name: f.name ?? '',
      animal_type_id: f.animal_type_id?.toString() ?? '',
      age_category_id: f.age_category_id?.toString() ?? '',
      notes: f.notes ?? '',
      is_active: f.is_active,
      per_animal: !!f.per_animal,
      items: (f.items ?? []).map((fi) => ({
        feed_item_id: fi.feed_item_id.toString(),
        quantity: fi.quantity,
        unit_id: fi.unit_id?.toString() ?? '',
        notes: fi.notes ?? '',
      })),
    };
    setForm(next);
    setOpened(JSON.stringify(next));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); };

  const dirty = showModal && JSON.stringify(form) !== opened;
  const known = ['name', 'animal_type_id', 'age_category_id', 'notes', 'is_active', 'per_animal', 'items',
    ...form.items.flatMap((_, i) => [`items.${i}.feed_item_id`, `items.${i}.quantity`, `items.${i}.unit_id`])];
  useScrollToError(errors, formError);

  const clearError = (...keys: string[]) =>
    setErrors(p => (keys.some(k => p[k]) ? { ...p, ...Object.fromEntries(keys.map(k => [k, ''])) } : p));

  const validate = () => {
    const e: Record<string, string> = {};

    if (!form.name.trim())
      e.name = t('formulations.error.name_required');

    const hasAnyItem = form.items.some(it => it.feed_item_id);
    if (!hasAnyItem)
      e.items = t('formulations.error.items_required');

    form.items.forEach((item, i) => {
      if (!item.feed_item_id)
        e[`items.${i}.feed_item_id`] = t('formulations.error.item_feed_required');
      const qty = parseFloat(item.quantity);
      if (!item.quantity || isNaN(qty) || qty <= 0)
        e[`items.${i}.quantity`] = t('formulations.error.item_qty_invalid');
    });

    setErrors(e);
    setFormError('');
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    setIsSaving(true);
    const payload = {
      ...form,
      animal_type_id: form.animal_type_id || null,
      age_category_id: form.age_category_id || null,
      total_quantity_per_day: null,
      unit_id: null,
    };
    try {
      if (editingId) {
        await api.put(`/farm/feed/formulations/${editingId}`, payload);
      } else {
        await api.post('/farm/feed/formulations', payload);
      }
      invalidateKeys(qc, [['feed-formulations'], ['feed-formulations-trash'], ['feed-formulations-list']]);
      closeModal();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { feed_item_id: '', quantity: '1', unit_id: '', notes: '' }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, key: keyof FormItem, val: string) =>
    setForm(f => ({
      ...f,
      items: f.items.map((item, idx) => {
        if (idx !== i) return item;
        const updated = { ...item, [key]: val };
        if (key === 'feed_item_id') {
          const fi = feedItems.find(x => x.id.toString() === val);
          updated.unit_id = fi?.unit_id?.toString() ?? '';
        }
        return updated;
      }),
    }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('formulations.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('formulations.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <TrashLink href="/farm/feed/formulations/trash" />
          )}
          {hasPermission('farm.feed.create') && (
            <button onClick={openCreate}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
              <Plus size={16} /> {t('formulations.new')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Mobile card view */}
        <div className="block sm:hidden divide-y divide-slate-100">
          <SortSelect options={[{ key: 'name', label: t('formulations.col.name'), type: 'text' }]} sorting={sorting} className="px-4 py-2.5" />
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                  </div>
                  <div className="flex gap-1">
                    <div className="h-7 w-7 bg-slate-100 rounded animate-pulse" />
                    <div className="h-7 w-7 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
                  <div className="h-5 w-12 bg-slate-100 rounded-full animate-pulse" />
                </div>
              </div>
            ))
          ) : formulations.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">{t('formulations.empty')}</div>
          ) : formulations.map(f => (
            <div key={f.id} className="divide-y divide-slate-50">
              <div className="p-4 space-y-3">
                {/* Card header: name + age badge + actions */}
                <div className="flex items-start justify-between gap-2 flex-wrap gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{f.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {f.ageCategory ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{f.ageCategory.name}</span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">—</span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${f.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {f.is_active ? t('common:status.active') : t('common:status.inactive')}
                      </span>
                      {f.per_animal && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{t('formulations.label.per_animal_tag')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasPermission('farm.feed.edit') && (
                      <button onClick={() => openEditModal(f)} aria-label={tc('btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={14} /></button>
                    )}
                    {isSuperAdmin && (
                      <button onClick={() => setDeleteTarget(f)} aria-label={tc('btn.move_to_trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                {/* Animal type + ingredient count */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <p className="text-slate-400">{t('formulations.col.animal_type')}</p>
                    <p className="text-slate-700 font-medium">{f.animal_type?.name ?? t('formulations.label.all_animal_types')}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">{t('formulations.col.items')}</p>
                    <button
                      onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                      className="inline-flex items-center gap-1 text-xs bg-slate-100 px-2 py-0.5 rounded-full hover:bg-slate-200 mt-0.5"
                    >
                      {t('formulations.label.items_count', { count: f.items?.length ?? 0 })} {expandedId === f.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  </div>
                </div>
              </div>
              {/* Expanded ingredients */}
              {expandedId === f.id && f.items && f.items.length > 0 && (
                <div className="px-4 py-3 bg-slate-50 space-y-1.5">
                  {f.items.map((fi: FeedFormulationItem, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <Beaker size={12} className="text-amber-500 shrink-0" />
                      <span className="font-medium text-slate-700">{fi.feed_item?.name ?? tc('ui.item_n', { id: fi.feed_item_id })}</span>
                      <span className="text-slate-500">{fmtNum(fi.quantity)} {fi.unit?.symbol ?? ''}</span>
                      {fi.notes && <span className="text-slate-400 italic">({fi.notes})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Desktop table view */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <SerialHeader />
                <SortHeader label={t('formulations.col.name')} sortKey="name" sortType="text" sorting={sorting} />
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('formulations.col.animal_type')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('formulations.col.age_category')}</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">{t('formulations.col.items')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('formulations.col.status')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('common:actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : formulations.map((f, i) => (
                <Fragment key={f.id}>
                  <tr className="hover:bg-slate-50">
                    <SerialCell index={i} page={page} perPage={15} />
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {f.name}
                      {f.per_animal && <span className="ms-2 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700">{t('formulations.label.per_animal_tag')}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{f.animal_type?.name ?? t('formulations.label.all_animal_types')}</td>
                    <td className="px-4 py-3">
                      {f.ageCategory ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{f.ageCategory.name}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setExpandedId(expandedId === f.id ? null : f.id)} className="inline-flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded-full hover:bg-slate-200">
                        {t('formulations.label.items_count', { count: f.items?.length ?? 0 })} {expandedId === f.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${f.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {f.is_active ? t('common:status.active') : t('common:status.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {hasPermission('farm.feed.edit') && (
                          <button onClick={() => openEditModal(f)} aria-label={tc('btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={14} /></button>
                        )}
                        {isSuperAdmin && (
                          <button onClick={() => setDeleteTarget(f)} aria-label={tc('btn.move_to_trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === f.id && f.items && f.items.length > 0 && (
                    <tr key={`${f.id}-detail`}>
                      <td colSpan={7} className="px-4 py-3 bg-slate-50">
                        <div className="space-y-1">
                          {f.items.map((fi: FeedFormulationItem, idx: number) => (
                            <div key={idx} className="flex items-center gap-3 text-xs">
                              <Beaker size={12} className="text-amber-500" />
                              <span className="font-medium text-slate-700">{fi.feed_item?.name ?? tc('ui.item_n', { id: fi.feed_item_id })}</span>
                              <span className="text-slate-500">{fmtNum(fi.quantity)} {fi.unit?.symbol ?? ''}</span>
                              {fi.notes && <span className="text-slate-400 italic">({fi.notes})</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!isLoading && formulations.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">{t('formulations.empty')}</td></tr>
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
        title={tc('btn.move_to_trash')}
        message={t('formulations.confirm.move_trash_message', { name: deleteTarget?.name ?? '' })}
        confirmLabel={tc('btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="2xl"
        title={editingId ? t('formulations.edit_title') : t('formulations.create_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{tc('btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={15} /> {editingId ? tc('btn.update') : tc('btn.create')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-5">
          <FormAlert message={formError} extra={otherErrors(errors, known)} />

          {/* 1. Name */}
          <Field name="name" label={t('formulations.field.name')} required error={errors.name}>
            <input id={fieldId('name')} type="text" value={form.name} dir="auto" data-autofocus
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); clearError('name'); }}
              className={fieldClass(errors.name)} />
          </Field>

          <FormRow>
            {/* 2. Animal Type */}
            <Field name="animal_type_id" label={t('formulations.field.animal_type')} error={errors.animal_type_id}>
              <SearchSelect id={fieldId('animal_type_id')} value={form.animal_type_id} label={t('formulations.field.animal_type')}
                onChange={v => setForm(f => ({ ...f, animal_type_id: v, age_category_id: '' }))} error={errors.animal_type_id}
                options={[{ value: '', label: t('formulations.all_types') }, ...animalTypes.map(at => ({ value: String(at.id), label: at.name }))]} />
            </Field>

            {/* 3. Age Category */}
            <Field name="age_category_id" label={t('formulations.field.age_category')} error={errors.age_category_id}>
              <SearchSelect id={fieldId('age_category_id')} value={form.age_category_id} label={t('formulations.field.age_category')}
                onChange={v => setForm(f => ({ ...f, age_category_id: v }))} error={errors.age_category_id}
                disabled={!form.animal_type_id}
                placeholder={form.animal_type_id ? t('formulations.label.all_age_animals') : t('formulations.label.select_animal_type_first')}
                options={form.animal_type_id
                  ? [{ value: '', label: t('formulations.label.all_age_animals') }, ...modalAgeCats.map(c => ({ value: String(c.id), label: c.name }))]
                  : []} />
            </Field>
          </FormRow>

          {/* 4. What the amounts are for */}
          <Field name="per_animal" label={t('formulations.field.amount_for')}
            hint={form.per_animal ? t('formulations.hint.per_animal') : t('formulations.hint.per_group')}>
            <div role="radiogroup" aria-label={t('formulations.field.amount_for')} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([false, true] as const).map(v => (
                <label key={String(v)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${form.per_animal === v ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <input type="radio" name="per_animal" checked={form.per_animal === v}
                    onChange={() => setForm(f => ({ ...f, per_animal: v }))} className="text-blue-500 focus:ring-blue-500" />
                  {v ? t('formulations.field.per_animal') : t('formulations.field.per_group')}
                </label>
              ))}
            </div>
          </Field>

          {/* 5. Ingredients: a card per row, so each one fits a phone */}
          <Field name="items" error={errors.items}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-medium text-slate-600">
                {t('formulations.field.ingredients')}<span className="text-red-500 ms-0.5" aria-hidden="true">*</span>
              </p>
              <button type="button" onClick={addItem}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1 -me-2 rounded-lg hover:bg-blue-50">
                {t('formulations.label.add_item')}
              </button>
            </div>
            <div className="space-y-2">
              {(() => {
                const selectedIds = form.items.map(it => it.feed_item_id).filter(Boolean);
                return form.items.map((item, i) => {
                  const compatibleUnits = getCompatibleUnits(item.feed_item_id, feedItems, feedUnits);
                  const feedKey = `items.${i}.feed_item_id`;
                  const qtyKey = `items.${i}.quantity`;
                  const unitKey = `items.${i}.unit_id`;
                  return (
                    <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_11rem] gap-2">
                          <Field name={feedKey} label={t('formulations.label.feed_item')} required error={errors[feedKey]}>
                            <SearchSelect id={fieldId(feedKey)} value={item.feed_item_id} label={t('formulations.label.feed_item')}
                              placeholder={t('formulations.placeholder.select_feed_item')} error={errors[feedKey]}
                              onChange={v => { updateItem(i, 'feed_item_id', v); clearError(feedKey, 'items'); }}
                              options={feedItems
                                .filter(fi => fi.id.toString() === item.feed_item_id || !selectedIds.includes(fi.id.toString()))
                                .map(fi => ({ value: String(fi.id), label: fi.name, sub: fi.unit?.symbol ?? fi.category?.name }))} />
                          </Field>
                          <Field name={qtyKey} label={t('formulations.label.quantity')} required error={errors[qtyKey] ?? errors[unitKey]}>
                            <NumberInput id={fieldId(qtyKey)} value={item.quantity} error={errors[qtyKey] ?? errors[unitKey]}
                              onChange={v => { updateItem(i, 'quantity', v); clearError(qtyKey); }}
                              suffix={
                                <select value={item.unit_id} aria-label={t('formulations.label.unit')}
                                  onChange={e => { updateItem(i, 'unit_id', e.target.value); clearError(unitKey); }}
                                  className="-mx-3 h-full bg-transparent px-2 text-sm text-slate-600 focus:outline-none cursor-pointer">
                                  <option value="">{tc('field.unit')}</option>
                                  {compatibleUnits.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                                </select>
                              } />
                          </Field>
                        </div>
                        {form.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(i)} aria-label={tc('ui.remove_item')}
                            className="mt-5 p-2 -me-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </Field>

          {/* 6. Active */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500" />
            <span className="text-sm font-medium text-slate-600">{t('formulations.field.active')}</span>
          </label>

          {/* 7. Notes */}
          <Field name="notes" label={tc('field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} value={form.notes} dir="auto"
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={fieldClass(errors.notes)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
