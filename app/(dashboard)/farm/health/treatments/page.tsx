'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Treatment, Cattle, CattleHealthStatus, AccountingPaymentAccount } from '@/types';
import { Plus, Trash2, Pencil, Users } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { MONEY_KEYS, invalidateMoney } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import EditTreatmentModal from '@/components/health/treatments/EditTreatmentModal';
import { apiFieldErrors } from '@/lib/hooks/useFormErrors';
import CreateTreatmentModal from '@/components/health/treatments/CreateTreatmentModal';
import BulkCreateTreatmentModal from '@/components/health/treatments/BulkCreateTreatmentModal';
import { useAutoOpen } from '@/lib/hooks/useAutoOpen';
import TrashLink from '@/components/ui/TrashLink';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type TFn = (key: string, options?: Record<string, unknown>) => string;

const HEALTH_STATUS_BADGE: Record<CattleHealthStatus, string> = {
  sick:       'bg-orange-100 text-orange-700',
  critical:   'bg-red-100 text-red-700',
  recovering: 'bg-blue-100 text-blue-700',
  healthy:    'bg-green-100 text-green-700',
};

const getHealthStatusLabel = (t: TFn): Record<CattleHealthStatus, string> => ({
  sick:       t('treatments.health_status_label.sick'),
  critical:   t('treatments.health_status_label.critical'),
  recovering: t('treatments.health_status_label.recovering'),
  healthy:    t('treatments.health_status_label.healthy'),
});

const EMPTY_FORM = {
  cattle_id: '', treatment_date: localToday(),
  doctor_name: '', doctor_phone: '', medicines_used: '', vet_fee: '', follow_up_date: '',
  diagnosis: '', treatment: '', notes: '',
  payment_account_id: '',
  prescription: '',
  health_status: 'sick' as CattleHealthStatus,
};

const treatmentsApi = createCrudService<Treatment, { data: Treatment[]; last_page: number; total: number }>('/farm/health/treatments');
const treatmentsKeys = createResourceKeys('treatments');

const EMPTY_BULK_FORM = {
  treatment_date: localToday(),
  doctor_name: '', doctor_phone: '', medicines_used: '', vet_fee: '', follow_up_date: '',
  diagnosis: '', treatment: '', notes: '',
  payment_account_id: '',
  prescription: '',
  health_status: 'sick' as CattleHealthStatus,
};

export default function TreatmentsPage() {
  const { t } = useTranslation(['health', 'common']);
  const { t: tc } = useTranslation('common');
  const HEALTH_STATUS_LABEL = getHealthStatusLabel(t);
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);

  // Single treatment modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);

  // Bulk treatment modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({ ...EMPTY_BULK_FORM });
  const [selectedCattleIds, setSelectedCattleIds] = useState<number[]>([]);
  const [cattleSearch, setCattleSearch] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<Treatment | null>(null);
  const [editForm, setEditForm] = useState({
    treatment_date: '', doctor_name: '', doctor_phone: '',
    diagnosis: '', treatment: '', medicines_used: '',
    vet_fee: '', follow_up_date: '', notes: '', prescription: '',
    health_status: 'sick' as CattleHealthStatus,
  });
  const [editError, setEditError] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isEditSaving, setIsEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Treatment | null>(null);

  const resource = useCrudResource(treatmentsApi, treatmentsKeys, {
    extraInvalidateKeys: [...MONEY_KEYS, ['cattle-active'], ['cattle-treatments'], ['treatments-trash']],
  });
  const { data, isLoading } = resource.useList({ ...sorting.params, page, per_page: 15 });

  const { data: cattleData } = useQuery<{ cattle: Cattle[] }>({
    queryKey: ['cattle-active'],
    queryFn: async () => (await api.get('/farm/cattle/all')).data,
  });

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const deleteMutation = resource.useRemove({
    onSuccess: (res) => {
      setDeleteTarget(null);
      toast.success(res.message ?? t('treatments.toast.moved_to_trash'));
    },
    onError: (e) => { toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('treatments.toast.delete_failed')); },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.cattle_id) e.cattle_id = t('treatments.validation.cattle_required');
    if (!form.diagnosis.trim()) e.diagnosis = t('treatments.validation.diagnosis_required');
    if (!form.treatment_date) e.treatment_date = t('treatments.validation.treatment_date_required');
    if (!form.payment_account_id) e.payment_account_id = t('treatments.validation.payment_account_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateBulk = () => {
    const e: Record<string, string> = {};
    if (selectedCattleIds.length === 0) e.cattle_ids = t('treatments.validation.select_at_least_one_cattle');
    if (!bulkForm.diagnosis.trim()) e.diagnosis = t('treatments.validation.diagnosis_required');
    if (!bulkForm.treatment_date) e.treatment_date = t('treatments.validation.treatment_date_required');
    if (!bulkForm.payment_account_id) e.payment_account_id = t('treatments.validation.payment_account_required');
    setBulkErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    setIsSaving(true);
    try {
      let res;
      if (prescriptionFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v); });
        fd.append('receipt_file', prescriptionFile);
        res = await api.post('/farm/health/treatments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        res = await api.post('/farm/health/treatments', form);
      }
      invalidateMoney(qc, [['treatments'], ['cattle-active'], ['cattle-treatments']]);
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      setPrescriptionFile(null);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? t('treatments.toast.created'));
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const backendErrors = e.response?.data?.errors;
      if (backendErrors) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(backendErrors).forEach(([field, msgs]) => { fieldErrors[field] = msgs[0]; });
        setErrors(prev => ({ ...prev, ...fieldErrors }));
      }
      setFormError(e.response?.data?.message ?? t('treatments.toast.save_failed'));
      toast.error(e.response?.data?.message ?? t('treatments.toast.create_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBulk()) return;
    setBulkError('');
    setIsBulkSaving(true);
    try {
      const payload = {
        ...bulkForm,
        cattle_ids: selectedCattleIds,
        vet_fee: bulkForm.vet_fee || undefined,
        follow_up_date: bulkForm.follow_up_date || null,
        doctor_name: bulkForm.doctor_name || null,
        doctor_phone: bulkForm.doctor_phone || null,
        medicines_used: bulkForm.medicines_used || null,
        notes: bulkForm.notes || null,
        prescription: bulkForm.prescription || null,
      };
      const res = await api.post('/farm/health/treatments/bulk', payload);
      invalidateMoney(qc, [['treatments'], ['cattle-active'], ['cattle-treatments']]);
      setShowBulkModal(false);
      setBulkForm({ ...EMPTY_BULK_FORM });
      setSelectedCattleIds([]);
      setCattleSearch('');
      toast.success((res as { data?: { message?: string } })?.data?.message ?? t('treatments.toast.bulk_created'));
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      const { fields, message } = apiFieldErrors(err, t('treatments.toast.bulk_save_failed'));
      setBulkErrors(fields);
      setBulkError(Object.keys(fields).length ? '' : message);
      toast.error(Object.values(fields)[0] ?? e.response?.data?.message ?? t('treatments.toast.bulk_create_failed'));
    } finally {
      setIsBulkSaving(false);
    }
  };

  const openEdit = (t: Treatment) => {
    setEditTarget(t);
    setEditForm({
      treatment_date: t.treatment_date.split('T')[0],
      doctor_name:    t.doctor_name ?? '',
      doctor_phone:   t.doctor_phone ?? '',
      diagnosis:      t.diagnosis ?? '',
      treatment:      t.treatment ?? '',
      medicines_used: t.medicines_used ?? '',
      vet_fee:        t.vet_fee ?? '',
      follow_up_date: t.follow_up_date ? t.follow_up_date.split('T')[0] : '',
      notes:          t.notes ?? '',
      prescription:   t.prescription ?? '',
      health_status:  t.health_status ?? 'sick',
    });
    setEditError('');
    setEditErrors({});
  };

  const updateMutation = resource.useUpdate();

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    // Our own check first: the date is the one required field.
    if (!editForm.treatment_date) { setEditErrors({ treatment_date: t('treatments.validation.treatment_date_required') }); return; }
    setEditError(''); setEditErrors({}); setIsEditSaving(true);
    try {
      const payload: Record<string, string | null> = {
        treatment_date: editForm.treatment_date,
        doctor_name:    editForm.doctor_name   || null,
        doctor_phone:   editForm.doctor_phone  || null,
        diagnosis:      editForm.diagnosis     || null,
        treatment:      editForm.treatment     || null,
        medicines_used: editForm.medicines_used || null,
        vet_fee:        editForm.vet_fee        || null,
        follow_up_date: editForm.follow_up_date || null,
        notes:          editForm.notes          || null,
        prescription:   editForm.prescription   || null,
        health_status:  editForm.health_status,
      };
      await updateMutation.mutateAsync({ id: editTarget.id, payload });
      toast.success(t('treatments.toast.updated'));
      setEditTarget(null);
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, t('treatments.toast.update_failed'));
      setEditErrors(fields);
      setEditError(Object.keys(fields).length ? '' : message);
      toast.error(Object.values(fields)[0] ?? message);
    } finally { setIsEditSaving(false); }
  };

  const openModal = () => {
    const defaultAccId = paymentAccountsData?.payment_accounts.find(p => p.is_default)?.id?.toString() ?? '';
    setForm({ ...EMPTY_FORM, treatment_date: localToday(), payment_account_id: defaultAccId });
    setFormError('');
    setErrors({});
    setPrescriptionFile(null);
    setShowModal(true);
  };

  const openBulkModal = () => {
    const defaultAccId = paymentAccountsData?.payment_accounts.find(p => p.is_default)?.id?.toString() ?? '';
    setBulkForm({ ...EMPTY_BULK_FORM, treatment_date: localToday(), payment_account_id: defaultAccId });
    setSelectedCattleIds([]);
    setCattleSearch('');
    setBulkError('');
    setBulkErrors({});
    setShowBulkModal(true);
  };

  // ?new=1 opens the single form, ?new=bulk the several-animals one — once the default account is known.
  useAutoOpen(value => {
    if (!hasPermission('farm.health.create')) return;
    if (value === 'bulk') openBulkModal(); else openModal();
  }, !!paymentAccountsData);

  const toggleCattle = (id: number) => {
    setSelectedCattleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const filtered = filteredCattle.map(c => c.id);
    const allSelected = filtered.every(id => selectedCattleIds.includes(id));
    if (allSelected) {
      setSelectedCattleIds(prev => prev.filter(id => !filtered.includes(id)));
    } else {
      setSelectedCattleIds(prev => Array.from(new Set([...prev, ...filtered])));
    }
  };

  const treatments      = data?.data ?? [];
  const activeCattle    = cattleData?.cattle ?? [];
  const paymentAccounts = paymentAccountsData?.payment_accounts ?? [];
  const vetFee          = parseFloat(form.vet_fee) || 0;
  const bulkVetFee      = parseFloat(bulkForm.vet_fee) || 0;

  const filteredCattle = cattleSearch.trim()
    ? activeCattle.filter(c =>
        c.tag_number.toLowerCase().includes(cattleSearch.toLowerCase()) ||
        (c.name ?? '').toLowerCase().includes(cattleSearch.toLowerCase())
      )
    : activeCattle;

  const cols: ColDef<Treatment>[] = [
    { key: 'date', labelKey: 'health:treatments.col.date', align: 'left', sortKey: 'date', sortType: 'date', render: treatment => <span className="text-slate-500">{new Date(treatment.treatment_date).toLocaleDateString(localeFor())}</span> },
    { key: 'cattle', labelKey: 'health:treatments.col.cattle', align: 'left', render: treatment => <span className="font-medium text-slate-700">{treatment.cattle?.tag_number}</span> },
    { key: 'diagnosis', labelKey: 'health:treatments.col.diagnosis', align: 'left', render: treatment => <span className="text-slate-700 max-w-[180px] truncate block">{treatment.diagnosis}</span> },
    {
      key: 'health_status', labelKey: 'health:treatments.col.health_status', align: 'left',
      render: treatment => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${HEALTH_STATUS_BADGE[treatment.health_status ?? 'sick']}`}>
          {HEALTH_STATUS_LABEL[treatment.health_status ?? 'sick']}
        </span>
      ),
    },
    { key: 'doctor', labelKey: 'health:treatments.col.doctor', align: 'left', render: treatment => <span className="text-slate-500">{treatment.doctor_name || '—'}</span> },
    { key: 'medicines_used', labelKey: 'health:treatments.field.medicines_used', align: 'left', render: treatment => <span className="text-slate-500 max-w-[160px] truncate block">{treatment.medicines_used || '—'}</span> },
    { key: 'vet_fee', labelKey: 'health:treatments.col.vet_fee', align: 'right', sortKey: 'vet_fee', sortType: 'number', render: treatment => <span className="font-medium text-slate-800">{fmtMoney(treatment.vet_fee ?? '0')}</span> },
    {
      key: '_actions', labelKey: '', align: 'right',
      render: treatment => (
        <div className="flex justify-end gap-1">
          {hasPermission('farm.health.edit') && (
            <button onClick={() => openEdit(treatment)} aria-label={tc('btn.edit')} title={tc('btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400">
              <Pencil size={14} />
            </button>
          )}
          {isSuperAdmin && (
            <button onClick={() => setDeleteTarget(treatment)} aria-label={tc('btn.move_to_trash')} title={tc('btn.move_to_trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
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
        <h1 className="text-xl font-bold text-slate-800">{t('treatments.title')}</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto [&>*]:whitespace-nowrap">
          {isSuperAdmin && (
            <TrashLink href="/farm/health/treatments/trash" />
          )}
          {hasPermission('farm.health.create') && (
            <>
              <button onClick={openBulkModal}
                className="flex items-center gap-2 border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
                <Users size={16} /> {t('treatments.btn.bulk_add')}
              </button>
              <button onClick={openModal}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
                <Plus size={16} /> {t('treatments.btn.add')}
              </button>
            </>
          )}
        </div>
      </div>

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={treatments}
        isLoading={isLoading}
        keyExtractor={treatment => treatment.id}
        emptyKey="health:treatments.empty"
        currentPage={page}
        lastPage={data?.last_page ?? 1}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('treatments.confirm.move_to_trash_title')}
        message={t('treatments.confirm.move_to_trash_message', { diagnosis: deleteTarget?.diagnosis || t('treatments.confirm.this_record') })}
        confirmLabel={t('treatments.confirm.move_to_trash_label')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ══ Edit Modal ══ */}
      {editTarget && (
        <EditTreatmentModal
          treatment={editTarget}
          editForm={editForm}
          setEditForm={setEditForm}
          editError={editError}
          editErrors={editErrors}
          isEditSaving={isEditSaving}
          onClose={() => setEditTarget(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* ══ Single Treatment Modal ══ */}
      <CreateTreatmentModal
        open={showModal}
        onClose={() => { setShowModal(false); setPrescriptionFile(null); }}
        form={form}
        setForm={setForm}
        formError={formError}
        errors={errors}
        setErrors={setErrors}
        prescriptionFile={prescriptionFile}
        setPrescriptionFile={setPrescriptionFile}
        isSaving={isSaving}
        activeCattle={activeCattle}
        paymentAccounts={paymentAccounts}
        vetFee={vetFee}
        onSubmit={handleSubmit}
      />

      {/* ══ Bulk Treatment Modal ══ */}
      <BulkCreateTreatmentModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        bulkForm={bulkForm}
        setBulkForm={setBulkForm}
        bulkError={bulkError}
        bulkErrors={bulkErrors}
        setBulkErrors={setBulkErrors}
        isBulkSaving={isBulkSaving}
        selectedCattleIds={selectedCattleIds}
        toggleCattle={toggleCattle}
        selectAllFiltered={selectAllFiltered}
        cattleSearch={cattleSearch}
        setCattleSearch={setCattleSearch}
        filteredCattle={filteredCattle}
        activeCattle={activeCattle}
        paymentAccounts={paymentAccounts}
        healthStatusBadge={HEALTH_STATUS_BADGE}
        healthStatusLabel={HEALTH_STATUS_LABEL}
        bulkVetFee={bulkVetFee}
        onSubmit={handleBulkSubmit}
      />
    </div>
  );
}
