'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { animalTypeName } from '@/lib/animalType';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { CATTLE_COST_KEYS, MEDICINE_STOCK_KEYS, invalidateMoney, invalidateKeys } from '@/lib/invalidateGroups';
import { AnimalType, Cattle, Shed, PaginatedResponse, AnimalAgeStage, AnimalAgeCategory, AccountingPaymentAccount } from '@/types';
import type { CattlePurpose } from '@/types';
import { Plus, Search, Pencil, Trash2, X, Eye, ImageIcon, FileText, Syringe, FlaskConical, ShoppingCart, Activity, Milk, Receipt } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { fieldClass, btnSecondary } from '@/lib/formStyles';
import Link from '@/components/ui/AppLink';
import BulkMedicineModal from '@/components/cattle/BulkMedicineModal';
import BulkVaccineModal from '@/components/cattle/BulkVaccineModal';
import BulkTreatmentModal from '@/components/cattle/BulkTreatmentModal';
import BulkSaleModal from '@/components/cattle/BulkSaleModal';
import MilkEntryModal from '@/components/dairy/MilkEntryModal';
import BulkExpenseModal from '@/components/cattle/BulkExpenseModal';
import MilkSelectionWarning, { type MilkCheckRow } from '@/components/cattle/MilkSelectionWarning';
import CattlePickerModal from '@/components/cattle/CattlePickerModal';
import { useAutoOpen } from '@/lib/hooks/useAutoOpen';
import { printCattleSaleInvoice } from '@/lib/cattleReceipt';
import { newLine, DEFAULT_PER_CATTLE } from '@/components/cattle/types';
import type { LineItem, MedItem, PerCattleData, SaleInvoiceData } from '@/components/cattle/types';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import { apiFieldErrors } from '@/lib/hooks/useFormErrors';
import { localDateStr } from '@/lib/dates';
import CattleFormModal from '@/components/cattle/form/CattleFormModal';
import { DEFAULT_CATTLE_FORM as DEFAULT, PURCHASE_ONLY_FIELDS, type CattleFormData, type ParentOption } from '@/components/cattle/form/types';
import { fmtMoney } from '@/lib/format';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { SerialCell, SerialHeader, SortHeader, SortSelect, TablePagination } from '@/components/ui/TableControls';

const PURPOSE_COLORS: Record<CattlePurpose, string> = {
  fattening:       'bg-orange-50 text-orange-700',
  breeding_female: 'bg-pink-50 text-pink-700',
  breeding_male:   'bg-indigo-50 text-indigo-700',
  dairy:           'bg-sky-50 text-sky-700',
  young_stock:     'bg-lime-50 text-lime-700',
};

type PickAction = 'medicine' | 'vaccine' | 'treatment' | 'sell';
const PICK_ACTIONS: PickAction[] = ['medicine', 'vaccine', 'treatment', 'sell'];

const HEALTH_STATUS_COLORS: Record<string, string> = {
  healthy:    'bg-green-100 text-green-700',
  sick:       'bg-red-100 text-red-700',
  critical:   'bg-red-200 text-red-800',
  recovering: 'bg-yellow-100 text-yellow-700',
};

const STATUS_COLORS: Record<string, string> = {
  active:      'bg-green-100 text-green-700',
  sold:        'bg-blue-100 text-blue-700',
  dead:        'bg-red-100 text-red-700',
  transferred: 'bg-orange-100 text-orange-700',
};

function todayStr() {
  return localDateStr();
}

function toDateStr(val: string | null | undefined): string {
  if (!val) return '';
  return val.split('T')[0];
}

export default function CattlePage() {
  const { t } = useTranslation('cattle');
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const invoiceFileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [ageFilter, setAgeFilter] = useState('');
  const [shedFilter, setShedFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [showModal, setShowModal] = useState(false);
  const [editCattle, setEditCattle] = useState<Cattle | null>(null);
  const [form, setForm] = useState<CattleFormData>(DEFAULT);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Cattle | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [createDraft, setCreateDraft] = useState<Partial<CattleFormData> | null>(null);

  // ── Bulk selection ──────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Milk entry (animals in milk only) ───────────────────────
  const [showMilkEntry, setShowMilkEntry] = useState(false);
  // With animals picked: only those, after checking they all give milk.
  const [milkFor, setMilkFor] = useState<number[] | undefined>(undefined);
  const [milkCheckRows, setMilkCheckRows] = useState<MilkCheckRow[] | null>(null);
  const [milkChecking, setMilkChecking] = useState(false);

  // ── Expense charged to the picked animals ───────────────────
  const [showExpenseBulk, setShowExpenseBulk] = useState(false);

  // ── Bulk action started from outside the list (?new=medicine…) ──
  // The animals are picked first, then the usual bulk modal opens.
  const [pickFor, setPickFor] = useState<PickAction | null>(null);
  const [pickedCattle, setPickedCattle] = useState<Cattle[]>([]);

  // ── Bulk Medicine ───────────────────────────────────────────
  const [showMedBulk, setShowMedBulk]     = useState(false);
  const [medBulkSaving, setMedBulkSaving] = useState(false);
  const [medBulkError, setMedBulkError]   = useState('');
  const [medBulkErrors, setMedBulkErrors] = useState<Record<string, string>>({});
  const [medItems, setMedItems]           = useState<LineItem[]>(() => [newLine()]);
  const [medDate, setMedDate]             = useState(todayStr());
  const [medNotes, setMedNotes]           = useState('');

  // ── Bulk Sale ───────────────────────────────────────────────
  const [showSaleBulk, setShowSaleBulk]           = useState(false);
  const [saleBulkSaving, setSaleBulkSaving]       = useState(false);
  const [saleBulkError, setSaleBulkError]         = useState('');
  const [saleBulkErrors, setSaleBulkErrors]       = useState<Record<string, string>>({});
  const [saleDate, setSaleDate]                   = useState(todayStr());
  const [salePaymentAccountId, setSalePaymentAccountId] = useState('');
  const [saleNotes, setSaleNotes]                 = useState('');
  const [saleBuyerMode, setSaleBuyerMode]         = useState<'existing' | 'new'>('existing');
  const [saleCustomerId, setSaleCustomerId]       = useState('');
  const [saleNewName, setSaleNewName]             = useState('');
  const [saleNewPhone, setSaleNewPhone]           = useState('');
  const [saleNewAddress, setSaleNewAddress]       = useState('');
  const [salePaymentStatus, setSalePaymentStatus] = useState<'paid' | 'partial' | 'unpaid'>('paid');
  const [salePaidAmount, setSalePaidAmount]       = useState('');
  const [salePrices, setSalePrices]               = useState<Partial<Record<number, { price: string; weight: string }>>>({});
  const [invoiceData, setInvoiceData]             = useState<SaleInvoiceData | null>(null);

  // ── Bulk Vaccine ────────────────────────────────────────────
  const [showVaxBulk, setShowVaxBulk]     = useState(false);
  const [vaxBulkSaving, setVaxBulkSaving] = useState(false);
  const [vaxBulkError, setVaxBulkError]   = useState('');
  const [vaxBulkErrors, setVaxBulkErrors] = useState<Record<string, string>>({});
  const [vaxItems, setVaxItems]           = useState<LineItem[]>(() => [newLine()]);
  const [vaxDate, setVaxDate]             = useState(todayStr());
  const [vaxAdminBy, setVaxAdminBy]       = useState('');
  const [vaxNotes, setVaxNotes]           = useState('');

  // ── Bulk Treatment ──────────────────────────────────────────
  const [showTreatBulk, setShowTreatBulk]       = useState(false);
  const [treatBulkSaving, setTreatBulkSaving]   = useState(false);
  const [treatBulkError, setTreatBulkError]     = useState('');
  const [treatBulkErrors, setTreatBulkErrors]   = useState<Record<string, string>>({});
  const [treatDate, setTreatDate]               = useState(todayStr());
  const [treatMedUsed, setTreatMedUsed]         = useState('');
  const [treatVetFee, setTreatVetFee]           = useState('');
  const [treatPayAccId, setTreatPayAccId]       = useState('');
  const [treatDoctorName, setTreatDoctorName]   = useState('');
  const [treatDoctorPhone, setTreatDoctorPhone] = useState('');
  const [treatNotes, setTreatNotes]             = useState('');
  const [perCattle, setPerCattle]               = useState<Record<number, PerCattleData>>({});
  const [perCattleFiles, setPerCattleFiles]     = useState<Record<number, File | null>>({});
  const [perCattleErrors, setPerCattleErrors]   = useState<Record<number, string>>({});

  const updatePerCattle = (cattleId: number, field: keyof PerCattleData, value: string) => {
    setPerCattle(prev => ({ ...prev, [cattleId]: { ...(prev[cattleId] ?? DEFAULT_PER_CATTLE), [field]: value } }));
    setPerCattleErrors(prev => ({ ...prev, [cattleId]: '' }));
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery<PaginatedResponse<Cattle>>({
    queryKey: ['farm-cattle', page, debouncedSearch, statusFilter, ageFilter, shedFilter, originFilter, purposeFilter, sorting.params],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, search: debouncedSearch, per_page: 15, ...sorting.params };
      if (statusFilter) params.status = statusFilter;
      if (ageFilter) params.age_category_id = ageFilter;
      if (shedFilter) params.shed_id = shedFilter;
      if (originFilter) params.origin = originFilter;
      if (purposeFilter) params.purpose = purposeFilter;
      const res = await api.get('/farm/cattle', { params });
      return res.data;
    },
  });

  const { data: shedsData } = useQuery({
    queryKey: ['sheds-all'],
    queryFn: async () => (await api.get('/farm/sheds/all')).data.sheds as Shed[],
  });

  const { data: animalTypesData } = useQuery({
    queryKey: ['animal-types-all'],
    queryFn: async () => (await api.get('/farm/animal-types/all')).data as AnimalType[],
    enabled: showModal,
  });

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
    enabled: showModal || showTreatBulk || showSaleBulk,
  });

  const { data: allAgeCategoriesData } = useQuery({
    queryKey: ['animal-age-categories-all'],
    queryFn: async () => (await api.get('/farm/animal-age-categories')).data.categories as { id: number; name: string }[],
  });

  const { data: breedsData } = useQuery({
    queryKey: ['farm-breeds'],
    queryFn: async () => (await api.get('/farm/breeds')).data.breeds as { id: number; name: string }[],
    enabled: showModal,
  });

  const selectedAnimalTypeId = form.animal_type_id ? Number(form.animal_type_id) : null;
  const selectedAnimalType = animalTypesData?.find(at => at.id === selectedAnimalTypeId);
  const isPurchased = form.origin === 'purchased';

  // Candidate parents: active animals of the same type (mother = female, father = male).
  const { data: parentCandidatesData } = useQuery({
    queryKey: ['cattle-active', 'parents'],
    queryFn: async () => (await api.get('/farm/cattle/all')).data.cattle as ParentOption[],
    enabled: showModal,
  });
  const parentOptions = (gender: 'male' | 'female', currentId: string, current?: { id: number; tag_number: string; name: string | null } | null) => {
    const list = (parentCandidatesData ?? []).filter(c =>
      c.gender === gender
      && c.id !== editCattle?.id
      && (!selectedAnimalTypeId || c.animal_type_id === selectedAnimalTypeId));
    // Keep an already-recorded parent selectable even if it is no longer active.
    if (currentId && current && !list.some(c => String(c.id) === currentId)) {
      list.unshift({ ...current, gender, animal_type_id: selectedAnimalTypeId });
    }
    return list;
  };

  const { data: ageStagesData, isLoading: ageStagesLoading } = useQuery<{ stages: AnimalAgeStage[] }>({
    queryKey: ['age-stages-by-type', selectedAnimalTypeId],
    queryFn: () => api.get(`/farm/animal-age-stages/by-type/${selectedAnimalTypeId}`).then(r => r.data),
    enabled: !!selectedAnimalTypeId && showModal,
  });

  const { data: ageCategoriesData, isLoading: ageCategoriesLoading } = useQuery<{ categories: AnimalAgeCategory[] }>({
    queryKey: ['age-categories-by-type', selectedAnimalTypeId],
    queryFn: () => api.get(`/farm/animal-age-categories/by-type/${selectedAnimalTypeId}`).then(r => r.data),
    enabled: !!selectedAnimalTypeId && showModal,
  });

  const ageStages: AnimalAgeStage[]        = ageStagesData?.stages      ?? [];
  const ageCategories: AnimalAgeCategory[] = ageCategoriesData?.categories ?? [];

  const { data: medsAllData } = useQuery({
    queryKey: ['medicines-all'],
    queryFn: async () => ((await api.get('/farm/medicine/all')).data?.medicines ?? []) as MedItem[],
    enabled: showMedBulk || showVaxBulk,
  });

  const { data: vaccinesOnlyData } = useQuery({
    queryKey: ['medicines-vaccines-only'],
    queryFn: async () => ((await api.get('/farm/medicine/all', { params: { is_vaccine: 1 } })).data?.medicines ?? []) as MedItem[],
    enabled: showVaxBulk,
  });

  const { data: medsNonVaccineData } = useQuery({
    queryKey: ['medicines-non-vaccines'],
    queryFn: async () => ((await api.get('/farm/medicine/all', { params: { is_vaccine: 0 } })).data?.medicines ?? []) as MedItem[],
    enabled: showMedBulk,
  });

  const { data: customersAllData } = useQuery({
    queryKey: ['customers-all'],
    queryFn: async () => (await api.get('/customers/all')).data.customers as { id: number; name: string; phone?: string }[],
    enabled: showSaleBulk,
  });
  const customersAll = customersAllData ?? [];
  const medsAll: MedItem[] = Array.isArray(medsAllData) ? medsAllData : [];
  const vaccinesOnly: MedItem[] = Array.isArray(vaccinesOnlyData) ? vaccinesOnlyData : [];
  const medsNonVaccine: MedItem[] = Array.isArray(medsNonVaccineData) ? medsNonVaccineData : [];

  function handleApiError(e: unknown) {
    const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
    const errs = err.response?.data?.errors;
    if (errs) {
      const flat: Record<string, string> = {};
      Object.entries(errs).forEach(([k, v]) => { flat[k] = v[0]; });
      setFieldErrors(flat);
      setFormError(err.response?.data?.message ?? t('common:error.generic'));
    } else {
      setFieldErrors({});
      setFormError(err.response?.data?.message ?? t('common:error.generic'));
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload: { form: CattleFormData; file: File | null; invoice: File | null }) => {
      const fd = new FormData();
      const farmBorn = payload.form.origin === 'farm_born';
      (Object.entries(payload.form) as [keyof CattleFormData, string][]).forEach(([k, v]) => {
        if (v === '') return;
        // A farm-born animal has no purchase; a bought one has no birth weight here.
        if (farmBorn && PURCHASE_ONLY_FIELDS.includes(k)) return;
        if (!farmBorn && (k === 'birth_weight' || k === 'birth_value')) return;
        if (k === 'milking_sessions') { v.split(',').forEach(s => fd.append('milking_sessions[]', s)); return; }
        fd.append(k, v);
      });
      if (payload.file) fd.append('profile_image', payload.file);
      if (payload.invoice) fd.append('invoice_file', payload.invoice);
      return api.post('/farm/cattle', fd);
    },
    onSuccess: async (res) => {
      toast.success(res?.data?.message ?? savedMsg());
      invalidateMoney(qc, [['farm-cattle'], ['farm-cattle-trash'], ['cattle-active']]);
      closeModal(true);
    },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
      handleApiError(e);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Partial<CattleFormData> }) =>
      api.put(`/farm/cattle/${id}`, d),
    onSuccess: async (res, { id }) => {
      if (profileImageFile) {
        const fd = new FormData();
        fd.append('profile_image', profileImageFile);
        await api.post(`/farm/cattle/${id}/profile-image`, fd);
      }
      if (invoiceFile) {
        const fd = new FormData();
        fd.append('invoice_file', invoiceFile);
        await api.post(`/farm/cattle/${id}/invoice-file`, fd);
      }
      toast.success(res?.data?.message ?? savedMsg());
      invalidateMoney(qc, [['farm-cattle'], ['cattle-active']]);
      closeModal();
    },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
      handleApiError(e);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/cattle/${id}`),
    onSuccess: (res) => {
      toast.success(res?.data?.message ?? trashedMsg());
      invalidateMoney(qc, [['farm-cattle'], ['farm-cattle-trash'], ['cattle-active']]);
      setDeleteTarget(null);
      setDeleteConfirmText('');
    },
    onError: (e) => {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      const msg = err?.response?.data?.message ?? failedMsg();
      toast.error(msg);
      if (err?.response?.status === 422) {
        setDeleteTarget(null);
        setDeleteConfirmText('');
      }
    },
  });

  const removeInvoiceMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/cattle/${id}/invoice-file`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farm-cattle'] }),
  });

  // When the breed list arrives after the edit form opened, preselect the animal's breed
  // (derived here rather than copied into the form from an effect).
  const fallbackBreed = showModal && editCattle && !editLoading && !form.breed_id && breedsData
    ? (editCattle.breed_id
        ? breedsData.find(b => b.id === editCattle.breed_id)
        : breedsData.find(b => b.name === ((editCattle as Cattle & { breed_en?: string }).breed_en ?? editCattle.breed)))
    : undefined;
  const breedFields = fallbackBreed ? { breed_id: fallbackBreed.id.toString(), breed: fallbackBreed.name } : {};

  const [tagLoading, setTagLoading] = useState(false);

  const openCreate = async () => {
    setEditCattle(null);
    if (createDraft) {
      setForm({ ...DEFAULT, ...createDraft, purchase_date: createDraft.purchase_date || todayStr() });
    } else {
      setForm({ ...DEFAULT, purchase_date: todayStr() });
      setProfileImageFile(null);
      setProfileImagePreview(null);
      setInvoiceFile(null);
    }
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
    setTagLoading(true);
    try {
      const res = await api.get('/farm/cattle/next-tag');
      setForm(f => ({ ...f, tag_number: res.data.tag_number }));
    } catch {
      // silently fail — user types manually
    } finally {
      setTagLoading(false);
    }
  };

  const openEdit = async (c: Cattle) => {
    setEditCattle(c);
    setForm({ ...DEFAULT, animal_type_id: c.animal_type_id?.toString() ?? '' });
    setFormError('');
    setFieldErrors({});
    setProfileImageFile(null);
    setProfileImagePreview(c.profile_image_url ?? null);
    setInvoiceFile(null);
    setShowModal(true);
    setEditLoading(true);
    try {
      const res = await api.get(`/farm/cattle/${c.id}`);
      const full = (res.data.cattle ?? res.data) as Cattle & { breed_en?: string; color_en?: string; notes_en?: string };
      const breedName = full.breed_en ?? full.breed;
      const resolvedBreedId = full.breed_id?.toString()
        ?? breedsData?.find(b => b.name === breedName)?.id?.toString()
        ?? '';
      setForm({
        tag_number: full.tag_number,
        name: full.name ?? '',
        ear_tag_number: full.ear_tag_number ?? '',
        animal_type: animalTypeName(full.animal_type) ?? '',
        animal_type_id: full.animal_type_id?.toString() ?? '',
        breed: breedName,
        breed_id: resolvedBreedId,
        color: full.color_en ?? full.color ?? '',
        gender: full.gender,
        age_stage_id: (full as Cattle & { age_stage_id?: number }).age_stage_id?.toString() ?? '',
        age_category_id: (full as Cattle & { age_category_id?: number }).age_category_id?.toString() ?? '',
        purchase_date: toDateStr(full.purchase_date),
        purchase_price: full.purchase_price ?? '',
        purchase_weight: full.purchase_weight ?? '',
        health_status: full.health_status ?? 'healthy',
        feed_ratio: full.feed_ratio ?? '0',
        shed_id: full.shed_id?.toString() ?? '',
        seller_name: full.seller_name ?? '',
        seller_phone: full.seller_phone ?? '',
        notes: full.notes_en ?? full.notes ?? '',
        payment_account_id: '',
        origin: full.origin ?? 'purchased',
        purpose: full.purpose ?? '',
        dam_id: full.dam_id?.toString() ?? '',
        sire_id: full.sire_id?.toString() ?? '',
        birth_date: toDateStr(full.birth_date),
        birth_weight: full.birth_weight ?? '',
        birth_value: '',
        current_weight: full.current_weight ?? '',
        reproductive_status: full.reproductive_status ?? '',
        milking_sessions: (full.milking_sessions ?? []).join(','),
      });
      setProfileImagePreview(full.profile_image_url ?? null);
      setEditCattle(full);
    } catch {
      setFormError(t('common:error.generic'));
    } finally {
      setEditLoading(false);
    }
  };

  const closeModal = (clearDraft = false) => {
    if (!editCattle) {
      if (clearDraft) {
        setCreateDraft(null);
      } else {
        // Preserve form as draft (excluding tag_number — always refetched on open)
        const { tag_number: _tag, ...rest } = form;
        setCreateDraft(rest as Partial<CattleFormData>);
      }
    }
    setShowModal(false);
    setEditCattle(null);
    setFieldErrors({});
    setFormError('');
    setProfileImageFile(null);
    setProfileImagePreview(null);
    setInvoiceFile(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setProfileImageFile(file);
    if (file) {
      if (file.type === 'application/pdf') {
        setProfileImagePreview('pdf');
      } else {
        const reader = new FileReader();
        reader.onload = ev => setProfileImagePreview(ev.target?.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  function validateCattle(): boolean {
    const e: Record<string, string> = {};
    if (!form.tag_number.trim()) e.tag_number = t('field.validation.tag_required');
    if (!form.animal_type_id) e.animal_type_id = t('field.validation.animal_type_required');
    if (!form.breed_id && !breedFields.breed_id) e.breed_id = t('field.validation.breed_required');
    if (!form.shed_id) e.shed_id = t('field.validation.shed_required');
    if (!editCattle) {
      if (isPurchased) {
        if (!form.purchase_date) e.purchase_date = t('field.validation.purchase_date_required');
        const price = parseFloat(form.purchase_price);
        if (!form.purchase_price || isNaN(price) || price < 0) e.purchase_price = t('field.validation.purchase_price_required');
        if (!form.purchase_weight) e.purchase_weight = t('breeding.validation.purchase_weight_required');
        if (!form.payment_account_id) e.payment_account_id = t('breeding.validation.payment_account_required');
      } else {
        if (!form.birth_date) e.birth_date = t('breeding.validation.birth_date_required');
        if (!form.birth_weight && !form.current_weight) e.current_weight = t('breeding.validation.weight_required');
      }
      if (!form.age_stage_id) e.age_stage_id = t('field.validation.age_stage_required');
      if (!form.age_category_id) e.age_category_id = t('field.validation.age_category_required');
    }
    if (Object.keys(e).length) { setFieldErrors(e); return false; }
    return true;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    if (!validateCattle()) return;
    if (editCattle) {
      const payload = {
        ...form,
        ...breedFields,
        shed_id:        form.shed_id        || undefined,
        animal_type_id: form.animal_type_id || undefined,
        // An empty purpose means "leave as is"; a changed one is recorded in its history.
        purpose:        form.purpose        || undefined,
        // Only females carry a reproductive status / milking count.
        reproductive_status: form.gender === 'female' ? form.reproductive_status : '',
        // Its own sessions, or none to follow its type.
        milking_sessions:    (form.gender === 'female' && form.milking_sessions ? form.milking_sessions.split(',') : []) as unknown as string,
      };
      updateMutation.mutate({ id: editCattle.id, d: payload });
    } else {
      const createForm = form.gender === 'female' ? form : { ...form, reproductive_status: '' as const, milking_sessions: '' };
      createMutation.mutate({ form: createForm, file: profileImageFile, invoice: invoiceFile });
    }
  };

  const cattle = data?.data ?? [];
  const isPending = createMutation.isPending || updateMutation.isPending || editLoading;

  // Helpers for selection
  const activeCattle = cattle.filter(c => c.status === 'active');
  const allActiveSelected = activeCattle.length > 0 && activeCattle.every(c => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;
  // Picked animals may sit on another page of the list, so fall back to the picker's rows.
  const selectedCattleList = [
    ...cattle.filter(c => selectedIds.has(c.id)),
    ...pickedCattle.filter(p => selectedIds.has(p.id) && !cattle.some(c => c.id === p.id)),
  ];
  const toggleOne = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleAllActive = () => {
    if (allActiveSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(activeCattle.map(c => c.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Milk entry: nothing picked → every animal in milk. Animals picked → they
  // must all give milk; a wrong one has to be removed before the entry opens.
  const openMilkEntry = async () => {
    if (selectedIds.size === 0) { setMilkFor(undefined); setShowMilkEntry(true); return; }
    const ids = Array.from(selectedIds);
    setMilkChecking(true);
    try {
      const res = await api.get('/farm/dairy/milk-check', { params: { cattle_ids: ids, date: todayStr() } });
      const rows: MilkCheckRow[] = res.data.rows;
      if (rows.every(r => r.ok)) { setMilkFor(ids); setShowMilkEntry(true); }
      else setMilkCheckRows(rows);
    } catch (err) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    } finally { setMilkChecking(false); }
  };
  const removeFromSelection = (ids: number[]) => {
    setSelectedIds(prev => new Set([...prev].filter(id => !ids.includes(id))));
    setMilkCheckRows(null);
    toast.success(t('milk_check.removed', { count: ids.length }));
  };

  // ── Per-item computed helpers ───────────────────────────────
  const getLineQty = (item: LineItem, count: number) => {
    const v = parseFloat(item.qty_value);
    if (isNaN(v) || v <= 0) return 0;
    return item.qty_mode === 'total_split' && count > 0 ? v / count : v;
  };
  const getLineMed  = (item: LineItem) => medsAll.find(m => m.id.toString() === item.medicine_id);
  const lineHasStock = (item: LineItem, count: number) => {
    const med = getLineMed(item); if (!med) return true;
    return med.remaining_quantity >= getLineQty(item, count) * count;
  };

  const resetMedModal = () => { setMedItems([newLine()]); setMedDate(todayStr()); setMedNotes(''); setMedBulkError(''); setMedBulkErrors({}); };
  const resetVaxModal = () => { setVaxItems([newLine()]); setVaxDate(todayStr()); setVaxAdminBy(''); setVaxNotes(''); setVaxBulkError(''); setVaxBulkErrors({}); };
  const resetTreatModal = () => {
    setTreatDate(todayStr()); setTreatMedUsed(''); setTreatVetFee('');
    setTreatPayAccId(''); setTreatDoctorName(''); setTreatDoctorPhone('');
    setTreatNotes(''); setTreatBulkError(''); setTreatBulkErrors({});
    setPerCattle({}); setPerCattleFiles({}); setPerCattleErrors({});
  };
  const resetSaleModal = () => {
    setSaleDate(todayStr()); setSalePaymentAccountId(''); setSaleNotes('');
    setSaleBuyerMode('existing'); setSaleCustomerId('');
    setSaleNewName(''); setSaleNewPhone(''); setSaleNewAddress('');
    setSalePaymentStatus('paid'); setSalePaidAmount('');
    setSalePrices({}); setSaleBulkError(''); setSaleBulkErrors({}); setInvoiceData(null);
  };

  const openBulk = (action: PickAction) => {
    if (action === 'medicine')  { resetMedModal();   setShowMedBulk(true); }
    if (action === 'vaccine')   { resetVaxModal();   setShowVaxBulk(true); }
    if (action === 'treatment') { resetTreatModal(); setShowTreatBulk(true); }
    if (action === 'sell')      { resetSaleModal();  setShowSaleBulk(true); }
  };

  // ?new=cattle opens the add form; ?new=medicine|vaccine|treatment|sell picks animals first.
  useAutoOpen(value => {
    if (value === 'cattle') { if (hasPermission('farm.cattle.create')) openCreate(); return; }
    if ((PICK_ACTIONS as string[]).includes(value)) setPickFor(value as PickAction);
  });

  // Medicine / vaccine lines: a row without enough stock is marked on the row.
  const checkLines = (items: LineItem[], count: number) => {
    const errs: Record<string, string> = {};
    items.forEach((i, idx) => {
      if (i.medicine_id && parseFloat(i.qty_value) > 0 && !lineHasStock(i, count))
        errs[`items.${idx}.quantity_used`] = t('bulk.validation.stock_insufficient_named', { name: getLineMed(i)?.name });
    });
    return errs;
  };
  // The API numbers only the rows it was sent; point its errors back at the rows on screen.
  const lineApiErrors = (err: unknown, sent: LineItem[], all: LineItem[]) => {
    const { fields, message } = apiFieldErrors(err, failedMsg());
    const mapped = Object.fromEntries(Object.entries(fields).map(([k, v]) => {
      const m = k.match(/^items\.(\d+)\.(.+)$/);
      return [m ? `items.${all.indexOf(sent[Number(m[1])])}.${m[2]}` : k, v];
    }));
    return { fields: mapped, message: Object.keys(mapped).length ? '' : message };
  };

  const handleMedBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cattleCount = selectedIds.size;
    const validItems = medItems.filter(i => i.medicine_id && parseFloat(i.qty_value) > 0);
    const errs = checkLines(medItems, cattleCount);
    if (!medDate) errs.usage_date = t('common:form.v.date_required');
    else if (medDate > localDateStr()) errs.usage_date = t('common:form.v.date_not_future');
    setMedBulkErrors(errs);
    setMedBulkError(validItems.length === 0 ? t('bulk.medicine.validation.at_least_one') : '');
    if (validItems.length === 0 || Object.keys(errs).length) return;
    setMedBulkSaving(true);
    try {
      const res = await api.post('/farm/medicine/usages/bulk-multi', {
        cattle_ids:    Array.from(selectedIds),
        items:      validItems.map(i => ({ medicine_id: i.medicine_id, quantity_used: parseFloat(getLineQty(i, cattleCount).toFixed(4)), next_due_date: i.next_due_date || null })),
        usage_date: medDate,
        notes:      medNotes || null,
      });
      invalidateKeys(qc, [...MEDICINE_STOCK_KEYS, ...CATTLE_COST_KEYS, ['medicine-usages'], ['cattle-medicine'], ['farm-cattle']]);
      toast.success(res?.data?.message ?? t('bulk.medicine.toast.saved'));
      setShowMedBulk(false); resetMedModal(); clearSelection();
    } catch (err) {
      const { fields, message } = lineApiErrors(err, validItems, medItems);
      setMedBulkErrors(fields); setMedBulkError(message);
    } finally { setMedBulkSaving(false); }
  };

  const handleSaleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaleBulkError('');
    const errs: Record<string, string> = {};
    if (!saleDate) errs.sale_date = t('bulk.sale.validation.date_required');
    else if (saleDate > localDateStr()) errs.sale_date = t('common:form.v.date_not_future');
    if (!salePaymentAccountId) errs.payment_account_id = t('bulk.sale.validation.payment_account_required');
    if (saleBuyerMode === 'existing' && !saleCustomerId) errs.customer_id = t('bulk.sale.validation.customer_required');
    if (saleBuyerMode === 'new' && !saleNewName.trim()) errs['new_customer.name'] = t('bulk.sale.validation.new_customer_name_required');
    if (salePaymentStatus === 'partial' && (!salePaidAmount || parseFloat(salePaidAmount) <= 0)) errs.paid_amount = t('bulk.sale.validation.partial_amount_required');
    const priceTotal = selectedCattleList.reduce((s, c) => s + (parseFloat(salePrices[c.id]?.price || '0') || 0), 0);
    if (salePaymentStatus === 'partial' && !errs.paid_amount && priceTotal > 0 && parseFloat(salePaidAmount) >= priceTotal) {
      errs.paid_amount = t('common:form.v.partial_range');
    }
    selectedCattleList.forEach((c, i) => {
      if (!((parseFloat(salePrices[c.id]?.price || '0') || 0) > 0)) errs[`items.${i}.sale_price`] = t('bulk.sale.validation.price_required');
    });
    setSaleBulkErrors(errs);
    if (Object.keys(errs).length) return;

    const totalSale = selectedCattleList.reduce((s, c) => s + (parseFloat(salePrices[c.id]?.price || '0') || 0), 0);
    if (totalSale <= 0) { setSaleBulkError(t('bulk.sale.validation.price_required')); return; }

    const paidTotal = salePaymentStatus === 'paid' ? totalSale
      : salePaymentStatus === 'unpaid' ? 0
      : Math.min(parseFloat(salePaidAmount || '0'), totalSale);

    const items = selectedCattleList.map(c => {
      const price = parseFloat(salePrices[c.id]?.price || '0') || 0;
      const paidForThis = totalSale > 0 ? (price / totalSale) * paidTotal : 0;
      return {
        cattle_id:   c.id,
        sale_price:  price,
        sale_weight: salePrices[c.id]?.weight ? parseFloat(salePrices[c.id]!.weight) : null,
        paid_amount: parseFloat(paidForThis.toFixed(2)),
      };
    });

    if (items.some(i => !i.sale_price || i.sale_price <= 0)) {
      setSaleBulkError(t('bulk.sale.validation.price_required')); return;
    }

    setSaleBulkSaving(true);
    try {
      const res = await api.post('/farm/sales/bulk', {
        sale_date:          saleDate,
        payment_account_id: salePaymentAccountId,
        customer_id:        saleBuyerMode === 'existing' ? saleCustomerId : null,
        new_customer:       saleBuyerMode === 'new' ? { name: saleNewName.trim(), phone: saleNewPhone || null, address: saleNewAddress || null } : null,
        payment_status:     salePaymentStatus,
        notes:              saleNotes || null,
        items,
      });
      invalidateMoney(qc, [['farm-cattle'], ['cattle-sales'], ['sales-summary'], ['cattle-active']]);
      toast.success(res?.data?.message ?? t('bulk.sale.toast.saved'));
      clearSelection();
      setInvoiceData(res.data as SaleInvoiceData);
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, t('bulk.sale.toast.failed'));
      setSaleBulkErrors(fields);
      setSaleBulkError(Object.keys(fields).length ? '' : message);
    } finally { setSaleBulkSaving(false); }
  };

  const handlePrintInvoice = () => {
    if (!invoiceData) return;
    printCattleSaleInvoice(invoiceData, saleDate, t, () => toast.error(t('finance:receipt.popup_blocked')));
  };

  const handleTreatBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!treatDate) errs.treatment_date = t('common:form.v.date_required');
    if (!treatPayAccId) errs.payment_account_id = t('bulk.treatment.validation.payment_account_required');
    // validate per-cattle diagnosis
    const pcErrors: Record<number, string> = {};
    for (const c of selectedCattleList) {
      if (!(perCattle[c.id]?.diagnosis ?? '').trim()) pcErrors[c.id] = t('bulk.treatment.validation.diagnosis_required');
    }
    setTreatBulkErrors(errs); setPerCattleErrors(pcErrors); setTreatBulkError('');
    if (Object.keys(errs).length > 0 || Object.keys(pcErrors).length > 0) return;
    setTreatBulkSaving(true);
    try {
      await Promise.all(selectedCattleList.map(async (c) => {
        const pc = perCattle[c.id] ?? DEFAULT_PER_CATTLE;
        const file = perCattleFiles[c.id] ?? null;
        if (file) {
          const fd = new FormData();
          fd.append('cattle_id',          String(c.id));
          fd.append('treatment_date',     treatDate);
          fd.append('diagnosis',          pc.diagnosis);
          fd.append('health_status',      pc.health_status);
          if (pc.treatment)      fd.append('treatment',          pc.treatment);
          if (pc.prescription)   fd.append('prescription',       pc.prescription);
          if (pc.follow_up_date) fd.append('follow_up_date',     pc.follow_up_date);
          if (treatMedUsed)      fd.append('medicines_used',     treatMedUsed);
          if (treatVetFee)       fd.append('vet_fee',            treatVetFee);
          fd.append('payment_account_id', treatPayAccId);
          if (treatDoctorName)   fd.append('doctor_name',        treatDoctorName);
          if (treatDoctorPhone)  fd.append('doctor_phone',       treatDoctorPhone);
          if (treatNotes)        fd.append('notes',              treatNotes);
          fd.append('prescription_file',  file);
          return api.post('/farm/health/treatments', fd);
        } else {
          return api.post('/farm/health/treatments', {
            cattle_id:          c.id,
            treatment_date:     treatDate,
            diagnosis:          pc.diagnosis,
            treatment:          pc.treatment     || null,
            prescription:       pc.prescription  || null,
            follow_up_date:     pc.follow_up_date || null,
            health_status:      pc.health_status,
            medicines_used:     treatMedUsed     || null,
            vet_fee:            treatVetFee      || undefined,
            payment_account_id: treatPayAccId,
            doctor_name:        treatDoctorName  || null,
            doctor_phone:       treatDoctorPhone || null,
            notes:              treatNotes       || null,
          });
        }
      }));
      invalidateMoney(qc, [['treatments'], ['cattle-treatments'], ['farm-cattle'], ['cattle-active']]);
      toast.success(t('bulk.treatment.toast.saved', { count: selectedCattleList.length }));
      setShowTreatBulk(false); resetTreatModal(); clearSelection();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, t('bulk.treatment.toast.failed'));
      setTreatBulkErrors(fields);
      setTreatBulkError(Object.keys(fields).length ? '' : message);
    } finally { setTreatBulkSaving(false); }
  };

  const handleVaxBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cattleCount = selectedIds.size;
    const validItems = vaxItems.filter(i => i.medicine_id && parseFloat(i.qty_value) > 0);
    const errs = checkLines(vaxItems, cattleCount);
    if (!vaxDate) errs.administered_date = t('common:form.v.date_required');
    else if (vaxDate > localDateStr()) errs.administered_date = t('common:form.v.date_not_future');
    setVaxBulkErrors(errs);
    setVaxBulkError(validItems.length === 0 ? t('bulk.vaccine.validation.at_least_one') : '');
    if (validItems.length === 0 || Object.keys(errs).length) return;
    setVaxBulkSaving(true);
    try {
      const res = await api.post('/farm/health/vaccines/bulk-multi', {
        cattle_ids:        Array.from(selectedIds),
        items:             validItems.map(i => ({ medicine_id: i.medicine_id, quantity_used: parseFloat(getLineQty(i, cattleCount).toFixed(4)), next_due_date: i.next_due_date || null })),
        administered_date: vaxDate,
        administered_by:   vaxAdminBy || null,
        notes:             vaxNotes || null,
      });
      invalidateMoney(qc, [...MEDICINE_STOCK_KEYS, ['vaccine-schedules'], ['cattle-vaccines'], ['farm-cattle']]);
      toast.success(res?.data?.message ?? t('bulk.vaccine.toast.saved'));
      setShowVaxBulk(false); resetVaxModal(); clearSelection();
    } catch (err) {
      const { fields, message } = lineApiErrors(err, validItems, vaxItems);
      setVaxBulkErrors(fields); setVaxBulkError(message);
    } finally { setVaxBulkSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Search row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t('search_placeholder')} value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {isSuperAdmin && (
          <Link href="/farm/cattle/trash" aria-label={t('btn.trash')}
            className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium px-3 py-2 rounded-lg flex-shrink-0">
            <Trash2 size={15} /> <span className="hidden sm:inline">{t('btn.trash')}</span>
          </Link>
        )}
        {hasPermission('farm.dairy.create') && (
          <button onClick={openMilkEntry} disabled={milkChecking}
            title={someSelected ? t('btn.milk_entry_selected', { count: selectedIds.size }) : t('btn.milk_entry')}
            aria-label={someSelected ? t('btn.milk_entry_selected', { count: selectedIds.size }) : t('btn.milk_entry')}
            className="flex items-center gap-1.5 border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-700 text-sm font-medium px-3 py-2 rounded-lg flex-shrink-0 disabled:opacity-60">
            <Milk size={15} /> <span className="hidden sm:inline">{t('btn.milk_entry')}</span>
          </button>
        )}
        {hasPermission('farm.cattle.create') && (
          <button onClick={openCreate} aria-label={t('btn.add')} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg flex-shrink-0">
            <Plus size={15} /> <span className="hidden sm:inline">{t('btn.add')}</span>
          </button>
        )}
      </div>
      {/* Filter row */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('filter.all_status')}</option>
          <option value="active">{t('filter.active')}</option>
          <option value="sold">{t('filter.sold')}</option>
          <option value="dead">{t('filter.dead')}</option>
          <option value="transferred">{t('filter.transferred')}</option>
        </select>
        <select value={ageFilter} onChange={e => { setAgeFilter(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('filter.all_ages')}</option>
          {(allAgeCategoriesData ?? []).map(ac => (
            <option key={ac.id} value={String(ac.id)}>{ac.name}</option>
          ))}
        </select>
        <select value={shedFilter} onChange={e => { setShedFilter(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('filter.all_sheds')}</option>
          {(shedsData ?? []).map(s => (
            <option key={s.id} value={String(s.id)}>{s.name}</option>
          ))}
        </select>
        <select value={originFilter} onChange={e => { setOriginFilter(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('breeding.filter_all_origins')}</option>
          <option value="purchased">{t('breeding.origin.purchased')}</option>
          <option value="farm_born">{t('breeding.origin.farm_born')}</option>
        </select>
        <select value={purposeFilter} onChange={e => { setPurposeFilter(e.target.value); setPage(1); }}
          className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('breeding.filter_all_purposes')}</option>
          {(Object.keys(PURPOSE_COLORS) as CattlePurpose[]).map(p => (
            <option key={p} value={p}>{t('breeding.purpose.' + p)}</option>
          ))}
        </select>
      </div>

      {/* ── Bulk Action Bar ── */}
      {someSelected && (
        <div className="bg-emerald-600 text-white rounded-xl px-4 py-3 shadow-md space-y-2.5">
          {/* Row 1: count + clear */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm font-semibold">{t('bulk.bar.selected_count', { count: selectedIds.size })}</span>
            <button onClick={clearSelection} aria-label={t('common:btn.deselect_all')} title={t('common:btn.deselect_all')}
              className="grid place-items-center w-10 h-10 -m-2 sm:w-auto sm:h-auto sm:p-1.5 sm:m-0 rounded-lg hover:bg-emerald-700 text-emerald-100 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
          {/* Row 2: action buttons — wrap on mobile, single line on desktop */}
          <div className="flex flex-wrap gap-2">
            {hasPermission('farm.medicine.create') && (
              <button
                onClick={() => { setMedBulkError(''); setMedBulkErrors({}); setShowMedBulk(true); }}
                className="flex items-center gap-1.5 bg-white text-emerald-700 hover:bg-emerald-50 text-xs font-semibold px-3 py-2 rounded-lg flex-1 sm:flex-none justify-center min-w-[100px]">
                <FlaskConical size={14} /> {t('bulk.bar.btn_medicine')}
              </button>
            )}
            {hasPermission('farm.health.create') && (
              <button
                onClick={() => { setVaxBulkError(''); setVaxBulkErrors({}); setShowVaxBulk(true); }}
                className="flex items-center gap-1.5 bg-white text-emerald-700 hover:bg-emerald-50 text-xs font-semibold px-3 py-2 rounded-lg flex-1 sm:flex-none justify-center min-w-[100px]">
                <Syringe size={14} /> {t('bulk.bar.btn_vaccine')}
              </button>
            )}
            {hasPermission('farm.health.create') && (
              <button
                onClick={() => { setTreatBulkError(''); setTreatBulkErrors({}); setShowTreatBulk(true); }}
                className="flex items-center gap-1.5 bg-white text-orange-600 hover:bg-orange-50 text-xs font-semibold px-3 py-2 rounded-lg flex-1 sm:flex-none justify-center min-w-[100px]">
                <Activity size={14} /> {t('bulk.bar.btn_treatment')}
              </button>
            )}
            {hasPermission('farm.expenses.create') && (
              <button
                onClick={() => setShowExpenseBulk(true)}
                className="flex items-center gap-1.5 bg-white text-violet-700 hover:bg-violet-50 text-xs font-semibold px-3 py-2 rounded-lg flex-1 sm:flex-none justify-center min-w-[100px]">
                <Receipt size={14} /> {t('bulk.bar.btn_expense')}
              </button>
            )}
            {hasPermission('farm.sales.create') && (
              <button
                onClick={() => { setSaleBulkError(''); setSaleBulkErrors({}); setInvoiceData(null); setShowSaleBulk(true); }}
                className="flex items-center gap-1.5 bg-white text-orange-600 hover:bg-orange-50 text-xs font-semibold px-3 py-2 rounded-lg flex-1 sm:flex-none justify-center min-w-[100px]">
                <ShoppingCart size={14} /> {t('bulk.sale.submit_btn')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Mobile card view */}
        <div className="block sm:hidden divide-y divide-slate-100">
          <SortSelect options={[
            { key: 'tag', label: t('col.tag_name'), type: 'text' },
            { key: 'weight', label: t('col.weight_kg'), type: 'number' },
            { key: 'price', label: t('col.purchase_price'), type: 'number' },
          ]} sorting={sorting} className="px-4 py-2.5" />
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-5 bg-slate-100 rounded animate-pulse w-1/3" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
              </div>
            ))
          ) : cattle.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">{t('common:table.no_data')}</div>
          ) : (
            cattle.map(c => (
              <div key={c.id} className={`p-4 hover:bg-slate-50 ${selectedIds.has(c.id) ? 'bg-emerald-50' : ''}`}>
                {/* The actions drop to their own line when they would squeeze the name. */}
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1 basis-48">
                    {c.status === 'active' && (
                      <label className="shrink-0 -m-2.5 p-2.5 cursor-pointer">
                        <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)}
                          aria-label={t('tooltip.select_animal', { tag: c.tag_number })}
                          className="block w-5 h-5 rounded accent-emerald-500 cursor-pointer" />
                      </label>
                    )}
                    {c.profile_image_url ? (
                      <a href={c.profile_image_url} target="_blank" rel="noreferrer" className="shrink-0">
                        <img src={c.profile_image_url} alt={c.tag_number} loading="lazy" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                      </a>
                    ) : (
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                        <ImageIcon size={14} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{c.tag_number}</p>
                      {c.name && <p className="text-xs text-slate-400 truncate">{c.name}</p>}
                      {c.purpose && (
                        <span className={`inline-block mt-0.5 text-[11px] px-1.5 py-0.5 rounded-full font-medium ${PURPOSE_COLORS[c.purpose]}`}>
                          {t('breeding.purpose.' + c.purpose)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ms-auto">
                    {c.invoice_file_url && (
                      <a href={c.invoice_file_url} target="_blank" rel="noreferrer" aria-label={t('tooltip.view_invoice')} title={t('tooltip.view_invoice')}
                        className="grid place-items-center w-10 h-10 sm:w-auto sm:h-auto sm:p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"><FileText size={14} /></a>
                    )}
                    <Link href={`/farm/cattle/${c.id}`} aria-label={t('common:btn.view')} title={t('common:btn.view')} className="grid place-items-center w-10 h-10 sm:w-auto sm:h-auto sm:p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                      <Eye size={14} />
                    </Link>
                    {hasPermission('farm.cattle.edit') && c.status === 'active' && (
                      <button onClick={() => openEdit(c)} aria-label={t('common:btn.edit')} title={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                        <Pencil size={14} />
                      </button>
                    )}
                    {hasPermission('farm.sales.create') && c.status === 'active' && (
                      <button onClick={() => { setSelectedIds(new Set([c.id])); resetSaleModal(); setShowSaleBulk(true); }}
                        className="grid place-items-center w-10 h-10 sm:w-auto sm:h-auto sm:p-1.5 rounded-lg hover:bg-orange-50 text-orange-400" title={t('tooltip.sell_cattle')} aria-label={t('tooltip.sell_cattle')}>
                        <ShoppingCart size={14} />
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button onClick={() => { setDeleteTarget(c); setDeleteConfirmText(''); }}
                        aria-label={t('common:btn.delete')} title={t('common:btn.delete')}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div><span className="text-slate-500">{t('col.type')}:</span> <span className="text-slate-700">{animalTypeName(c.animal_type) ?? '—'}</span></div>
                  <div><span className="text-slate-500">{t('col.breed')}:</span> <span className="text-slate-700">{c.breed}</span></div>
                  <div>
                    <span className="text-slate-500">{t('col.gender')}:</span>{' '}
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${c.gender === 'male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                      {t('gender.' + c.gender)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('col.age_group')}:</span>{' '}
                    <span className="px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                      {(c as Cattle & { age_category?: { name?: string } }).age_category?.name ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('col.status')}:</span>{' '}
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t('status.' + c.status)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('col.health')}:</span>{' '}
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${HEALTH_STATUS_COLORS[c.health_status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t('health_status.' + c.health_status)}
                    </span>
                  </div>
                  <div><span className="text-slate-500">{t('col.weight_kg')}:</span> <span className="text-slate-700">{c.current_weight ?? c.purchase_weight ?? c.birth_weight ?? '—'} / {c.purchase_weight ?? c.birth_weight ?? '—'}</span></div>
                  <div><span className="text-slate-500">{t('col.purchase_price')}:</span> <span className="text-slate-700">{c.purchase_price !== null ? fmtMoney(c.purchase_price) : t('breeding.born_badge')}</span></div>
                  <div><span className="text-slate-500">{t('col.shed')}:</span> <span className="text-slate-700">{c.shed?.name ?? '—'}</span></div>
                  {parseFloat(c.feed_ratio) > 0 && (
                    <div><span className="text-slate-500">{t('col.feed_ratio')}:</span> <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">{parseFloat(c.feed_ratio)}%</span></div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allActiveSelected} onChange={toggleAllActive}
                    className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                    title={t('tooltip.select_all_active')} aria-label={t('tooltip.select_all_active')} />
                </th>
                <SerialHeader />
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('col.photo')}</th>
                <SortHeader label={t('col.tag_name')} sortKey="tag" sortType="text" sorting={sorting} />
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('col.type')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('col.breed')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('col.gender')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('col.age_group')}</th>
                <SortHeader label={t('col.weight_kg')} sortKey="weight" sortType="number" sorting={sorting} />
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('col.feed_ratio')}</th>
                <SortHeader label={t('col.purchase_price')} sortKey="price" sortType="number" sorting={sorting} />
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('col.status')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('col.health')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('col.shed')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('common:actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 15 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : cattle.map((c, i) => (
                <tr key={c.id} className={`hover:bg-slate-50 ${selectedIds.has(c.id) ? 'bg-emerald-50' : ''}`}>
                  <td className="px-4 py-3">
                    {c.status === 'active' ? (
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)}
                        aria-label={t('tooltip.select_animal', { tag: c.tag_number })}
                        className="w-4 h-4 rounded accent-emerald-500 cursor-pointer" />
                    ) : (
                      <span className="w-4 h-4 block" />
                    )}
                  </td>
                  <SerialCell index={i} page={page} perPage={15} />
                  <td className="px-4 py-3">
                    {c.profile_image_url ? (
                      c.profile_image_url.endsWith('.pdf') || c.profile_image_url.includes('/pdf') ? (
                        <a href={c.profile_image_url} target="_blank" rel="noreferrer"
                          className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                          <ImageIcon size={14} />
                        </a>
                      ) : (
                        <a href={c.profile_image_url} target="_blank" rel="noreferrer">
                          <img src={c.profile_image_url} alt={c.tag_number} loading="lazy"
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200" />
                        </a>
                      )
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                        <ImageIcon size={14} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{c.tag_number}</p>
                    {c.name && <p className="text-xs text-slate-400">{c.name}</p>}
                    {c.purpose && (
                      <span className={`inline-block mt-0.5 text-[11px] px-1.5 py-0.5 rounded-full font-medium ${PURPOSE_COLORS[c.purpose]}`}>
                        {t('breeding.purpose.' + c.purpose)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{animalTypeName(c.animal_type) ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.breed}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.gender === 'male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                      {t('gender.' + c.gender)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                      {(c as Cattle & { age_category?: { name?: string } }).age_category?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.current_weight ?? c.purchase_weight ?? c.birth_weight ?? '—'}
                    <span className="text-slate-400 text-xs"> / {c.purchase_weight ?? c.birth_weight ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {parseFloat(c.feed_ratio) > 0 ? (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        {parseFloat(c.feed_ratio)}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">{t('common:ui.auto')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.purchase_price !== null
                      ? fmtMoney(c.purchase_price)
                      : <span className="text-xs bg-lime-50 text-lime-700 px-2 py-0.5 rounded-full font-medium">{t('breeding.born_badge')}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t('status.' + c.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEALTH_STATUS_COLORS[c.health_status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t('health_status.' + c.health_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{c.shed?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {c.invoice_file_url && (
                        <a href={c.invoice_file_url} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400" title={t('tooltip.view_invoice')}>
                          <FileText size={14} />
                        </a>
                      )}
                      <Link href={`/farm/cattle/${c.id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                        <Eye size={14} />
                      </Link>
                      {hasPermission('farm.cattle.edit') && c.status === 'active' && (
                        <button onClick={() => openEdit(c)} aria-label={t('common:btn.edit')} title={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                          <Pencil size={14} />
                        </button>
                      )}
                      {hasPermission('farm.sales.create') && c.status === 'active' && (
                        <button onClick={() => { setSelectedIds(new Set([c.id])); resetSaleModal(); setShowSaleBulk(true); }}
                          className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-400" title={t('tooltip.sell_cattle')}>
                          <ShoppingCart size={14} />
                        </button>
                      )}
                      {isSuperAdmin && (
                        <button onClick={() => { setDeleteTarget(c); setDeleteConfirmText(''); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.total ?? 0) > 0 && (
          <TablePagination page={page} lastPage={data?.last_page ?? 1} total={data?.total} perPage={15}
            onPageChange={p => { setPage(p); clearSelection(); }} />
        )}
      </div>

      {showMilkEntry && <MilkEntryModal cattleIds={milkFor} onClose={() => setShowMilkEntry(false)} />}
      {milkCheckRows && (
        <MilkSelectionWarning rows={milkCheckRows} onRemove={removeFromSelection} onClose={() => setMilkCheckRows(null)} />
      )}
      {showExpenseBulk && (
        <BulkExpenseModal cattle={selectedCattleList} onClose={() => setShowExpenseBulk(false)}
          onSaved={() => { setShowExpenseBulk(false); clearSelection(); }} />
      )}

      {pickFor && (
        <CattlePickerModal
          title={t(`picker.title.${pickFor}`)}
          icon={{ medicine: FlaskConical, vaccine: Syringe, treatment: Activity, sell: ShoppingCart }[pickFor]}
          onClose={() => setPickFor(null)}
          onConfirm={animals => {
            setPickedCattle(animals);
            setSelectedIds(new Set(animals.map(c => c.id)));
            setPickFor(null);
            openBulk(pickFor);
          }}
        />
      )}

      <BulkMedicineModal
        open={showMedBulk}
        onClose={() => setShowMedBulk(false)}
        selectedIds={selectedIds}
        selectedCattleList={selectedCattleList}
        medItems={medItems}
        setMedItems={setMedItems}
        medDate={medDate}
        setMedDate={setMedDate}
        medNotes={medNotes}
        setMedNotes={setMedNotes}
        medBulkError={medBulkError}
        medBulkErrors={medBulkErrors}
        setMedBulkErrors={setMedBulkErrors}
        medBulkSaving={medBulkSaving}
        medsNonVaccine={medsNonVaccine}
        getLineMed={getLineMed}
        getLineQty={getLineQty}
        lineHasStock={lineHasStock}
        onSubmit={handleMedBulkSubmit}
      />

      <BulkVaccineModal
        open={showVaxBulk}
        onClose={() => setShowVaxBulk(false)}
        selectedIds={selectedIds}
        selectedCattleList={selectedCattleList}
        vaxItems={vaxItems}
        setVaxItems={setVaxItems}
        vaxDate={vaxDate}
        setVaxDate={setVaxDate}
        vaxAdminBy={vaxAdminBy}
        setVaxAdminBy={setVaxAdminBy}
        vaxNotes={vaxNotes}
        setVaxNotes={setVaxNotes}
        vaxBulkError={vaxBulkError}
        vaxBulkErrors={vaxBulkErrors}
        setVaxBulkErrors={setVaxBulkErrors}
        vaxBulkSaving={vaxBulkSaving}
        vaccinesOnly={vaccinesOnly}
        getLineMed={getLineMed}
        getLineQty={getLineQty}
        lineHasStock={lineHasStock}
        onSubmit={handleVaxBulkSubmit}
      />

      <BulkTreatmentModal
        open={showTreatBulk}
        onClose={() => setShowTreatBulk(false)}
        selectedIds={selectedIds}
        selectedCattleList={selectedCattleList}
        perCattle={perCattle}
        perCattleFiles={perCattleFiles}
        perCattleErrors={perCattleErrors}
        updatePerCattle={updatePerCattle}
        setPerCattleFiles={setPerCattleFiles}
        treatDate={treatDate}
        setTreatDate={setTreatDate}
        treatPayAccId={treatPayAccId}
        setTreatPayAccId={setTreatPayAccId}
        treatDoctorName={treatDoctorName}
        setTreatDoctorName={setTreatDoctorName}
        treatDoctorPhone={treatDoctorPhone}
        setTreatDoctorPhone={setTreatDoctorPhone}
        treatVetFee={treatVetFee}
        setTreatVetFee={setTreatVetFee}
        treatNotes={treatNotes}
        setTreatNotes={setTreatNotes}
        treatBulkError={treatBulkError}
        treatBulkErrors={treatBulkErrors}
        setTreatBulkErrors={setTreatBulkErrors}
        treatBulkSaving={treatBulkSaving}
        paymentAccounts={paymentAccountsData?.payment_accounts ?? []}
        onSubmit={handleTreatBulkSubmit}
      />

      <BulkSaleModal
        open={showSaleBulk}
        onCloseForm={() => setShowSaleBulk(false)}
        onCloseSuccess={() => { setShowSaleBulk(false); resetSaleModal(); }}
        selectedIds={selectedIds}
        selectedCattleList={selectedCattleList}
        saleDate={saleDate}
        setSaleDate={setSaleDate}
        salePaymentAccountId={salePaymentAccountId}
        setSalePaymentAccountId={setSalePaymentAccountId}
        saleNotes={saleNotes}
        setSaleNotes={setSaleNotes}
        saleBuyerMode={saleBuyerMode}
        setSaleBuyerMode={setSaleBuyerMode}
        saleCustomerId={saleCustomerId}
        setSaleCustomerId={setSaleCustomerId}
        saleNewName={saleNewName}
        setSaleNewName={setSaleNewName}
        saleNewPhone={saleNewPhone}
        setSaleNewPhone={setSaleNewPhone}
        saleNewAddress={saleNewAddress}
        setSaleNewAddress={setSaleNewAddress}
        salePaymentStatus={salePaymentStatus}
        setSalePaymentStatus={setSalePaymentStatus}
        salePaidAmount={salePaidAmount}
        setSalePaidAmount={setSalePaidAmount}
        salePrices={salePrices}
        setSalePrices={setSalePrices}
        saleBulkError={saleBulkError}
        saleBulkErrors={saleBulkErrors}
        setSaleBulkErrors={setSaleBulkErrors}
        saleBulkSaving={saleBulkSaving}
        invoiceData={invoiceData}
        customersAll={customersAll}
        paymentAccounts={paymentAccountsData?.payment_accounts ?? []}
        onSubmit={handleSaleBulkSubmit}
        onPrintInvoice={handlePrintInvoice}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} dirty={false} size="md"
          title={t('modal.delete_title')} icon={<Trash2 size={18} className="text-red-500" />}
          footer={<>
            <button type="button" onClick={() => setDeleteTarget(null)} className={btnSecondary}>
              {t('common:btn.cancel')}
            </button>
            <button
              type="button"
              disabled={deleteConfirmText !== deleteTarget.tag_number || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50">
              <Trash2 size={14} />
              {deleteMutation.isPending ? t('common:status.loading') : t('modal.delete_btn')}
            </button>
          </>}>
          <div className="px-4 sm:px-6 py-5 space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700"
              dangerouslySetInnerHTML={{ __html: t('modal.delete_desc', { tag: deleteTarget.tag_number }) }} />
            <div>
              <label htmlFor="delete-confirm-tag" className="block text-xs font-medium text-slate-600 mb-1"
                dangerouslySetInnerHTML={{ __html: t('modal.delete_type_tag', { tag: deleteTarget.tag_number }) }} />
              <input
                id="delete-confirm-tag"
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={deleteTarget.tag_number}
                autoComplete="off"
                className={fieldClass(false, 'focus:ring-red-400')}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Add / edit animal */}
      {showModal && (
        <CattleFormModal
          editCattle={editCattle}
          editLoading={editLoading}
          form={form}
          setForm={setForm}
          formError={formError}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          animalTypes={animalTypesData}
          selectedAnimalType={selectedAnimalType}
          breeds={breedsData}
          breedFallbackId={breedFields.breed_id}
          sheds={shedsData}
          parentOptions={parentOptions}
          ageStages={ageStages}
          ageStagesLoading={ageStagesLoading}
          ageCategories={ageCategories}
          ageCategoriesLoading={ageCategoriesLoading}
          paymentAccounts={paymentAccountsData?.payment_accounts ?? []}
          tagLoading={tagLoading}
          profileImageFile={profileImageFile}
          profileImagePreview={profileImagePreview}
          fileInputRef={fileInputRef}
          onImageChange={handleImageChange}
          invoiceFile={invoiceFile}
          setInvoiceFile={setInvoiceFile}
          invoiceFileRef={invoiceFileRef}
          canRemoveInvoice={hasPermission('farm.cattle.edit')}
          onRemoveInvoice={() => editCattle && removeInvoiceMutation.mutate(editCattle.id)}
          isPending={isPending}
          onClose={() => closeModal()}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
