'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { localeFor } from '@/lib/languages';
import api from '@/lib/api';
import { animalTypeName } from '@/lib/animalType';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Scale, BookOpen,
  Beef, Calendar, DollarSign, FileText, Pencil,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { MEDICINE_STOCK_KEYS, invalidateMoney } from '@/lib/invalidateGroups';
import type { Byproduct, CattleWeight, CattleLedgerEntry, CattleFeedRatioHistory, AgeTransitionHistory, VaccineSchedule, Treatment, CattleHealthStatus } from '@/types';
import AddVaccineModal from '@/components/cattle/detail/AddVaccineModal';
import AddMedicineModal from '@/components/cattle/detail/AddMedicineModal';
import RecordWeightModal from '@/components/cattle/detail/RecordWeightModal';
import ChangeFeedRatioModal from '@/components/cattle/detail/ChangeFeedRatioModal';
import TreatmentModal from '@/components/cattle/detail/TreatmentModal';
import SellModal from '@/components/cattle/detail/SellModal';
import { newDetailLine } from '@/components/cattle/detail/types';
import type { DetailLineItem } from '@/components/cattle/detail/types';
import OverviewTab from '@/components/cattle/detail/tabs/OverviewTab';
import WeightHistoryTab from '@/components/cattle/detail/tabs/WeightHistoryTab';
import FeedRatioTab from '@/components/cattle/detail/tabs/FeedRatioTab';
import MedicineTab from '@/components/cattle/detail/tabs/MedicineTab';
import VaccinesTab from '@/components/cattle/detail/tabs/VaccinesTab';
import TreatmentsTab from '@/components/cattle/detail/tabs/TreatmentsTab';
import AgeTransitionTab from '@/components/cattle/detail/tabs/AgeTransitionTab';
import CostLedgerTab from '@/components/cattle/detail/tabs/CostLedgerTab';
import ProfitAnalysisTab from '@/components/cattle/detail/tabs/ProfitAnalysisTab';
import PedigreeTab from '@/components/cattle/detail/tabs/PedigreeTab';
import BreedingHistoryTab from '@/components/cattle/detail/tabs/BreedingHistoryTab';
import DairyTab from '@/components/cattle/detail/tabs/DairyTab';
import ByproductTab from '@/components/cattle/detail/tabs/ByproductTab';
import ChangePurposeModal from '@/components/cattle/detail/ChangePurposeModal';
import BirthValueModal from '@/components/cattle/detail/BirthValueModal';
import CattleExitModal from '@/components/cattle/detail/CattleExitModal';
import { AGE_CATEGORY_COLORS } from '@/components/cattle/detail/tabs/types';
import type { CattleDetail, MedUsage } from '@/components/cattle/detail/tabs/types';
import { useRouteId } from '@/lib/hooks';
import CollarPanel from '@/components/collar/CollarPanel';
import type { CollarOverview } from '@/components/collar/types';
import { failedMsg } from '@/lib/feedback';
import { apiFieldErrors } from '@/lib/hooks/useFormErrors';
import { localDateStr } from '@/lib/dates';
import { fmtNum, fmtMoney, fmtDate } from '@/lib/format';

const STATUS_COLORS: Record<string, string> = {
  active:      'bg-green-50 text-green-700',
  sold:        'bg-blue-50 text-blue-700',
  dead:        'bg-red-50 text-red-700',
  transferred: 'bg-orange-50 text-orange-700',
};

type TabType = 'overview' | 'pedigree' | 'breeding' | 'dairy' | 'byproducts' | 'weights' | 'feed-ratio' | 'medicine' | 'vaccines' | 'treatments' | 'age-transition' | 'ledger' | 'profit' | 'collar';

export default function CattleDetailPage() {
  const { t } = useTranslation('cattle');

  const TABS: { key: TabType; label: string }[] = [
    { key: 'overview',       label: t('detail.overview') },
    { key: 'pedigree',       label: t('breeding.tab_pedigree') },
    { key: 'breeding',       label: t('breeding:history.tab') },
    { key: 'dairy',          label: t('dairy:history.tab') },
    { key: 'byproducts',     label: t('byproducts:history.tab') },
    { key: 'weights',        label: t('detail.weight_history') },
    { key: 'feed-ratio',     label: t('detail.feed_ratio') },
    { key: 'medicine',       label: t('detail.medicine') },
    { key: 'vaccines',       label: t('detail.vaccines') },
    { key: 'treatments',     label: t('detail.treatments') },
    { key: 'age-transition', label: t('detail.age_history') },
    { key: 'ledger',         label: t('detail.cost_ledger') },
    { key: 'profit',         label: t('detail.profit_analysis') },
    { key: 'collar',         label: t('collar.tab_label') },
  ];


  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const id = useRouteId();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showPurposeModal, setShowPurposeModal] = useState(false);
  const [showBirthValue, setShowBirthValue] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);

  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightForm, setWeightForm] = useState({ weight_date: localDateStr(), weight: '', notes: '' });
  const [weightError, setWeightError] = useState('');
  const [weightModalFeedRatio, setWeightModalFeedRatio] = useState('');
  const [weightSaving, setWeightSaving] = useState(false);

  const [showRatioModal, setShowRatioModal] = useState(false);
  const [ratioForm, setRatioForm] = useState({ feed_ratio: '0', effective_date: localDateStr(), notes: '' });
  const [ratioError, setRatioError] = useState('');
  // Per-field errors from the server, shown under the fields of each modal.
  const [serverErrors, setServerErrors] = useState<Record<string, Record<string, string>>>({});
  const setModalErrors = (modal: string, fields: Record<string, string> = {}) => setServerErrors(p => ({ ...p, [modal]: fields }));

  const toast = useToast();
  const TODAY = localDateStr();

  // Vaccine modal state
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [vaccineError, setVaccineError]         = useState('');
  const [vaccineSaving, setVaccineSaving]       = useState(false);
  const [vaxItems, setVaxItems]                 = useState<DetailLineItem[]>([newDetailLine()]);
  const [vaxDate, setVaxDate]                   = useState(TODAY);
  const [vaxAdminBy, setVaxAdminBy]             = useState('');
  const [vaxNotes, setVaxNotes]                 = useState('');

  // Sell modal state
  const [showSellModal, setShowSellModal]         = useState(false);
  const [sellSaving, setSellSaving]               = useState(false);
  const [sellError, setSellError]                 = useState('');
  const [sellDate, setSellDate]                   = useState(TODAY);
  const [sellPaymentAccountId, setSellPaymentAccountId] = useState('');
  const [sellNotes, setSellNotes]                 = useState('');
  const [sellBuyerMode, setSellBuyerMode]         = useState<'existing' | 'new'>('existing');
  const [sellCustomerId, setSellCustomerId]       = useState('');
  const [sellNewName, setSellNewName]             = useState('');
  const [sellNewPhone, setSellNewPhone]           = useState('');
  const [sellNewAddress, setSellNewAddress]       = useState('');
  const [sellPaymentStatus, setSellPaymentStatus] = useState<'paid' | 'partial' | 'unpaid'>('paid');
  const [sellPaidAmount, setSellPaidAmount]       = useState('');
  const [sellPrice, setSellPrice]                 = useState('');
  const [sellWeight, setSellWeight]               = useState('');

  // Medicine modal state
  const [showMedModal, setShowMedModal]   = useState(false);
  const [medError, setMedError]           = useState('');
  const [medSaving, setMedSaving]         = useState(false);
  const [medItems, setMedItems]           = useState<DetailLineItem[]>([newDetailLine()]);
  const [medDate, setMedDate]             = useState(TODAY);
  const [medNextDue, setMedNextDue]       = useState('');
  const [medNotes, setMedNotes]           = useState('');

  // Treatment modal state
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({
    treatment_date: TODAY, doctor_name: '', doctor_phone: '', medicines_used: '', vet_fee: '',
    follow_up_date: '', diagnosis: '', treatment: '', notes: '', prescription: '',
    payment_account_id: '', health_status: 'sick' as CattleHealthStatus,
  });
  const [treatmentFormError, setTreatmentFormError] = useState('');
  const [treatmentErrors, setTreatmentErrors] = useState<Record<string, string>>({});
  const [treatmentPrescriptionFile, setTreatmentPrescriptionFile] = useState<File | null>(null);
  const [treatmentSaving, setTreatmentSaving] = useState(false);

  /** Field errors under their fields; the top message only when there is nothing to put under a field. */
  const showApiErrors = (modal: string, err: unknown, setTop: (m: string) => void, fallback: string, mapKey: (k: string) => string = k => k) => {
    const { fields, message } = apiFieldErrors(err, fallback);
    const mapped: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) mapped[mapKey(k)] = mapped[mapKey(k)] ?? v;
    setModalErrors(modal, mapped);
    setTop(Object.keys(mapped).length ? '' : message);
  };
  /** The API numbers only the rows it was sent: `items.1.quantity_used` → the row on screen. */
  const rowKey = (sent: DetailLineItem[], all: DetailLineItem[]) => (k: string) => {
    const m = k.match(/^items\.(\d+)\./);
    return m ? `items.${all.indexOf(sent[Number(m[1])])}` : k;
  };

  const resetVaxModal = () => { setVaxItems([newDetailLine()]); setVaxDate(TODAY); setVaxAdminBy(''); setVaxNotes(''); setVaccineError(''); };
  const resetMedModal = () => { setMedItems([newDetailLine()]); setMedDate(TODAY); setMedNextDue(''); setMedNotes(''); setMedError(''); };
  const openSellModal = () => {
    setSellDate(TODAY); setSellPaymentAccountId(''); setSellNotes('');
    setSellBuyerMode('existing'); setSellCustomerId('');
    setSellNewName(''); setSellNewPhone(''); setSellNewAddress('');
    setSellPaymentStatus('paid'); setSellPaidAmount('');
    setSellPrice(''); setSellWeight(''); setSellError(''); setShowSellModal(true);
  };

  const openTreatmentModal = () => {
    const defaultAccId = (paymentAccountsData?.payment_accounts ?? []).find(p => p.is_default)?.id?.toString() ?? '';
    setTreatmentForm({
      treatment_date: TODAY, doctor_name: '', doctor_phone: '', medicines_used: '', vet_fee: '',
      follow_up_date: '', diagnosis: '', treatment: '', notes: '', prescription: '',
      payment_account_id: defaultAccId, health_status: 'sick',
    });
    setTreatmentFormError('');
    setTreatmentErrors({});
    setTreatmentPrescriptionFile(null);
    setShowTreatmentModal(true);
  };

  const handleTreatmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!treatmentForm.diagnosis.trim()) errs.diagnosis = t('detail.modal.treatment.validation.diagnosis_required');
    if (!treatmentForm.treatment_date) errs.treatment_date = t('detail.modal.treatment.validation.date_required');
    if (!treatmentForm.payment_account_id) errs.payment_account_id = t('detail.modal.treatment.validation.payment_account_required');
    if (Object.keys(errs).length > 0) { setTreatmentErrors(errs); return; }
    setTreatmentFormError('');
    setTreatmentSaving(true);
    try {
      let res;
      const payload = { ...treatmentForm, cattle_id: id };
      if (treatmentPrescriptionFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => { if (v !== '') fd.append(k, v as string); });
        fd.append('receipt_file', treatmentPrescriptionFile);
        res = await api.post('/farm/health/treatments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        res = await api.post('/farm/health/treatments', payload);
      }
      invalidateMoney(qc, [['cattle-treatments', id], ['cattle-ledger', id], ['cattle', id], ['treatments'], ['farm-cattle']]);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? t('detail.modal.treatment.toast.saved'));
      setShowTreatmentModal(false);
      setTreatmentPrescriptionFile(null);
      setTreatmentForm({ treatment_date: TODAY, doctor_name: '', doctor_phone: '', medicines_used: '', vet_fee: '', follow_up_date: '', diagnosis: '', treatment: '', notes: '', prescription: '', payment_account_id: '', health_status: 'sick' });
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const backendErrors = e.response?.data?.errors;
      if (backendErrors) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(backendErrors).forEach(([field, msgs]) => { fieldErrors[field] = msgs[0]; });
        setTreatmentErrors(prev => ({ ...prev, ...fieldErrors }));
      }
      setTreatmentFormError(e.response?.data?.message ?? t('detail.modal.treatment.toast.save_failed'));
      toast.error(e.response?.data?.message ?? t('detail.modal.treatment.toast.save_failed'));
    } finally {
      setTreatmentSaving(false);
    }
  };

  const handleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellError(''); setModalErrors('sell');
    if (!sellDate) { setSellError(t('detail.modal.sell.validation.date_required')); return; }
    if (!sellPrice || parseFloat(sellPrice) <= 0) { setSellError(t('detail.modal.sell.validation.price_required')); return; }
    if (!sellPaymentAccountId) { setSellError(t('detail.modal.sell.validation.account_required')); return; }
    if (sellBuyerMode === 'existing' && !sellCustomerId) { setSellError(t('detail.modal.sell.validation.buyer_required')); return; }
    if (sellBuyerMode === 'new' && !sellNewName.trim()) { setSellError(t('detail.modal.sell.validation.new_buyer_name_required')); return; }
    if (sellPaymentStatus === 'partial' && (!sellPaidAmount || parseFloat(sellPaidAmount) <= 0)) {
      setSellError(t('detail.modal.sell.validation.partial_amount_required')); return;
    }

    setSellSaving(true);
    try {
      const res = await api.post('/farm/sales', {
        cattle_id:          id,
        customer_id:        sellBuyerMode === 'existing' ? sellCustomerId : null,
        new_customer:       sellBuyerMode === 'new' ? { name: sellNewName.trim(), phone: sellNewPhone || null, address: sellNewAddress || null } : null,
        sale_date:          sellDate,
        sale_price:         parseFloat(sellPrice),
        sale_weight:        sellWeight ? parseFloat(sellWeight) : null,
        payment_account_id: sellPaymentAccountId,
        payment_status:     sellPaymentStatus,
        paid_amount:        sellPaymentStatus === 'partial' ? parseFloat(sellPaidAmount) : null,
        notes:              sellNotes || null,
      });
      invalidateMoney(qc, [['cattle', id], ['farm-cattle'], ['cattle-sales'], ['sales-summary']]);
      toast.success(res?.data?.message ?? t('detail.modal.sell.toast.success'));
      setShowSellModal(false);
    } catch (err) {
      showApiErrors('sell', err, setSellError, t('detail.modal.sell.toast.failed'));
    } finally { setSellSaving(false); }
  };

  const { data: cattleData, isLoading: cattleLoading } = useQuery<{ cattle: CattleDetail; total_cost: number; breakdown: Record<string, number> }>({
    queryKey: ['cattle', id],
    queryFn: async () => (await api.get(`/farm/cattle/${id}`)).data,
    enabled: !!id && id !== '0',
  });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery<{ entries: { data: CattleLedgerEntry[]; last_page: number; total: number }; total_cost: number; breakdown: Record<string, number> }>({
    queryKey: ['cattle-ledger', id, ledgerPage],
    queryFn: async () => (await api.get(`/farm/cattle/${id}/ledger`, { params: { page: ledgerPage, per_page: 20 } })).data,
    enabled: !!id && id !== '0' && activeTab === 'ledger',
  });

  const { data: weightsData, isLoading: weightsLoading } = useQuery<{ data: CattleWeight[]; last_page: number }>({
    queryKey: ['cattle-weights', id],
    queryFn: async () => (await api.get(`/farm/cattle/${id}/weights`, { params: { per_page: 50 } })).data,
    enabled: !!id && id !== '0' && activeTab === 'weights',
  });

  const { data: ratioHistoryData, isLoading: ratioLoading } = useQuery<{ history: CattleFeedRatioHistory[]; current_ratio: string }>({
    queryKey: ['cattle-feed-ratio', id],
    queryFn: async () => (await api.get(`/farm/cattle/${id}/feed-ratio-history`)).data,
    enabled: !!id && id !== '0' && activeTab === 'feed-ratio',
  });

  const { data: medicineData, isLoading: medicineLoading, isError: medicineError } = useQuery<{ data: MedUsage[] }>({
    queryKey: ['cattle-medicine', id],
    queryFn: async () => (await api.get('/farm/medicine/usages', { params: { cattle_id: id, per_page: 50 } })).data,
    enabled: !!id && id !== '0' && activeTab === 'medicine',
  });

  const { data: vaccineData, isLoading: vaccineLoading } = useQuery<{ data: VaccineSchedule[] }>({
    queryKey: ['cattle-vaccines', id],
    queryFn: async () => (await api.get('/farm/health/vaccines', { params: { cattle_id: id, per_page: 50 } })).data,
    enabled: !!id && id !== '0' && activeTab === 'vaccines',
  });

  type MedItem = { id: number; name: string; remaining_quantity: number; fifo_unit_price?: number; unit?: { symbol: string } };
  const { data: medsAllData } = useQuery<MedItem[]>({
    queryKey: ['medicines-all'],
    queryFn: async () => ((await api.get('/farm/medicine/all')).data?.medicines ?? []) as MedItem[],
    enabled: showMedModal,
  });
  const medsAll: MedItem[] = Array.isArray(medsAllData) ? medsAllData : [];

  const { data: vaccinesOnlyData } = useQuery<MedItem[]>({
    queryKey: ['medicines-vaccines-only'],
    queryFn: async () => ((await api.get('/farm/medicine/all', { params: { is_vaccine: 1 } })).data?.medicines ?? []) as MedItem[],
    enabled: showVaccineModal,
  });
  const vaccinesOnly: MedItem[] = Array.isArray(vaccinesOnlyData) ? vaccinesOnlyData : [];

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: { id: number; name: string; type: string; balance: number; is_default?: boolean }[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
    enabled: showSellModal || showTreatmentModal,
  });

  const { data: sellCustomersData } = useQuery<{ id: number; name: string; phone?: string }[]>({
    queryKey: ['customers-all'],
    queryFn: async () => (await api.get('/customers/all')).data.customers,
    enabled: showSellModal,
  });
  const sellCustomers = sellCustomersData ?? [];

  const { data: treatmentData, isLoading: treatmentLoading } = useQuery<{ data: Treatment[] }>({
    queryKey: ['cattle-treatments', id],
    queryFn: async () => (await api.get('/farm/health/treatments', { params: { cattle_id: id, per_page: 50 } })).data,
    enabled: !!id && id !== '0' && activeTab === 'treatments',
  });

  const { data: ageTransitionData, isLoading: ageTransitionLoading } = useQuery<{ history: AgeTransitionHistory[]; current_category: string; current_category_id?: number; initial_age_category_id?: number; initial_age_category_name?: string; mature_age_category_id?: number; mature_age_category_name?: string }>({
    queryKey: ['cattle-age-transition', id],
    queryFn: async () => (await api.get(`/farm/cattle/${id}/age-transition-history`)).data,
    enabled: !!id && id !== '0' && activeTab === 'age-transition',
  });

  // Per-animal by-products (wool …) this animal's species gives — decides the by-products tab.
  const { data: byproductList } = useQuery<Byproduct[]>({
    queryKey: ['byproducts', 'products'],
    queryFn: async () => (await api.get('/farm/byproducts')).data.byproducts,
    enabled: hasPermission('farm.byproducts.view'),
  });

  // Smart collars — the tab only appears once the feature is switched on.
  const { data: collarOverview } = useQuery<CollarOverview>({
    queryKey: ['collar-overview'],
    queryFn: async () => (await api.get('/farm/collars')).data,
    staleTime: 5 * 60_000,
  });

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    setWeightError(''); setModalErrors('weight');
    setWeightSaving(true);
    try {
      // The new feed ratio goes with the weight: the server saves both, or neither.
      const withRatio = weightModalFeedRatio !== '' && parseFloat(weightModalFeedRatio) >= 0;
      await api.post(`/farm/cattle/${id}/weights`, { ...weightForm, ...(withRatio ? { feed_ratio: weightModalFeedRatio } : {}) });
      if (withRatio) qc.invalidateQueries({ queryKey: ['cattle-feed-ratio', id] });
      qc.invalidateQueries({ queryKey: ['cattle-weights', id] });
      qc.invalidateQueries({ queryKey: ['cattle', id] });
      toast.success(t('detail.modal.weight.toast.saved'));
      setShowWeightModal(false);
      setWeightForm({ weight_date: localDateStr(), weight: '', notes: '' });
      setWeightModalFeedRatio('');
    } catch (err) {
      showApiErrors('weight', err, setWeightError, failedMsg());
    } finally {
      setWeightSaving(false);
    }
  };

  const handleAddVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = vaxItems.filter(i => i.medicine_id && parseFloat(i.qty_value) > 0);
    if (validItems.length === 0) { setVaccineError(t('detail.modal.vaccine.validation.at_least_one')); return; }
    const stockFail = validItems.find(i => {
      const med = vaccinesOnly.find(m => m.id.toString() === i.medicine_id);
      return med && med.remaining_quantity < parseFloat(i.qty_value);
    });
    if (stockFail) {
      const med = vaccinesOnly.find(m => m.id.toString() === stockFail.medicine_id);
      setVaccineError(t('detail.modal.vaccine.validation.stock_insufficient', { name: med?.name, qty: med?.remaining_quantity, unit: med?.unit?.symbol ?? '' }));
      return;
    }
    setVaccineError(''); setModalErrors('vaccine'); setVaccineSaving(true);
    try {
      const res = await api.post('/farm/health/vaccines/bulk-multi', {
        cattle_ids:        [id],
        items:             validItems.map(i => ({
          medicine_id:    i.medicine_id,
          quantity_used:  parseFloat(parseFloat(i.qty_value).toFixed(4)),
          next_due_date:  i.next_due || null,
        })),
        administered_date: vaxDate,
        administered_by:   vaxAdminBy || null,
        notes:             vaxNotes || null,
      });
      invalidateMoney(qc, [['cattle-vaccines', id], ['cattle', id], ['cattle-ledger', id], ...MEDICINE_STOCK_KEYS, ['vaccine-schedules']]);
      toast.success(res?.data?.message ?? t('detail.modal.vaccine.toast.saved'));
      setShowVaccineModal(false); resetVaxModal();
    } catch (err) {
      showApiErrors('vaccine', err, setVaccineError, failedMsg(), rowKey(validItems, vaxItems));
    } finally { setVaccineSaving(false); }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = medItems.filter(i => i.medicine_id && parseFloat(i.qty_value) > 0);
    if (validItems.length === 0) { setMedError(t('detail.modal.medicine.validation.at_least_one')); return; }
    const stockFail = validItems.find(i => {
      const med = medsAll.find(m => m.id.toString() === i.medicine_id);
      return med && med.remaining_quantity < parseFloat(i.qty_value);
    });
    if (stockFail) {
      const med = medsAll.find(m => m.id.toString() === stockFail.medicine_id);
      setMedError(t('detail.modal.medicine.validation.stock_insufficient', { name: med?.name, qty: med?.remaining_quantity, unit: med?.unit?.symbol ?? '' }));
      return;
    }
    setMedError(''); setModalErrors('medicine'); setMedSaving(true);
    try {
      const res = await api.post('/farm/medicine/usages/bulk-multi', {
        cattle_ids:    [id],
        items:         validItems.map(i => ({
          medicine_id:   i.medicine_id,
          quantity_used: parseFloat(parseFloat(i.qty_value).toFixed(4)),
          next_due_date: medNextDue || null,
        })),
        usage_date:    medDate,
        notes:         medNotes || null,
      });
      invalidateMoney(qc, [['cattle-medicine', id], ['cattle', id], ['cattle-ledger', id], ...MEDICINE_STOCK_KEYS, ['medicine-usages']]);
      toast.success(res?.data?.message ?? t('detail.modal.medicine.toast.saved'));
      setShowMedModal(false); resetMedModal();
    } catch (err) {
      showApiErrors('medicine', err, setMedError, failedMsg(), k => (k.endsWith('.next_due_date') ? 'next_due_date' : rowKey(validItems, medItems)(k)));
    } finally { setMedSaving(false); }
  };

  const updateRatioMutation = useMutation({
    mutationFn: (d: typeof ratioForm) => api.post(`/farm/cattle/${id}/feed-ratio`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cattle-feed-ratio', id] });
      qc.invalidateQueries({ queryKey: ['cattle', id] });
      setShowRatioModal(false);
      setRatioForm({ feed_ratio: '0', effective_date: localDateStr(), notes: '' });
    },
    onError: (e: unknown) => {
      showApiErrors('ratio', e, setRatioError, failedMsg());
    },
  });

  const cattle = cattleData?.cattle;
  const totalCost = cattleData?.total_cost ?? 0;
  const breakdown = cattleData?.breakdown ?? {};
  const weights = weightsData?.data ?? [];

  if (cattleLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-28 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!cattle) return <p className="text-slate-500">{t('detail.not_found')}</p>;

  // A farm-born animal has no purchase: its starting point is the birth record.
  const isFarmBorn = cattle.origin === 'farm_born';
  const purchasePrice = cattle.purchase_price !== null ? parseFloat(cattle.purchase_price) : 0;
  const currentWeight = cattle.current_weight ? parseFloat(cattle.current_weight) : null;
  const startWeightRaw = cattle.purchase_weight ?? cattle.birth_weight;
  const purchaseWeight = startWeightRaw !== null ? parseFloat(startWeightRaw) : null;
  const weightGain = currentWeight !== null && purchaseWeight !== null ? currentWeight - purchaseWeight : null;
  const startDate = cattle.purchase_date ?? cattle.birth_date;
  const saleRecord = cattle.sale ?? null;
  const profitLoss = saleRecord ? parseFloat(saleRecord.profit_loss) : null;
  const isProfit = profitLoss !== null ? profitLoss >= 0 : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/farm/cattle" aria-label={t('trash.back')} title={t('trash.back')} className="grid place-items-center w-10 h-10 sm:w-auto sm:h-auto sm:p-2 rounded-lg hover:bg-slate-100 text-slate-500 sm:mt-0.5">
          <ArrowLeft size={18} />
        </Link>

        {cattle.profile_image_url && (
          cattle.profile_image_url.endsWith('.pdf') ? (
            <a href={cattle.profile_image_url} target="_blank" rel="noreferrer"
              className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-red-50 border border-red-100 flex flex-col items-center justify-center text-red-500 hover:bg-red-100">
              <FileText size={18} />
              <span className="text-xs mt-0.5">PDF</span>
            </a>
          ) : (
            <a href={cattle.profile_image_url} target="_blank" rel="noreferrer">
              <img src={cattle.profile_image_url} alt={cattle.tag_number} loading="lazy"
                className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-slate-200" />
            </a>
          )
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            <Beef size={18} className="text-amber-500 flex-shrink-0" />
            <span className="truncate">{cattle.tag_number}{cattle.ear_tag_number ? ` / ${cattle.ear_tag_number}` : ''}{cattle.name ? ` — ${cattle.name}` : ''}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {animalTypeName(cattle.animal_type) ? `${animalTypeName(cattle.animal_type)} · ` : ''}{cattle.breed} · {t('gender.' + cattle.gender, { defaultValue: cattle.gender })}{cattle.color ? ` · ${cattle.color}` : ''}
          </p>
          {parseFloat(cattle.feed_ratio) > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">{t('detail.feed_ratio_override', { v: fmtNum(parseFloat(cattle.feed_ratio)) })}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {cattle.purpose && (
            hasPermission('farm.cattle.edit') && cattle.status === 'active' ? (
              <button onClick={() => setShowPurposeModal(true)} title={t('breeding.purpose_change.button')}
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100">
                {t('breeding.purpose.' + cattle.purpose)} <Pencil size={11} />
              </button>
            ) : (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-sky-50 text-sky-700">{t('breeding.purpose.' + cattle.purpose)}</span>
            )
          )}
          {isFarmBorn && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-lime-50 text-lime-700">{t('breeding.born_badge')}</span>
          )}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${AGE_CATEGORY_COLORS[cattle.ageCategory?.name ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>
            {cattle.ageCategory?.name}
          </span>
          {hasPermission('farm.cattle.edit') && cattle.status !== 'sold' ? (
            <button onClick={() => setShowExitModal(true)} title={t('exit.button')}
              className={`flex-shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full hover:opacity-80 ${STATUS_COLORS[cattle.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {t('status.' + cattle.status, { defaultValue: cattle.status })}
              {cattle.exit_date ? ` · ${fmtDate(cattle.exit_date)}` : ''} <Pencil size={11} />
            </button>
          ) : (
            <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[cattle.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {t('status.' + cattle.status, { defaultValue: cattle.status })}
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-slate-400" />
            <span className="text-xs text-slate-500">{isFarmBorn ? t('breeding.birth_date') : t('field.purchase_date')}</span>
          </div>
          <p className="font-semibold text-slate-800">{startDate ? new Date(startDate).toLocaleDateString(localeFor()) : '—'}</p>
          <p className="text-xs text-slate-400">{isFarmBorn ? t('breeding.born_badge') : (cattle.seller_name || t('detail.unknown_supplier'))}</p>
        </div>
        <div className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-slate-400" />
            <span className="text-xs text-slate-500">{isFarmBorn ? t('breeding.birth_value') : t('col.purchase_price')}</span>
            {isFarmBorn && hasPermission('farm.cattle.edit') && (
              <button onClick={() => setShowBirthValue(true)} title={t('breeding.birth_value')} className="ms-auto p-1 rounded hover:bg-slate-100 text-slate-400">
                <Pencil size={12} />
              </button>
            )}
          </div>
          <p className="amount-fit [--amount-max:1rem] font-semibold text-slate-800">
            {isFarmBorn
              ? (cattle.birth_value !== null && cattle.birth_value !== undefined ? fmtMoney(cattle.birth_value) : '—')
              : fmtMoney(purchasePrice)}
          </p>
          <p className="text-xs text-slate-400">{t('detail.initial_weight', { weight: purchaseWeight ?? '—' })}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Scale size={14} className="text-slate-400" />
            <span className="text-xs text-slate-500">{t('field.current_weight')}</span>
          </div>
          <p className="font-semibold text-slate-800">{currentWeight !== null ? `${fmtNum(currentWeight)} ${t('unit.kg')}` : '—'}</p>
          {weightGain !== null && (
            <p className={`text-xs ${weightGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {weightGain >= 0 ? '\u200E+' : ''}{fmtNum(weightGain, 2)} {isFarmBorn ? t('breeding.kg_since_birth') : t('detail.kg_since_purchase')}
            </p>
          )}
        </div>
        <div className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={14} className="text-slate-400" />
            <span className="text-xs text-slate-500">{t('detail.total_cost')}</span>
          </div>
          <p className="amount-fit [--amount-max:1rem] font-semibold text-slate-800">{fmtMoney(totalCost)}</p>
          <p className="text-xs text-slate-400">{t('detail.all_time_expenses')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div>
        {/* Up to 14 tabs scroll sideways; on phones the edges fade to show there are more. */}
        <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto max-sm:[mask-image:linear-gradient(to_right,transparent,#000_1.25rem,#000_calc(100%_-_1.25rem),transparent)]">
          {TABS.filter(tab => (tab.key !== 'breeding' || (cattle.gender === 'female' && hasPermission('farm.breeding.view')))
            && (tab.key !== 'dairy' || (cattle.gender === 'female' && hasPermission('farm.dairy.view')))
            && (tab.key !== 'byproducts' || (byproductList ?? []).some(p => p.tracking === 'per_animal'
              && (p.animal_types ?? []).some(a => a.id === cattle.animal_type_id)))
            && (tab.key !== 'collar' || !!collarOverview?.settings.enabled)).map(tab => (
            <button key={tab.key}
              onClick={e => { setActiveTab(tab.key); e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <OverviewTab cattle={cattle} breakdown={breakdown} />
        )}

        {/* PEDIGREE */}
        {activeTab === 'pedigree' && (
          <PedigreeTab cattleId={cattle.id} />
        )}

        {/* BREEDING HISTORY (females) */}
        {activeTab === 'breeding' && cattle.gender === 'female' && (
          <BreedingHistoryTab cattleId={cattle.id} canCreate={hasPermission('farm.breeding.create') && cattle.status === 'active'} />
        )}

        {/* MILK (females) */}
        {activeTab === 'dairy' && cattle.gender === 'female' && (
          <DairyTab cattleId={cattle.id} canEdit={hasPermission('farm.dairy.create') && cattle.status === 'active'} />
        )}

        {/* SMART COLLAR */}
        {activeTab === 'collar' && (
          <CollarPanel cattleId={cattle.id} />
        )}

        {/* BY-PRODUCTS (wool …) */}
        {activeTab === 'byproducts' && (
          <ByproductTab cattleId={cattle.id} />
        )}

        {/* WEIGHT HISTORY */}
        {activeTab === 'weights' && (
          <WeightHistoryTab
            cattle={cattle}
            hasPermission={hasPermission}
            weightsLoading={weightsLoading}
            weights={weights}
            setWeightForm={setWeightForm}
            setWeightError={setWeightError}
            setWeightModalFeedRatio={setWeightModalFeedRatio}
            setShowWeightModal={setShowWeightModal}
          />
        )}

        {/* FEED RATIO */}
        {activeTab === 'feed-ratio' && (
          <FeedRatioTab
            cattle={cattle}
            hasPermission={hasPermission}
            ratioHistoryData={ratioHistoryData}
            ratioLoading={ratioLoading}
            setRatioForm={setRatioForm}
            setRatioError={setRatioError}
            setShowRatioModal={setShowRatioModal}
          />
        )}

        {/* MEDICINE */}
        {activeTab === 'medicine' && (
          <MedicineTab
            cattle={cattle}
            hasPermission={hasPermission}
            resetMedModal={resetMedModal}
            setShowMedModal={setShowMedModal}
            medicineLoading={medicineLoading}
            medicineError={medicineError}
            medicineData={medicineData}
          />
        )}

        {/* VACCINES */}
        {activeTab === 'vaccines' && (
          <VaccinesTab
            cattle={cattle}
            hasPermission={hasPermission}
            resetVaxModal={resetVaxModal}
            setShowVaccineModal={setShowVaccineModal}
            vaccineLoading={vaccineLoading}
            vaccineData={vaccineData}
          />
        )}

        {/* TREATMENTS */}
        {activeTab === 'treatments' && (
          <TreatmentsTab
            cattle={cattle}
            hasPermission={hasPermission}
            openTreatmentModal={openTreatmentModal}
            treatmentLoading={treatmentLoading}
            treatmentData={treatmentData}
          />
        )}

        {/* AGE TRANSITION HISTORY */}
        {activeTab === 'age-transition' && (
          <AgeTransitionTab
            cattle={cattle}
            hasPermission={hasPermission}
            ageTransitionData={ageTransitionData}
            ageTransitionLoading={ageTransitionLoading}
            id={id}
            qc={qc}
          />
        )}

        {/* LEDGER */}
        {activeTab === 'ledger' && (
          <CostLedgerTab
            ledgerData={ledgerData}
            ledgerLoading={ledgerLoading}
            ledgerPage={ledgerPage}
            setLedgerPage={setLedgerPage}
          />
        )}

        {/* PROFIT ANALYSIS */}
        {activeTab === 'profit' && (
          <ProfitAnalysisTab
            cattle={cattle}
            saleRecord={saleRecord}
            profitLoss={profitLoss}
            isProfit={isProfit}
            totalCost={totalCost}
            purchasePrice={purchasePrice}
            breakdown={breakdown}
          />
        )}
      </div>

      <AddVaccineModal
        serverErrors={serverErrors.vaccine}
        open={showVaccineModal}
        onClose={() => { setShowVaccineModal(false); setModalErrors('vaccine'); }}
        cattle={cattle}
        vaccineError={vaccineError}
        vaccineSaving={vaccineSaving}
        vaxItems={vaxItems}
        setVaxItems={setVaxItems}
        vaxDate={vaxDate}
        setVaxDate={setVaxDate}
        vaxAdminBy={vaxAdminBy}
        setVaxAdminBy={setVaxAdminBy}
        vaxNotes={vaxNotes}
        setVaxNotes={setVaxNotes}
        vaccinesOnly={vaccinesOnly}
        onSubmit={handleAddVaccine}
      />

      <AddMedicineModal
        serverErrors={serverErrors.medicine}
        open={showMedModal}
        onClose={() => { setShowMedModal(false); setModalErrors('medicine'); }}
        cattle={cattle}
        medError={medError}
        medSaving={medSaving}
        medItems={medItems}
        setMedItems={setMedItems}
        medDate={medDate}
        setMedDate={setMedDate}
        medNextDue={medNextDue}
        setMedNextDue={setMedNextDue}
        medNotes={medNotes}
        setMedNotes={setMedNotes}
        medsAll={medsAll}
        onSubmit={handleAddMedicine}
      />

      <RecordWeightModal
        serverErrors={serverErrors.weight}
        open={showWeightModal}
        onClose={() => { setShowWeightModal(false); setModalErrors('weight'); }}
        cattle={cattle}
        weightForm={weightForm}
        setWeightForm={setWeightForm}
        weightError={weightError}
        weightModalFeedRatio={weightModalFeedRatio}
        setWeightModalFeedRatio={setWeightModalFeedRatio}
        weightSaving={weightSaving}
        onSubmit={handleAddWeight}
      />

      <ChangeFeedRatioModal
        serverErrors={serverErrors.ratio}
        open={showRatioModal}
        onClose={() => { setShowRatioModal(false); setModalErrors('ratio'); }}
        ratioForm={ratioForm}
        setRatioForm={setRatioForm}
        ratioError={ratioError}
        saving={updateRatioMutation.isPending}
        onSubmit={e => { e.preventDefault(); setRatioError(''); setModalErrors('ratio'); updateRatioMutation.mutate(ratioForm); }}
      />

      <TreatmentModal
        open={showTreatmentModal}
        onClose={() => { setShowTreatmentModal(false); setTreatmentPrescriptionFile(null); }}
        cattle={cattle}
        treatmentForm={treatmentForm}
        setTreatmentForm={setTreatmentForm}
        treatmentFormError={treatmentFormError}
        treatmentErrors={treatmentErrors}
        setTreatmentErrors={setTreatmentErrors}
        treatmentPrescriptionFile={treatmentPrescriptionFile}
        setTreatmentPrescriptionFile={setTreatmentPrescriptionFile}
        treatmentSaving={treatmentSaving}
        paymentAccounts={paymentAccountsData?.payment_accounts ?? []}
        onSubmit={handleTreatmentSubmit}
      />

      {showBirthValue && (
        <BirthValueModal cattleId={cattle.id} value={cattle.birth_value ?? null} onClose={() => setShowBirthValue(false)} />
      )}

      <CattleExitModal
        open={showExitModal}
        onClose={() => setShowExitModal(false)}
        cattleId={cattle.id}
        status={cattle.status}
        arrivedOn={(cattle.purchase_date ?? cattle.birth_date ?? null)?.slice(0, 10) ?? null}
      />

      {cattle.purpose && (
        <ChangePurposeModal
          open={showPurposeModal}
          onClose={() => setShowPurposeModal(false)}
          cattleId={cattle.id}
          gender={cattle.gender}
          currentPurpose={cattle.purpose}
        />
      )}

      <SellModal
        serverErrors={serverErrors.sell}
        open={showSellModal}
        onClose={() => { setShowSellModal(false); setModalErrors('sell'); }}
        cattle={cattle}
        totalCost={totalCost}
        sellError={sellError}
        sellSaving={sellSaving}
        sellDate={sellDate}
        setSellDate={setSellDate}
        sellPaymentAccountId={sellPaymentAccountId}
        setSellPaymentAccountId={setSellPaymentAccountId}
        sellNotes={sellNotes}
        setSellNotes={setSellNotes}
        sellBuyerMode={sellBuyerMode}
        setSellBuyerMode={setSellBuyerMode}
        sellCustomerId={sellCustomerId}
        setSellCustomerId={setSellCustomerId}
        sellNewName={sellNewName}
        setSellNewName={setSellNewName}
        sellNewPhone={sellNewPhone}
        setSellNewPhone={setSellNewPhone}
        sellNewAddress={sellNewAddress}
        setSellNewAddress={setSellNewAddress}
        sellPaymentStatus={sellPaymentStatus}
        setSellPaymentStatus={setSellPaymentStatus}
        sellPaidAmount={sellPaidAmount}
        setSellPaidAmount={setSellPaidAmount}
        sellPrice={sellPrice}
        setSellPrice={setSellPrice}
        sellWeight={sellWeight}
        setSellWeight={setSellWeight}
        sellCustomers={sellCustomers}
        paymentAccounts={paymentAccountsData?.payment_accounts ?? []}
        onSubmit={handleSell}
      />
    </div>
  );
}
