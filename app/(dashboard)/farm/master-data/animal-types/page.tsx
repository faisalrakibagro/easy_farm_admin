'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { AnimalType, PaginatedResponse } from '@/types';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import PageTitle from '@/components/ui/PageTitle';
import {
  Plus, Pencil, Trash2, RotateCcw, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight, Search, Beef, Bird, Fish, Rabbit, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import NumberInput from '@/components/ui/NumberInput';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import FormRow from '@/components/ui/FormRow';
import FormSection from '@/components/ui/FormSection';
import BreedingPresetPicker from '@/components/farm/BreedingPresetPicker';
import MilkingSessionsPicker, { orderSessions, sessionsForTimes } from '@/components/dairy/MilkingSessionsPicker';
import type { MilkSession } from '@/types';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

const ANIMAL_ICON_MAP: Array<[string, LucideIcon]> = [
  ['cattle', Beef], ['cow', Beef], ['beef', Beef], ['bull', Beef],
  ['goat', Beef], ['sheep', Beef], ['lamb', Beef],
  ['chicken', Bird], ['poultry', Bird], ['duck', Bird], ['bird', Bird], ['hen', Bird], ['turkey', Bird],
  ['fish', Fish], ['aqua', Fish],
  ['rabbit', Rabbit],
];

function resolveAnimalIcon(nameOrSlug: string): LucideIcon {
  const key = nameOrSlug.toLowerCase();
  for (const [k, icon] of ANIMAL_ICON_MAP) {
    if (key.includes(k)) return icon;
  }
  return Beef;
}

const EMPTY_SHARED: Record<string, string | boolean> = { slug: '', sort_order: '0', is_active: true };

// Breeding settings per species (see the breeding & dairy plan, 2.1).
interface BreedingSettings {
  gestation_days: string; heat_cycle_days: string; pregnancy_check_days: string; dry_period_days: string;
  is_milking: boolean; milking_sessions: MilkSession[];
  // Internal value of a calf born on the farm (plan phase 4, 5.1)
  calf_value_male: string; calf_value_female: string;
}

const EMPTY_BREEDING: BreedingSettings = {
  gestation_days: '', heat_cycle_days: '', pregnancy_check_days: '', dry_period_days: '',
  is_milking: false, milking_sessions: ['morning', 'evening'],
  calf_value_male: '', calf_value_female: '',
};

const BREEDING_NUMBER_FIELDS: (keyof BreedingSettings)[] = ['gestation_days', 'heat_cycle_days', 'pregnancy_check_days', 'dry_period_days'];
const CALF_VALUE_FIELDS = ['calf_value_female', 'calf_value_male'] as const;

const animalTypesApi = createCrudService<AnimalType>('/farm/animal-types');
const animalTypesKeys = createResourceKeys('animal-types');
const FORM_ID = 'animal-type-form';
const KNOWN_FIELDS = ['name', 'description', 'slug', 'sort_order', 'is_active', 'is_milking', 'default_milking_times', 'milking_sessions', ...BREEDING_NUMBER_FIELDS, ...CALF_VALUE_FIELDS];

export default function AnimalTypesPage() {
  const { t } = useTranslation(['common', 'dairy']);
  const { t: tc } = useTranslation('common');
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [search, setSearch] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnimalType | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [shared, setShared] = useState<Record<string, string | boolean>>({ ...EMPTY_SHARED });
  const [breeding, setBreeding] = useState<BreedingSettings>({ ...EMPTY_BREEDING });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnimalType | null>(null);
  const [forceDeleteTarget, setForceDeleteTarget] = useState<AnimalType | null>(null);
  const [opened, setOpened] = useState('');
  const snapshot = (f: typeof form, sh: typeof shared, br: BreedingSettings) => JSON.stringify([f, sh, br]);
  const dirty = showModal && snapshot(form, shared, breeding) !== opened;
  const clearError = (k: string) => setErrors(p => ({ ...p, [k]: '' }));
  useScrollToError(errors, formError);

  const invalidateAll = () => qc.invalidateQueries({ queryKey: ['animal-types-all'] });

  const resource = useCrudResource<AnimalType, PaginatedResponse<AnimalType>>(animalTypesApi, animalTypesKeys, {
    // Delete / restore / purge change the dropdowns too, not just create/edit.
    extraInvalidateKeys: [['animal-types-all']],
  });
  const { data, isLoading } = resource.useList({ ...sorting.params, page, search: search || undefined, trashed: showTrash || undefined, per_page: 15 });

  const createMutation = resource.useCreate({ onSuccess: invalidateAll });
  const updateMutation = resource.useUpdate({ onSuccess: invalidateAll });

  const deleteMutation = resource.useRemove({
    onSuccess: (res) => {
      setDeleteTarget(null);
      toast.success(res.message ?? t('settings:master_data.animal_types.toast.moved_to_trash'));
    },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('settings:master_data.animal_types.toast.delete_failed'));
    },
  });

  const restoreMutation = resource.useRestore({
    onSuccess: (res) => {
      toast.success(res.message ?? t('settings:master_data.animal_types.toast.restored'));
    },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('settings:master_data.animal_types.toast.restore_failed'));
    },
  });

  const forceDeleteMutation = resource.useForceDelete({
    onSuccess: (res) => {
      setForceDeleteTarget(null);
      toast.success(res.message ?? t('settings:master_data.animal_types.toast.force_deleted'));
    },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('settings:master_data.animal_types.toast.force_delete_failed'));
    },
  });

  const toggleMutation = resource.useToggleStatus({
    onSuccess: () => {
      invalidateAll();
      toast.success(t('settings:master_data.animal_types.toast.status_updated'));
    },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('settings:master_data.animal_types.toast.status_update_failed'));
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
    setShared({ ...EMPTY_SHARED });
    setBreeding({ ...EMPTY_BREEDING });
    setOpened(snapshot({ name: '', description: '' }, { ...EMPTY_SHARED }, { ...EMPTY_BREEDING }));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (type: AnimalType) => {
    setEditing(type);
    const f = { name: type.name ?? '', description: type.description ?? '' };
    const sh = { slug: type.slug, sort_order: String(type.sort_order), is_active: type.is_active };
    const br: BreedingSettings = {
      gestation_days:        type.gestation_days?.toString() ?? '',
      heat_cycle_days:       type.heat_cycle_days?.toString() ?? '',
      pregnancy_check_days:  type.pregnancy_check_days?.toString() ?? '',
      dry_period_days:       type.dry_period_days?.toString() ?? '',
      is_milking:            !!type.is_milking,
      milking_sessions:      type.milking_sessions?.length ? orderSessions(type.milking_sessions) : sessionsForTimes(type.default_milking_times),
      calf_value_male:       type.calf_value_male != null ? String(parseFloat(String(type.calf_value_male))) : '',
      calf_value_female:     type.calf_value_female != null ? String(parseFloat(String(type.calf_value_female))) : '',
    };
    setForm(f);
    setShared(sh);
    setBreeding(br);
    setOpened(snapshot(f, sh, br));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t('settings:master_data.animal_types.error.name_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    setErrors({});
    setIsSaving(true);
    const sharedData = { ...shared, slug: shared.slug || undefined };
    const breedingData = {
      ...breeding,
      ...Object.fromEntries([...BREEDING_NUMBER_FIELDS, ...CALF_VALUE_FIELDS].map(k => [k, breeding[k] === '' ? null : Number(breeding[k])])),
    };
    try {
      if (editing) {
        const res = await updateMutation.mutateAsync({ id: editing.id, payload: { ...form, ...sharedData, ...breedingData } });
        toast.success(res.message ?? t('settings:master_data.animal_types.toast.updated'));
      } else {
        const res = await createMutation.mutateAsync({ ...form, ...sharedData, ...breedingData });
        toast.success(res.message ?? t('settings:master_data.animal_types.toast.created'));
      }
      closeModal();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, t('common:error.failed_save'));
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
      toast.error(Object.values(fields)[0] ?? message);
    } finally {
      setIsSaving(false);
    }
  };

  const types = data?.data ?? [];
  const meta = data;

  const cols: ColDef<AnimalType>[] = [
    {
      key: 'name', labelKey: 'settings:master_data.animal_types.col.name_slug', align: 'left', sortKey: 'name', sortType: 'text',
      render: type => {
        const Icon = resolveAnimalIcon(type.slug || type.name);
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Icon size={16} className="text-blue-500" />
            </div>
            <div>
              <p className="font-medium text-slate-700">{type.name}</p>
              <p className="text-xs text-slate-400 font-mono">{type.slug}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'description', labelKey: 'settings:master_data.animal_types.col.description', align: 'left',
      render: type => (
        <span className="text-slate-500 max-w-xs truncate block">
          {type.description || <span className="text-slate-300 italic">—</span>}
        </span>
      ),
    },
    {
      key: 'gestation_days', labelKey: 'settings:master_data.animal_types.col.breeding', align: 'left',
      render: type => (
        <div className="text-xs text-slate-500 space-y-0.5">
          {type.gestation_days
            ? <p>{t('settings:master_data.animal_types.breeding.gestation_short', { days: type.gestation_days })}</p>
            : <p className="text-amber-600">{t('settings:master_data.animal_types.breeding.not_configured')}</p>}
          {type.is_milking && (
            <span className="inline-block bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded-full font-medium">
              {t('settings:master_data.animal_types.breeding.milking_badge', {
                sessions: (type.milking_sessions?.length ? orderSessions(type.milking_sessions) : sessionsForTimes(type.default_milking_times))
                  .map(s => t('dairy:session.' + s)).join(', '),
              })}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'sort_order', labelKey: 'settings:master_data.animal_types.col.order', align: 'center',
      render: type => (
        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{type.sort_order}</span>
      ),
    },
    {
      key: 'is_active', labelKey: 'settings:master_data.animal_types.col.status', align: 'center',
      render: type => showTrash ? (
        <span className="text-xs text-red-500 font-medium flex items-center justify-center gap-1">
          <AlertTriangle size={12} /> {t('common:btn.trash')}
        </span>
      ) : (
        <button
          onClick={() => toggleMutation.mutate(type.id)}
          className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
            type.is_active ? 'text-green-600 hover:text-green-700' : 'text-slate-400 hover:text-slate-500'
          }`}
        >
          {type.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {type.is_active ? t('common:status.active') : t('common:status.inactive')}
        </button>
      ),
    },
    {
      key: '_actions', labelKey: 'common:actions', align: 'right',
      render: type => (
        <div className="flex justify-end gap-1">
          {showTrash ? (
            <>
              <button onClick={() => restoreMutation.mutate(type.id)} title={t('common:btn.restore')}
                className="p-1.5 rounded-lg hover:bg-green-50 text-green-500"><RotateCcw size={14} /></button>
              {isSuperAdmin && (
                <button
                  onClick={() => setForceDeleteTarget(type)}
                  aria-label={tc('confirm.force_delete_label')}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => openEdit(type)} aria-label={tc('btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={14} /></button>
              {isSuperAdmin && (
                <button
                  onClick={() => setDeleteTarget(type)}
                  aria-label={tc('btn.move_to_trash')}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <PageTitle title={t('settings:master_data.animal_types.title')} subtitle={t('settings:master_data.animal_types.subtitle')} />
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => { setShowTrash(!showTrash); setPage(1); }}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
              showTrash ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Trash2 size={14} /> {showTrash ? t('common:status.active') : t('common:btn.trash')}
          </button>
          {!showTrash && (
            <button onClick={openCreate} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
              <Plus size={16} /> {t('settings:master_data.animal_types.add')}
            </button>
          )}
        </div>
      </div>

      <div className="relative w-full max-w-sm">
        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('settings:master_data.animal_types.search_placeholder')}
          className="w-full ps-9 pe-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        currentPage={page}
        data={types}
        isLoading={isLoading}
        keyExtractor={type => type.id}
        emptyKey={showTrash ? 'settings:master_data.animal_types.empty_trash' : 'settings:master_data.animal_types.empty'}
      />

      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200">
          <p className="text-xs text-slate-400">
            {t('common:pagination.page_of', { current: meta.current_page, total: meta.last_page })} &bull; {t('common:pagination.total_count', { count: meta.total })}
          </p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={meta.current_page === 1} className="p-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <button onClick={() => setPage(p => Math.min(meta.last_page, p + 1))} disabled={meta.current_page === meta.last_page} className="p-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('btn.move_to_trash')}
        message={t('settings:master_data.animal_types.confirm.move_trash_message', { name: deleteTarget?.name ?? '' })}
        confirmLabel={tc('btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!forceDeleteTarget}
        title={tc('confirm.force_delete_title')}
        message={t('settings:master_data.animal_types.confirm.force_delete')}
        confirmLabel={tc('confirm.force_delete_label')}
        loading={forceDeleteMutation.isPending}
        onConfirm={() => forceDeleteTarget && forceDeleteMutation.mutate(forceDeleteTarget.id)}
        onCancel={() => setForceDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={dirty} size="md"
        title={editing ? t('settings:master_data.animal_types.modal.edit_title') : t('settings:master_data.animal_types.modal.create_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{tc('btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            {editing ? tc('btn.update') : tc('btn.create')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, KNOWN_FIELDS)} />
          <Field name="name" label={t('settings:master_data.animal_types.field.name')} required error={errors.name}>
            <input
              id={fieldId('name')}
              className={fieldClass(errors.name)}
              value={form.name}
              data-autofocus
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); clearError('name'); }}
            />
          </Field>
          <Field name="description" label={t('settings:master_data.animal_types.field.description')} error={errors.description}>
            <textarea
              id={fieldId('description')}
              className={fieldClass(errors.description)}
              rows={3}
              value={form.description}
              onChange={e => { setForm(p => ({ ...p, description: e.target.value })); clearError('description'); }}
            />
          </Field>
          <FormRow>
            <Field name="slug" label={t('settings:master_data.animal_types.field.slug')} error={errors.slug}
              hint={t('settings:master_data.animal_types.field.slug_hint')}>
              <input id={fieldId('slug')} className={fieldClass(errors.slug)} value={shared.slug as string}
                onChange={e => { setShared(f => ({ ...f, slug: e.target.value })); clearError('slug'); }} />
            </Field>
            <Field name="sort_order" label={t('settings:master_data.animal_types.field.sort_order')} error={errors.sort_order}>
              <NumberInput id={fieldId('sort_order')} value={shared.sort_order as string} allowDecimal={false} error={errors.sort_order}
                onChange={v => { setShared(f => ({ ...f, sort_order: v })); clearError('sort_order'); }} />
            </Field>
          </FormRow>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!shared.is_active}
              onChange={e => setShared(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded accent-blue-500" />
            {t('settings:master_data.animal_types.field.is_active')}
          </label>

          {/* Breeding settings */}
          <FormSection title={t('settings:master_data.animal_types.breeding.title')} className="pt-2">
            <p className="text-xs text-slate-500">{t('settings:master_data.animal_types.breeding.hint')}</p>
            <BreedingPresetPicker values={breeding} onApply={v => setBreeding(b => ({ ...b, ...v }))} />
            <FormRow>
              {BREEDING_NUMBER_FIELDS.map(k => (
                <Field key={k} name={k} label={t('settings:master_data.animal_types.breeding.field.' + k)} error={errors[k]}>
                  <NumberInput id={fieldId(k)} value={breeding[k] as string} allowDecimal={false} error={errors[k]}
                    onChange={v => { setBreeding(b => ({ ...b, [k]: v })); clearError(k); }} />
                </Field>
              ))}
            </FormRow>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={breeding.is_milking}
                onChange={e => setBreeding(b => ({ ...b, is_milking: e.target.checked }))}
                className="w-4 h-4 rounded accent-blue-500" />
              {t('settings:master_data.animal_types.breeding.field.is_milking')}
            </label>
            {breeding.is_milking && (
              <Field name="milking_sessions" label={t('settings:master_data.animal_types.breeding.field.milking_sessions')}
                hint={t('settings:master_data.animal_types.breeding.milking_sessions_hint')} error={errors.milking_sessions}>
                <MilkingSessionsPicker id={fieldId('milking_sessions')} value={breeding.milking_sessions} error={errors.milking_sessions}
                  onChange={v => { setBreeding(b => ({ ...b, milking_sessions: v })); clearError('milking_sessions'); }} />
              </Field>
            )}
            <div>
              <p className="text-xs font-medium text-slate-600">{t('settings:master_data.animal_types.breeding.field.calf_value')}</p>
              <p className="text-xs text-slate-500 mb-2">{t('settings:master_data.animal_types.breeding.calf_value_hint')}</p>
              <FormRow>
                {CALF_VALUE_FIELDS.map(k => (
                  <Field key={k} name={k} label={t('settings:master_data.animal_types.breeding.field.' + k)} error={errors[k]}>
                    <NumberInput id={fieldId(k)} value={breeding[k]} prefix="৳" allowDecimal={false} error={errors[k]}
                      onChange={v => { setBreeding(b => ({ ...b, [k]: v })); clearError(k); }} />
                  </Field>
                ))}
              </FormRow>
            </div>
          </FormSection>
        </form>
      </Modal>
    </div>
  );
}
