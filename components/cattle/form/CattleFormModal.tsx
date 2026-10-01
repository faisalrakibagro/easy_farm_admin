'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ImageIcon, Upload, FileText, X, Tag, GitBranch, HeartPulse, ShoppingCart, Baby, Warehouse, Paperclip } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormSection from '@/components/ui/FormSection';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import CattleSelect from '@/components/ui/CattleSelect';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import FileAttachInput from '@/components/ui/FileAttachInput';
import HealthStatusSelect from '@/components/health/treatments/HealthStatusSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors } from '@/lib/hooks/useFormErrors';
import { localDateStr } from '@/lib/dates';
import { PURPOSES_BY_GENDER } from '@/types';
import type { AnimalType, AnimalAgeStage, AnimalAgeCategory, AccountingPaymentAccount, Cattle, CattleOrigin, CattlePurpose, CattleReproductiveStatus, Shed } from '@/types';
import { REPRODUCTIVE_STATUSES, type CattleFormData, type ParentOption } from './types';
import { fmtPct } from '@/lib/format';
import MilkingSessionsPicker, { orderSessions, sessionsForTimes } from '@/components/dairy/MilkingSessionsPicker';

const FORM_ID = 'cattle-form';
const SHOWN = ['origin', 'tag_number', 'ear_tag_number', 'name', 'animal_type_id', 'breed', 'breed_id', 'color', 'gender', 'purpose',
  'dam_id', 'sire_id', 'reproductive_status', 'milking_sessions', 'age_stage_id', 'age_category_id', 'health_status',
  'purchase_date', 'purchase_price', 'purchase_weight', 'payment_account_id', 'seller_name', 'seller_phone',
  'birth_date', 'birth_weight', 'birth_value', 'current_weight', 'shed_id', 'feed_ratio', 'notes', 'profile_image', 'invoice_file'];

type Parent = { id: number; tag_number: string; name: string | null } | null | undefined;

export interface CattleFormModalProps {
  editCattle: Cattle | null;
  editLoading: boolean;
  form: CattleFormData;
  setForm: React.Dispatch<React.SetStateAction<CattleFormData>>;
  formError: string;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  animalTypes: AnimalType[] | undefined;
  selectedAnimalType: AnimalType | undefined;
  breeds: { id: number; name: string }[] | undefined;
  /** The breed to show while the edited animal's breed id is being resolved. */
  breedFallbackId?: string;
  sheds: Shed[] | undefined;
  parentOptions: (gender: 'male' | 'female', currentId: string, current?: Parent) => ParentOption[];
  ageStages: AnimalAgeStage[];
  ageStagesLoading: boolean;
  ageCategories: AnimalAgeCategory[];
  ageCategoriesLoading: boolean;
  paymentAccounts: AccountingPaymentAccount[];
  tagLoading: boolean;
  profileImageFile: File | null;
  profileImagePreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  invoiceFile: File | null;
  setInvoiceFile: (f: File | null) => void;
  invoiceFileRef: React.RefObject<HTMLInputElement | null>;
  canRemoveInvoice: boolean;
  onRemoveInvoice: () => void;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * Add or edit an animal, in parts: who it is, breeding, age & health, how it
 * came (bought or born here), where it lives and eats, then files and notes.
 * Adding keeps a draft when closed (the page restores it), so only editing
 * asks before throwing changes away.
 */
export default function CattleFormModal(props: CattleFormModalProps) {
  const {
    editCattle, editLoading, form, setForm, formError, fieldErrors, setFieldErrors, animalTypes, selectedAnimalType,
    breeds, breedFallbackId, sheds, parentOptions, ageStages, ageStagesLoading, ageCategories, ageCategoriesLoading,
    paymentAccounts, tagLoading, profileImageFile, profileImagePreview, fileInputRef, onImageChange,
    invoiceFile, setInvoiceFile, invoiceFileRef, canRemoveInvoice, onRemoveInvoice, isPending, onClose, onSubmit,
  } = props;
  const { t } = useTranslation(['cattle', 'dairy']);
  const isPurchased = form.origin === 'purchased';
  const fe = (k: string) => fieldErrors[k] || undefined;

  // Field errors show under their fields; the top keeps the general message.
  useScrollToError(fieldErrors, formError);
  // Editing only (a new animal's form is kept as a draft when closed). The
  // snapshot is taken once the animal has loaded, not while the form is empty.
  const [opened, setOpened] = useState<string | null>(null);
  if (!editLoading && opened === null) setOpened(JSON.stringify(form));
  const dirty = !!editCattle && opened !== null && JSON.stringify(form) !== opened;

  const set = <K extends keyof CattleFormData>(key: K, value: CattleFormData[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    if (fieldErrors[key]) setFieldErrors(p => ({ ...p, [key]: '' }));
  };

  const breedValue = form.breed_id || breedFallbackId || '';

  return (
    <Modal onClose={onClose} dirty={dirty} size="2xl" title={editCattle ? t('modal.edit_title') : t('modal.create_title')}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={isPending} className={btnPrimary}>
          <Check size={15} /> {editCattle ? t('common:btn.update') : t('btn.register')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="relative px-4 sm:px-6 py-5 space-y-6">
        {editLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-500">{t('common:status.loading')}</span>
            </div>
          </div>
        )}

        <FormAlert message={Object.values(fieldErrors).some(Boolean) ? '' : formError} extra={otherErrors(fieldErrors, SHOWN)} />

        {/* ── Bought or born here (fixed after registration) ── */}
        <Field name="origin" label={t('breeding.origin_label')} required hint={!editCattle ? t('breeding.origin_hint.' + form.origin) : undefined}>
          {editCattle ? (
            <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${isPurchased ? 'bg-slate-100 text-slate-700' : 'bg-lime-50 text-lime-700'}`}>
              {t('breeding.origin.' + form.origin)}
            </span>
          ) : (
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {(['purchased', 'farm_born'] as CattleOrigin[]).map(o => (
                <button key={o} type="button" role="radio" aria-checked={form.origin === o}
                  onClick={() => { setForm(f => ({ ...f, origin: o })); setFieldErrors({}); }}
                  className={`px-3 py-2.5 sm:py-2 text-sm rounded-lg border-2 font-medium ${form.origin === o ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {t('breeding.origin.' + o)}
                </button>
              ))}
            </div>
          )}
        </Field>

        {/* ── Who it is ── */}
        <FormSection title={t('form_section.identity')} icon={<Tag size={15} />}>
          <div className="flex items-center gap-4">
            <div className="shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden grid place-items-center bg-slate-50">
              {profileImagePreview === 'pdf'
                ? <span className="text-xs text-red-500 font-medium">PDF</span>
                : profileImagePreview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={profileImagePreview} alt="" className="w-full h-full object-cover" />
                  : <ImageIcon size={22} className="text-slate-300" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-600 mb-1.5">{t('field.profile_photo')}</p>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 sm:py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
                <Upload size={15} /> {profileImageFile ? t('common:btn.change_file') : (editCattle?.profile_image_url ? t('common:btn.replace_file') : t('common:btn.upload_file'))}
              </button>
              {profileImageFile && <p className="text-xs text-slate-500 mt-1 truncate">{profileImageFile.name}</p>}
              {!profileImageFile && editCattle?.profile_image_url && <p className="text-xs text-green-600 mt-1">{t('common:current_file')}</p>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,application/pdf" className="hidden" onChange={onImageChange} />
          </div>

          <FormRow>
            <Field name="tag_number" label={t('field.tag_number')} required error={fe('tag_number')}
              hint={!editCattle && !tagLoading && form.tag_number ? t('field.tag_auto_hint') : undefined}>
              <input id={fieldId('tag_number')} type="text" value={form.tag_number} disabled={!!editCattle} autoComplete="off"
                placeholder={tagLoading && !editCattle ? t('field.tag_generating') : ''}
                onChange={e => set('tag_number', e.target.value)} className={fieldClass(fe('tag_number'))} />
            </Field>
            <Field name="ear_tag_number" label={t('field.ear_tag')} error={fe('ear_tag_number')}>
              <input id={fieldId('ear_tag_number')} type="text" value={form.ear_tag_number} autoComplete="off"
                onChange={e => set('ear_tag_number', e.target.value)} className={fieldClass(fe('ear_tag_number'))} />
            </Field>
            <Field name="name" label={t('field.name_optional')}>
              <input id={fieldId('name')} type="text" value={form.name} dir="auto" autoComplete="off"
                onChange={e => set('name', e.target.value)} className={fieldClass()} />
            </Field>
            <Field name="animal_type_id" label={t('field.animal_type')} required error={fe('animal_type_id')}>
              <SearchSelect id={fieldId('animal_type_id')} value={form.animal_type_id} label={t('field.animal_type')}
                placeholder={t('field.select_type')} error={fe('animal_type_id')}
                onChange={v => {
                  const type = animalTypes?.find(at => String(at.id) === v);
                  setForm(f => ({ ...f, animal_type_id: v, animal_type: type?.name ?? '', age_stage_id: '', age_category_id: '' }));
                  setFieldErrors(p => ({ ...p, animal_type_id: '' }));
                }}
                options={(animalTypes ?? []).map(at => ({ value: String(at.id), label: at.name }))} />
            </Field>
            <Field name="breed_id" label={t('field.breed')} required error={fe('breed_id') ?? fe('breed')}>
              <SearchSelect id={fieldId('breed_id')} value={breedValue} label={t('field.breed')}
                placeholder={t('field.select_breed')} error={fe('breed_id') ?? fe('breed')}
                onChange={v => {
                  const breed = breeds?.find(b => String(b.id) === v);
                  setForm(f => ({ ...f, breed_id: v, breed: breed?.name ?? '' }));
                  setFieldErrors(p => ({ ...p, breed_id: '', breed: '' }));
                }}
                options={(breeds ?? []).map(b => ({ value: String(b.id), label: b.name }))} />
            </Field>
            <Field name="color" label={t('field.color')}>
              <input id={fieldId('color')} value={form.color ?? ''} dir="auto" placeholder={t('field.color_placeholder')}
                onChange={e => set('color', e.target.value)} className={fieldClass()} />
            </Field>
          </FormRow>

          <Field name="gender" label={t('field.gender')} required>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {(['male', 'female'] as const).map(g => (
                <button key={g} type="button" role="radio" aria-checked={form.gender === g}
                  onClick={() => setForm(f => ({
                    ...f, gender: g,
                    // Drop a purpose the new gender cannot have (a male cannot be dairy).
                    purpose: f.purpose && !PURPOSES_BY_GENDER[g].includes(f.purpose) ? '' : f.purpose,
                  }))}
                  className={`px-3 py-2.5 sm:py-2 text-sm rounded-lg border-2 font-medium ${form.gender === g ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {t('gender.' + g)}
                </button>
              ))}
            </div>
          </Field>
        </FormSection>

        {/* ── Breeding ── */}
        <FormSection title={t('form_section.breeding')} icon={<GitBranch size={15} />}>
          <FormRow>
            <Field name="purpose" label={t('breeding.purpose_label')} error={fe('purpose')}>
              <select id={fieldId('purpose')} value={form.purpose} onChange={e => set('purpose', e.target.value as CattlePurpose | '')} className={fieldClass(fe('purpose'))}>
                {!editCattle && <option value="">{t('breeding.purpose.' + (isPurchased ? 'fattening' : 'young_stock'))}</option>}
                {PURPOSES_BY_GENDER[form.gender].map(p => <option key={p} value={p}>{t('breeding.purpose.' + p)}</option>)}
              </select>
            </Field>
            {form.gender === 'female' && (
              <Field name="reproductive_status" label={t('breeding.reproductive_status_label')}>
                <select id={fieldId('reproductive_status')} value={form.reproductive_status}
                  onChange={e => set('reproductive_status', e.target.value as CattleReproductiveStatus | '')} className={fieldClass()}>
                  <option value="">{t('breeding.not_set')}</option>
                  {REPRODUCTIVE_STATUSES.map(rs => <option key={rs} value={rs}>{t('breeding.reproductive_status.' + rs)}</option>)}
                </select>
              </Field>
            )}
            <Field name="dam_id" label={t('breeding.dam')} error={fe('dam_id')}>
              <CattleSelect id={fieldId('dam_id')} value={form.dam_id} clearable label={t('breeding.dam')} placeholder={t('breeding.select_dam')}
                error={fe('dam_id')} onChange={v => set('dam_id', v)}
                cattle={parentOptions('female', form.dam_id, editCattle?.dam)} />
            </Field>
            <Field name="sire_id" label={t('breeding.sire')} error={fe('sire_id')}>
              <CattleSelect id={fieldId('sire_id')} value={form.sire_id} clearable label={t('breeding.sire')} placeholder={t('breeding.select_sire')}
                error={fe('sire_id')} onChange={v => set('sire_id', v)}
                cattle={parentOptions('male', form.sire_id, editCattle?.sire)} />
            </Field>
            {form.gender === 'female' && selectedAnimalType?.is_milking && (
              <Field name="milking_sessions" label={t('dairy:field.milking_sessions')} error={fe('milking_sessions')} className="sm:col-span-2">
                <MilkingSessionsPicker id={fieldId('milking_sessions')} error={fe('milking_sessions')}
                  value={orderSessions(form.milking_sessions ? form.milking_sessions.split(',') : [])}
                  inherited={selectedAnimalType.milking_sessions?.length ? orderSessions(selectedAnimalType.milking_sessions) : sessionsForTimes(selectedAnimalType.default_milking_times)}
                  onChange={v => set('milking_sessions', v.join(','))} />
              </Field>
            )}
          </FormRow>
        </FormSection>

        {/* ── Age and health ── */}
        <FormSection title={t('form_section.age_health')} icon={<HeartPulse size={15} />}>
          <FormRow>
            {(['age_stage_id', 'age_category_id'] as const).map(key => {
              const list = key === 'age_stage_id' ? ageStages : ageCategories;
              const loading = key === 'age_stage_id' ? ageStagesLoading : ageCategoriesLoading;
              return (
                <Field key={key} name={key} label={t(key === 'age_stage_id' ? 'field.age_stage' : 'field.age_category')} required={!editCattle} error={fe(key)}
                  hint={!form.animal_type_id ? t('field.select_animal_type_first') : undefined}>
                  <select id={fieldId(key)} value={form[key]} disabled={!form.animal_type_id || loading}
                    onChange={e => set(key, e.target.value)} className={fieldClass(fe(key))}>
                    <option value="">{loading ? t('common:status.loading') : t('age_cat.select_type')}</option>
                    {list.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              );
            })}
          </FormRow>
          <Field name="health_status" label={t('field.health_status')}>
            <HealthStatusSelect value={form.health_status} onChange={v => set('health_status', v)} />
          </Field>
        </FormSection>

        {/* ── How it came to the farm ── */}
        {isPurchased ? (
          <FormSection title={t('form_section.purchase')} icon={<ShoppingCart size={15} />}>
            <FormRow>
              <Field name="purchase_date" label={t('field.purchase_date')} required error={fe('purchase_date')}>
                <input id={fieldId('purchase_date')} type="date" value={form.purchase_date} max={localDateStr()} disabled={!!editCattle}
                  onChange={e => set('purchase_date', e.target.value)} className={fieldClass(fe('purchase_date'))} />
              </Field>
              <Field name="purchase_price" label={t('field.purchase_price')} required error={fe('purchase_price')}>
                <NumberInput id={fieldId('purchase_price')} value={form.purchase_price} prefix="৳" placeholder="0" disabled={editCattle?.status === 'sold'}
                  error={fe('purchase_price')} onChange={v => set('purchase_price', v)} />
              </Field>
              <Field name="purchase_weight" label={t('field.purchase_weight')} required error={fe('purchase_weight')}>
                <NumberInput id={fieldId('purchase_weight')} value={form.purchase_weight} suffix={t('unit.kg')} placeholder="0" disabled={!!editCattle}
                  error={fe('purchase_weight')} onChange={v => set('purchase_weight', v)} />
              </Field>
              <Field name="seller_name" label={t('field.seller_name')}>
                <input id={fieldId('seller_name')} type="text" value={form.seller_name} dir="auto" onChange={e => set('seller_name', e.target.value)} className={fieldClass()} />
              </Field>
              <Field name="seller_phone" label={t('field.seller_phone')}>
                <input id={fieldId('seller_phone')} type="tel" inputMode="tel" dir="ltr" value={form.seller_phone}
                  onChange={e => set('seller_phone', e.target.value)} className={fieldClass()} />
              </Field>
            </FormRow>
            {!editCattle && (
              <Field name="payment_account_id" label={t('field.payment_account')} required error={fe('payment_account_id')}>
                <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccounts} value={form.payment_account_id}
                  onChange={v => set('payment_account_id', v)} error={fe('payment_account_id')} amount={form.purchase_price}
                  placeholder={t('field.select_account')} label={t('field.payment_account')} />
              </Field>
            )}
          </FormSection>
        ) : (
          <FormSection title={t('form_section.birth')} icon={<Baby size={15} />}>
            <FormRow>
              <Field name="birth_date" label={t('breeding.birth_date')} required={!editCattle} error={fe('birth_date')}>
                <input id={fieldId('birth_date')} type="date" value={form.birth_date} max={localDateStr()}
                  onChange={e => set('birth_date', e.target.value)} className={fieldClass(fe('birth_date'))} />
              </Field>
              <Field name="birth_weight" label={t('breeding.birth_weight')} error={fe('birth_weight')}>
                <NumberInput id={fieldId('birth_weight')} value={form.birth_weight} suffix={t('unit.kg')} placeholder="0" error={fe('birth_weight')}
                  onChange={v => { set('birth_weight', v); setFieldErrors(p => ({ ...p, current_weight: '' })); }} />
              </Field>
              {!editCattle && (
                <Field name="birth_value" label={t('breeding.birth_value')} error={fe('birth_value')} hint={t('breeding.birth_value_form_hint')}>
                  <NumberInput id={fieldId('birth_value')} value={form.birth_value} prefix="৳" placeholder="0" error={fe('birth_value')}
                    onChange={v => set('birth_value', v)} />
                </Field>
              )}
              {!editCattle && (
                <Field name="current_weight" label={t('breeding.current_weight')} error={fe('current_weight')} hint={t('breeding.weight_hint')}>
                  <NumberInput id={fieldId('current_weight')} value={form.current_weight} suffix={t('unit.kg')} placeholder="0" error={fe('current_weight')}
                    onChange={v => set('current_weight', v)} />
                </Field>
              )}
            </FormRow>
          </FormSection>
        )}

        {/* ── Where it lives and what it eats ── */}
        <FormSection title={t('form_section.place_feed')} icon={<Warehouse size={15} />}>
          <Field name="shed_id" label={t('field.shed')} required error={fe('shed_id')}>
            <SearchSelect id={fieldId('shed_id')} value={form.shed_id} label={t('field.shed')} placeholder={t('field.select_shed')}
              error={fe('shed_id')} onChange={v => set('shed_id', v)}
              options={(sheds ?? []).map(s => ({ value: String(s.id), label: s.name }))} />
          </Field>
          <div className="bg-amber-50 rounded-xl p-3 sm:p-4 border border-amber-100">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <label htmlFor={fieldId('feed_ratio')} className="block text-xs font-semibold text-amber-800">{t('field.feed_ratio_label')}</label>
                <p className="text-xs text-amber-700 mt-0.5">{t('field.feed_ratio_hint')}</p>
              </div>
              <span className={`text-lg font-bold min-w-[48px] text-end ${parseFloat(form.feed_ratio) > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {fmtPct(form.feed_ratio || '0', 1)}
              </span>
            </div>
            <input type="range" min="0" max="100" step="0.5" value={form.feed_ratio} aria-label={t('field.feed_ratio_label')}
              onChange={e => set('feed_ratio', e.target.value)} className="w-full accent-amber-500 mb-2 h-6" />
            <NumberInput id={fieldId('feed_ratio')} value={form.feed_ratio} suffix="%" placeholder="0" onChange={v => set('feed_ratio', v)} />
          </div>
        </FormSection>

        {/* ── Invoice and notes ── */}
        <FormSection title={t('form_section.files_notes')} icon={<Paperclip size={15} />}>
          {(isPurchased || editCattle?.invoice_file_url) && (
            <Field name="invoice_file" label={<>{t('field.invoice')} <span className="text-slate-400 font-normal">{t('field.invoice_hint')}</span></>} error={fe('invoice_file')}>
              {editCattle?.invoice_file_url && !invoiceFile && (
                <div className="flex items-center gap-2 mb-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                  <FileText size={15} className="text-blue-500 shrink-0" />
                  <a href={editCattle.invoice_file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">{t('common:current_invoice')}</a>
                  {canRemoveInvoice && (
                    <button type="button" onClick={onRemoveInvoice} aria-label={t('common:btn.remove_file')}
                      className="ms-auto p-1.5 rounded text-red-500 hover:bg-red-50 shrink-0"><X size={14} /></button>
                  )}
                </div>
              )}
              <FileAttachInput file={invoiceFile} onChange={setInvoiceFile} inputRef={invoiceFileRef}
                accept=".pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf"
                labels={{
                  upload: editCattle?.invoice_file_url ? t('common:btn.replace_invoice') : t('common:btn.upload_invoice'),
                  change: t('common:btn.change_file'), remove: t('common:btn.remove_file'),
                }} />
            </Field>
          )}
          <Field name="notes" label={t('field.notes')}>
            <textarea id={fieldId('notes')} rows={2} value={form.notes ?? ''} dir="auto" onChange={e => set('notes', e.target.value)} className={fieldClass()} />
          </Field>
        </FormSection>
      </form>
    </Modal>
  );
}
