'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { FeedItem, FeedCategory, Unit, PaginatedResponse } from '@/types';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { FEED_STOCK_KEYS } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import TrashLink from '@/components/ui/TrashLink';
import { savedMsg, trashedMsg } from '@/lib/feedback';
import PageTitle from '@/components/ui/PageTitle';
import { fmtNum } from '@/lib/format';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import FormRow from '@/components/ui/FormRow';
import SearchSelect from '@/components/ui/SearchSelect';
import NumberInput from '@/components/ui/NumberInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

const EMPTY_FORM: Record<string, string> = { name: '', category_id: '', unit_id: '', low_stock_alert: '', description: '' };

const feedItemsApi = createCrudService<FeedItem>('/farm/feed/items');
const feedItemsKeys = createResourceKeys('feed-items');
const FORM_ID = 'feed-item-form';

export default function FeedItemsPage() {
  const { t } = useTranslation();
  const { t: tc } = useTranslation('common');
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FeedItem | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<FeedItem | null>(null);
  const [opened, setOpened] = useState('');
  const dirty = showModal && JSON.stringify(form) !== opened;
  useScrollToError(errors, formError);
  const setField = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(p => ({ ...p, [key]: '' }));
  };

  const resource = useCrudResource<FeedItem, PaginatedResponse<FeedItem>>(feedItemsApi, feedItemsKeys, {
    extraInvalidateKeys: [...FEED_STOCK_KEYS, ['feed-items-trash']],
  });
  const { data, isLoading } = resource.useList({ ...sorting.params, page, per_page: 20, ...(filterCategory ? { category_id: filterCategory } : {}) });
  const createMutation = resource.useCreate();
  const updateMutation = resource.useUpdate();

  const { data: catsData } = useQuery<{ categories: FeedCategory[] }>({
    queryKey: ['feed-categories-all'],
    queryFn: async () => (await api.get('/farm/feed/categories/all')).data,
  });

  const { data: unitsData } = useQuery<{ units: Unit[] }>({
    queryKey: ['units'],
    queryFn: async () => (await api.get('/farm/units')).data,
  });

  const deleteMutation = resource.useRemove({
    onSuccess: (res) => {
      setDeleteTarget(null);
      toast.success(res.message ?? trashedMsg());
    },
    onError: (err) => {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? t('common:error.failed_delete'));
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setOpened(JSON.stringify({ ...EMPTY_FORM }));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (item: FeedItem) => {
    setEditing(item);
    const f = {
      name: item.name ?? '',
      category_id: String(item.category_id),
      unit_id: String(item.unit_id),
      low_stock_alert: item.low_stock_alert,
      description: item.description ?? '',
    };
    setForm(f);
    setOpened(JSON.stringify(f));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = tc('form.v.required');
    if (!form.category_id) e.category_id = tc('form.v.required');
    if (!form.unit_id) e.unit_id = tc('form.v.required');
    if (!form.low_stock_alert && form.low_stock_alert !== '0') e.low_stock_alert = tc('form.v.required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    setErrors({});
    try {
      const res = editing
        ? await updateMutation.mutateAsync({ id: editing.id, payload: form })
        : await createMutation.mutateAsync(form);
      toast.success(res.message ?? savedMsg());
      closeModal();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, t('common:error.failed_save'));
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
      toast.error(Object.values(fields)[0] ?? message);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const items = data?.data ?? [];
  const categories = catsData?.categories ?? [];
  const units = unitsData?.units ?? [];
  const selectedUnit = units.find(u => String(u.id) === form.unit_id);

  const cols: ColDef<FeedItem>[] = [
    {
      key: 'name', labelKey: 'feed:items.col.item', align: 'left', sortKey: 'name', sortType: 'text',
      render: item => <span className="font-medium text-slate-700">{item.name}</span>,
    },
    {
      key: 'category', labelKey: 'feed:items.col.category', align: 'left',
      render: item => item.category
        ? <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{item.category.name}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      key: 'unit', labelKey: 'feed:items.col.unit', align: 'left',
      render: item => <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{item.unit?.symbol}</span>,
    },
    {
      key: 'low_stock_alert', labelKey: 'feed:items.col.low_alert', align: 'right', sortKey: 'low_alert', sortType: 'number',
      render: item => <span className="text-slate-500">{fmtNum(item.low_stock_alert)} {item.unit?.symbol}</span>,
    },
    {
      key: 'description', labelKey: 'common:field.description', align: 'left',
      render: item => <span className="text-slate-400 text-xs max-w-xs truncate block">{item.description || '—'}</span>,
    },
    {
      key: '_actions', labelKey: 'common:actions', align: 'right',
      render: item => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(item)} aria-label={tc('btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400">
            <Pencil size={14} />
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setDeleteTarget(item)}
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
        <PageTitle title={t('feed:items.title')} subtitle={t('feed:items.subtitle')} />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <TrashLink href="/farm/feed/items/trash" />
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center"
          >
            <Plus size={16} /> {t('feed:items.add')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600 font-medium">{t('feed:items.filter_category')}:</label>
        <select
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('common:filter.all_categories')}</option>
          {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={20}
        data={items}
        isLoading={isLoading}
        keyExtractor={item => item.id}
        emptyKey="feed:items.empty"
        currentPage={page}
        lastPage={data?.last_page}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('btn.move_to_trash')}
        message={t('feed:items.confirm.move_trash_message')}
        confirmLabel={tc('btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="lg"
        title={editing ? t('feed:items.edit_title') : t('feed:items.create_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{tc('btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            {editing ? tc('btn.update') : tc('btn.create')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, Object.keys(EMPTY_FORM))} />
          <Field name="name" label={t('feed:items.field.name')} required error={errors.name}>
            <input
              id={fieldId('name')}
              className={fieldClass(errors.name)}
              value={form.name}
              data-autofocus
              onChange={e => setField('name', e.target.value)}
            />
          </Field>
          <FormRow>
            <Field name="category_id" label={t('feed:items.field.category')} required error={errors.category_id}>
              <SearchSelect
                id={fieldId('category_id')}
                value={form.category_id}
                onChange={v => setField('category_id', v)}
                options={categories.map(c => ({ value: String(c.id), label: c.name }))}
                label={t('feed:items.field.category')}
                error={errors.category_id}
              />
            </Field>
            <Field name="unit_id" label={t('feed:items.field.unit')} required error={errors.unit_id}>
              <SearchSelect
                id={fieldId('unit_id')}
                value={form.unit_id}
                onChange={v => setField('unit_id', v)}
                options={units.map(u => ({ value: String(u.id), label: `${u.name} (${u.symbol})`, keywords: u.symbol }))}
                label={t('feed:items.field.unit')}
                error={errors.unit_id}
              />
            </Field>
          </FormRow>
          <Field name="low_stock_alert" label={t('feed:items.field.low_stock_alert')} required error={errors.low_stock_alert}>
            <NumberInput
              id={fieldId('low_stock_alert')}
              value={form.low_stock_alert}
              onChange={v => setField('low_stock_alert', v)}
              suffix={selectedUnit?.symbol}
              error={errors.low_stock_alert}
            />
          </Field>
          <Field name="description" label={tc('field.description')} error={errors.description}>
            <textarea
              id={fieldId('description')}
              className={fieldClass(errors.description)}
              rows={2}
              value={form.description}
              onChange={e => setField('description', e.target.value)}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
