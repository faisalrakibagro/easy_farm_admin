'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { invalidateKeys } from '@/lib/invalidateGroups';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { AnimalAgeStage } from '@/types';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

interface AnimalType { id: number; name: string }
interface AgeCategory { id: number; animal_type_id: number; name: string; sort_order: number; is_active: boolean }

const EMPTY_CAT   = { animal_type_id: '', name: '', sort_order: '', is_active: true };
const EMPTY_STAGE = { animal_type_id: '', name: '', sort_order: '', is_active: true };

export default function AgeCategoriesPage() {
  const { t } = useTranslation(['cattle', 'common']);
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const qc    = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab]       = useState<'categories' | 'stages'>('categories');
  const [expandedTypes, setExpandedTypes] = useState<Set<number>>(new Set());

  // Category modal state
  const [catModal, setCatModal]     = useState(false);
  const [editingCat, setEditingCat] = useState<AgeCategory | null>(null);
  const [catForm, setCatForm]       = useState({ ...EMPTY_CAT });
  const [catErrors, setCatErrors]   = useState<Record<string, string>>({});

  // Stage modal state
  const [stageModal, setStageModal]     = useState(false);
  const [editingStage, setEditingStage] = useState<AnimalAgeStage | null>(null);
  const [stageForm, setStageForm]       = useState({ ...EMPTY_STAGE });
  const [stageErrors, setStageErrors]   = useState<Record<string, string>>({});

  const [delTarget, setDelTarget] = useState<{ kind: 'cat' | 'stage'; id: number } | null>(null);

  const { data: animalTypesRaw } = useQuery<AnimalType[]>({
    queryKey: ['animal-types-all'],
    queryFn: () => api.get('/farm/animal-types/all').then(r => r.data),
  });
  const animalTypes = animalTypesRaw ?? [];

  const { data: catsData, isLoading: catsLoading } = useQuery<{ categories: AgeCategory[] }>({
    queryKey: ['animal-age-categories'],
    queryFn: () => api.get('/farm/animal-age-categories').then(r => r.data),
  });
  const categories = catsData?.categories ?? [];

  const { data: stagesData, isLoading: stagesLoading } = useQuery<{ stages: AnimalAgeStage[] }>({
    queryKey: ['animal-age-stages'],
    queryFn: () => api.get('/farm/animal-age-stages').then(r => r.data),
  });
  const stages = stagesData?.stages ?? [];

  const toggleType = (key: number) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Category mutations ──────────────────────────────────────────────────────
  const catMutation = useMutation({
    mutationFn: (d: object) => editingCat
      ? api.put(`/farm/animal-age-categories/${editingCat.id}`, d)
      : api.post('/farm/animal-age-categories', d),
    onSuccess: (res) => {
      invalidateKeys(qc, [['animal-age-categories'], ['animal-age-categories-all'], ['age-categories-by-type'], ['age-categories-modal'], ['age-categories-filter'], ['age-categories-formulation-modal']]);
      setCatModal(false);
      toast.success(res.data?.message ?? t('cattle:age_cat.toast.saved'));
    },
    onError: (e: { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }) => {
      const errs = e?.response?.data?.errors ?? {};
      const mapped: Record<string, string> = {};
      for (const k in errs) mapped[k] = errs[k][0];
      setCatErrors(mapped);
      if (!Object.keys(mapped).length) toast.error(e?.response?.data?.message ?? t('cattle:age_cat.toast.save_failed'));
    },
  });

  const delCatMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/animal-age-categories/${id}`),
    onSuccess: (res) => { invalidateKeys(qc, [['animal-age-categories'], ['animal-age-categories-all'], ['age-categories-by-type'], ['age-categories-modal'], ['age-categories-filter'], ['age-categories-formulation-modal']]); toast.success(res.data?.message ?? t('cattle:age_cat.toast.deleted')); },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? t('common:error.failed_delete')),
  });

  const openCatCreate = (typeId?: number) => {
    setEditingCat(null);
    setCatForm({ ...EMPTY_CAT, animal_type_id: typeId ? String(typeId) : '' });
    setCatErrors({});
    setCatModal(true);
  };
  const openCatEdit = (cat: AgeCategory) => {
    setEditingCat(cat);
    setCatForm({ animal_type_id: String(cat.animal_type_id), name: cat.name, sort_order: String(cat.sort_order), is_active: cat.is_active });
    setCatErrors({});
    setCatModal(true);
  };
  const submitCat = () => catMutation.mutate({
    animal_type_id: Number(catForm.animal_type_id),
    name: catForm.name,
    sort_order: catForm.sort_order ? Number(catForm.sort_order) : undefined,
    is_active: catForm.is_active,
  });

  // ── Stage mutations ─────────────────────────────────────────────────────────
  const stageMutation = useMutation({
    mutationFn: (d: object) => editingStage
      ? api.put(`/farm/animal-age-stages/${editingStage.id}`, d)
      : api.post('/farm/animal-age-stages', d),
    onSuccess: (res) => {
      invalidateKeys(qc, [['animal-age-stages'], ['age-stages-by-type']]);
      setStageModal(false);
      toast.success(res.data?.message ?? t('cattle:age_cat.toast.saved'));
    },
    onError: (e: { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }) => {
      const errs = e?.response?.data?.errors ?? {};
      const mapped: Record<string, string> = {};
      for (const k in errs) mapped[k] = errs[k][0];
      setStageErrors(mapped);
      if (!Object.keys(mapped).length) toast.error(e?.response?.data?.message ?? t('cattle:age_cat.toast.save_failed'));
    },
  });

  const delStageMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/animal-age-stages/${id}`),
    onSuccess: (res) => { invalidateKeys(qc, [['animal-age-stages'], ['age-stages-by-type']]); toast.success(res.data?.message ?? t('cattle:age_cat.toast.deleted')); },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? t('common:error.failed_delete')),
  });

  const openStageCreate = (typeId?: number) => {
    setEditingStage(null);
    setStageForm({ ...EMPTY_STAGE, animal_type_id: typeId ? String(typeId) : '' });
    setStageErrors({});
    setStageModal(true);
  };
  const openStageEdit = (stage: AnimalAgeStage) => {
    setEditingStage(stage);
    setStageForm({ animal_type_id: String(stage.animal_type_id), name: stage.name, sort_order: String(stage.sort_order), is_active: stage.is_active });
    setStageErrors({});
    setStageModal(true);
  };
  const submitStage = () => stageMutation.mutate({
    animal_type_id: Number(stageForm.animal_type_id),
    name: stageForm.name,
    sort_order: stageForm.sort_order ? Number(stageForm.sort_order) : undefined,
    is_active: stageForm.is_active,
  });

  // ── Reusable list section ───────────────────────────────────────────────────
  const renderList = (
    items: (AgeCategory | AnimalAgeStage)[],
    typeId: number,
    keyOffset: number,
    onEdit: (item: AgeCategory | AnimalAgeStage) => void,
    onDelete: (id: number) => void,
    accentColor: string,
  ) => {
    const typeItems = items.filter(i => i.animal_type_id === typeId);
    const key = typeId + keyOffset;
    const expanded = expandedTypes.has(key);
    const type = animalTypes.find(at => at.id === typeId);
    if (!type) return null;

    return (
      <div key={key} className="border rounded-lg bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => toggleType(key)}>
          <div className="flex items-center gap-2 font-medium text-gray-800">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {type.name}
            <span className={`text-xs px-2 py-0.5 rounded-full ${accentColor}`}>{t('cattle:age_cat.count_suffix', { count: typeItems.length })}</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); keyOffset === 0 ? openCatCreate(typeId) : openStageCreate(typeId); }}
            className={`shrink-0 flex items-center gap-1 text-xs border px-3 py-2 sm:px-2 sm:py-1 rounded ${accentColor} hover:opacity-80`}
          >
            <Plus className="w-3 h-3" /> {t('common:btn.add')}
          </button>
        </div>

        {expanded && (
          <div className="border-t divide-y">
            {typeItems.length === 0 ? (
              <div className="px-6 py-4 text-sm text-gray-400">{t('table.no_data')}</div>
            ) : typeItems.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 ps-4 pe-2 sm:px-6 py-2">
                <div className="flex flex-wrap items-center gap-x-2 min-w-0">
                  <span className="font-medium text-gray-800 break-words min-w-0">{item.name}</span>
                  {!item.is_active && <span className="text-xs text-red-400">{t('status.inactive')}</span>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => onEdit(item)} aria-label={t('common:btn.edit')} className="p-2 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                  {isSuperAdmin && <button onClick={() => onDelete(item.id)} aria-label={t('common:btn.delete')} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">{t('cattle:age_cat.title')}</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['categories', 'stages'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab ? 'bg-white border border-b-white -mb-px text-green-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab === 'categories' ? t('cattle:age_cat.tab_categories') : t('cattle:age_cat.tab_stages')}
          </button>
        ))}
      </div>

      {activeTab === 'categories' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => openCatCreate()} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
              <Plus className="w-4 h-4" /> {t('cattle:age_cat.btn_new_category')}
            </button>
          </div>
          {catsLoading ? <div className="text-center py-10 text-gray-400">{t('status.loading')}</div> : (
            <div className="space-y-2">
              {animalTypes.map(at => renderList(categories, at.id, 0, openCatEdit as (i: AgeCategory | AnimalAgeStage) => void, id => setDelTarget({ kind: 'cat', id }), 'bg-green-100 text-green-700'))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'stages' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => openStageCreate()} className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700">
              <Plus className="w-4 h-4" /> {t('cattle:age_cat.btn_new_stage')}
            </button>
          </div>
          {stagesLoading ? <div className="text-center py-10 text-gray-400">{t('status.loading')}</div> : (
            <div className="space-y-2">
              {animalTypes.map(at => renderList(stages, at.id, 1000, openStageEdit as (i: AgeCategory | AnimalAgeStage) => void, id => setDelTarget({ kind: 'stage', id }), 'bg-amber-100 text-amber-700'))}
            </div>
          )}
        </div>
      )}

      {catModal && (
        <AgeItemModal
          title={editingCat ? t('cattle:age_cat.cat_modal_edit') : t('cattle:age_cat.cat_modal_create')}
          form={catForm} setForm={setCatForm} errors={catErrors} setErrors={setCatErrors}
          locked={!!editingCat} animalTypes={animalTypes} placeholder={t('cattle:age_cat.placeholder_category')}
          saving={catMutation.isPending} onSubmit={submitCat} onClose={() => setCatModal(false)} />
      )}

      {stageModal && (
        <AgeItemModal
          title={editingStage ? t('cattle:age_cat.stage_modal_edit') : t('cattle:age_cat.stage_modal_create')}
          form={stageForm} setForm={setStageForm} errors={stageErrors} setErrors={setStageErrors}
          locked={!!editingStage} animalTypes={animalTypes} placeholder={t('cattle:age_cat.placeholder_stage')}
          saving={stageMutation.isPending} onSubmit={submitStage} onClose={() => setStageModal(false)} />
      )}

      <ConfirmDialog
        open={!!delTarget}
        title={t('common:btn.delete')}
        message={t('common:confirm.delete')}
        confirmLabel={t('common:btn.delete')}
        cancelLabel={t('common:btn.cancel')}
        loading={delCatMutation.isPending || delStageMutation.isPending}
        onConfirm={() => {
          if (!delTarget) return;
          const done = { onSettled: () => setDelTarget(null) };
          if (delTarget.kind === 'cat') delCatMutation.mutate(delTarget.id, done);
          else delStageMutation.mutate(delTarget.id, done);
        }}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}

type AgeForm = typeof EMPTY_CAT;
const FORM_ID = 'age-item-form';

/** The category / stage form: both have the same fields. */
function AgeItemModal({ title, form, setForm, errors, setErrors, locked, animalTypes, placeholder, saving, onSubmit, onClose }: {
  title: string;
  form: AgeForm;
  setForm: Dispatch<SetStateAction<AgeForm>>;
  errors: Record<string, string>;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
  locked: boolean;
  animalTypes: AnimalType[];
  placeholder: string;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['cattle', 'common']);
  const [opened] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== opened;
  useScrollToError(errors);

  const set = <K extends keyof AgeForm>(key: K, value: AgeForm[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.animal_type_id) errs.animal_type_id = t('common:form.v.required');
    if (!form.name.trim()) errs.name = t('common:form.v.required');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit();
  };

  return (
    <Modal onClose={onClose} dirty={dirty} size="sm" title={title}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={saving} className={btnPrimary}>
          {saving ? t('common:status.loading') : t('common:btn.save')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert extra={otherErrors(errors, ['animal_type_id', 'name', 'sort_order', 'is_active'])} />
        <Field name="animal_type_id" label={t('cattle:age_cat.field_animal_type')} required error={errors.animal_type_id}>
          <SearchSelect
            id={fieldId('animal_type_id')}
            value={form.animal_type_id}
            onChange={v => set('animal_type_id', v)}
            options={animalTypes.map(at => ({ value: String(at.id), label: at.name }))}
            placeholder={t('cattle:age_cat.select_type')}
            label={t('cattle:age_cat.field_animal_type')}
            error={errors.animal_type_id}
            disabled={locked}
          />
        </Field>
        <Field name="name" label={t('common:field.name')} required error={errors.name}>
          <input id={fieldId('name')} value={form.name} onChange={e => set('name', e.target.value)} data-autofocus
            className={fieldClass(errors.name)} placeholder={placeholder} />
        </Field>
        <Field name="sort_order" label={t('cattle:age_cat.field_sort_order')} error={errors.sort_order}>
          <NumberInput id={fieldId('sort_order')} value={form.sort_order} onChange={v => set('sort_order', v)}
            allowDecimal={false} placeholder="1" error={errors.sort_order} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
            className="w-4 h-4 rounded border-slate-300" />
          {t('cattle:age_cat.field_active')}
        </label>
      </form>
    </Modal>
  );
}
