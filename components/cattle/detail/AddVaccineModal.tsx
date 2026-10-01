'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, Syringe } from 'lucide-react';
import MedicineSearchSelect from '@/components/ui/MedicineSearchSelect';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError } from '@/lib/hooks/useFormErrors';
import type { Cattle } from '@/types';
import type { MedItem } from '../types';
import type { DetailLineItem } from './types';
import { newDetailLine } from './types';
import { localDateStr } from '@/lib/dates';
import { fmtNum } from '@/lib/format';

const FORM_ID = 'cattle-add-vaccine';

interface AddVaccineModalProps {
  open: boolean;
  onClose: () => void;
  cattle: Cattle;
  vaccineError: string;
  /** The server's per-field errors, shown under their fields. */
  serverErrors?: Record<string, string>;
  vaccineSaving: boolean;
  vaxItems: DetailLineItem[];
  setVaxItems: React.Dispatch<React.SetStateAction<DetailLineItem[]>>;
  vaxDate: string;
  setVaxDate: (v: string) => void;
  vaxAdminBy: string;
  setVaxAdminBy: (v: string) => void;
  vaxNotes: string;
  setVaxNotes: (v: string) => void;
  vaccinesOnly: MedItem[];
  onSubmit: (e: React.FormEvent) => void;
}

export default function AddVaccineModal(props: AddVaccineModalProps) {
  if (!props.open) return null;
  return <VaccineFormModal {...props} />;
}

function VaccineFormModal({
  onClose, cattle, vaccineError, vaccineSaving,
  vaxItems, setVaxItems, vaxDate, setVaxDate, vaxAdminBy, setVaxAdminBy, vaxNotes, setVaxNotes,
  vaccinesOnly, onSubmit,
  serverErrors,
}: AddVaccineModalProps) {
  const { t } = useTranslation('cattle');
  const [localErrors, setErrors] = useState<Record<string, string>>({});
  // Server errors show until their field is edited (an edit sets the local entry to '').
  const errors: Record<string, string> = { ...serverErrors, ...localErrors };
  const snapshot = () => JSON.stringify([vaxItems.map(i => [i.medicine_id, i.qty_value, i.next_due]), vaxDate, vaxAdminBy, vaxNotes]);
  const [opened] = useState(snapshot);
  const dirty = snapshot() !== opened;
  useScrollToError(errors, vaccineError);

  const clear = (k: string) => { if (errors[k]) setErrors(p => ({ ...p, [k]: '' })); };
  const setItem = (idx: number, key: string, patch: Partial<DetailLineItem>) => {
    setVaxItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i));
    clear(`items.${idx}`);
  };

  // The same checks the page makes, shown under the row they concern.
  const submit = (e: React.FormEvent) => {
    const errs: Record<string, string> = {};
    const valid = vaxItems.filter(i => i.medicine_id && parseFloat(i.qty_value) > 0);
    if (!valid.length) errs['items.0'] = t('detail.modal.vaccine.validation.at_least_one');
    vaxItems.forEach((i, idx) => {
      const med = vaccinesOnly.find(m => m.id.toString() === i.medicine_id);
      const qty = parseFloat(i.qty_value);
      if (med && qty > 0 && med.remaining_quantity < qty) {
        errs[`items.${idx}`] = t('detail.modal.vaccine.validation.stock_insufficient', { name: med.name, qty: med.remaining_quantity, unit: med.unit?.symbol ?? '' });
      }
    });
    if (!vaxDate) errs.administered_date = t('common:form.v.date_required');
    else if (vaxDate > localDateStr()) errs.administered_date = t('common:form.v.date_not_future');
    if (Object.keys(errs).length) { e.preventDefault(); setErrors(errs); return; }
    setErrors({});
    onSubmit(e);
  };

  return (
    <Modal onClose={onClose} dirty={dirty} size="lg" title={t('detail.modal.vaccine.add_btn')}
      subtitle={`${cattle.tag_number}${cattle.name ? ` (${cattle.name})` : ''}`}
      icon={<Syringe size={18} className="text-cyan-500 shrink-0" />}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={vaccineSaving} className={btnPrimary}>
          <Check size={15} /> {t('detail.modal.save_btn')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={submit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={vaccineError} />

        {vaxItems.map((item, idx) => {
          const med    = vaccinesOnly.find(m => m.id.toString() === item.medicine_id);
          const qty    = parseFloat(item.qty_value);
          const enough = med ? med.remaining_quantity >= (isNaN(qty) ? 0 : qty) : true;
          const fifo   = med?.fifo_unit_price ?? 0;
          const err    = errors[`items.${idx}`];
          return (
            <div key={item.key} className="border border-slate-200 rounded-xl p-4">
              <Field name={`items.${idx}`} error={err}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">{t('detail.modal.vaccine.item_label', { n: idx + 1 })}</span>
                    {vaxItems.length > 1 && (
                      <button type="button" onClick={() => setVaxItems(prev => prev.filter(i => i.key !== item.key))}
                        aria-label={t('common:ui.remove_item')} className="-m-1.5 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><X size={16} /></button>
                    )}
                  </div>
                  <MedicineSearchSelect medicines={vaccinesOnly} value={item.medicine_id} error={!!err && !item.medicine_id}
                    excludeIds={vaxItems.filter(i => i.key !== item.key && i.medicine_id).map(i => i.medicine_id)}
                    onChange={v => setItem(idx, item.key, { medicine_id: v, qty_value: '' })}
                    placeholder={t('placeholder.select_vaccine')} />
                  <FormRow>
                    <NumberInput id={fieldId(`items.${idx}`)} value={item.qty_value} suffix={med?.unit?.symbol || undefined}
                      error={!!err && !!item.medicine_id} onChange={v => setItem(idx, item.key, { qty_value: v })}
                      placeholder={t('detail.modal.vaccine.qty_placeholder', { unit: '' }).trim()} />
                    <div>
                      <input id={fieldId(`items.${idx}.next_due_date`)} type="date" value={item.next_due} aria-label={t('tooltip.next_date')}
                        onChange={e => setItem(idx, item.key, { next_due: e.target.value })} className={fieldClass()} />
                      <p className="text-xs text-slate-500 mt-1">{t('tooltip.next_date')}</p>
                    </div>
                  </FormRow>
                  {med && !isNaN(qty) && qty > 0 && (
                    <p className={`text-xs rounded-lg px-2 py-1.5 ${enough ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {enough ? t('detail.modal.vaccine.stock_ok', { qty: med.remaining_quantity, unit: med.unit?.symbol ?? '' }) : t('detail.modal.vaccine.stock_low', { qty: med.remaining_quantity, unit: med.unit?.symbol ?? '' })}
                      {fifo > 0 && enough && <span className="ms-2">{t('detail.modal.vaccine.cost_suffix', { cost: fmtNum(qty * fifo, 2) })}</span>}
                    </p>
                  )}
                </div>
              </Field>
            </div>
          );
        })}

        <button type="button" onClick={() => setVaxItems(prev => [...prev, newDetailLine()])}
          className="w-full border border-dashed border-cyan-300 text-cyan-600 hover:bg-cyan-50 rounded-xl py-2.5 text-sm font-medium">
          {t('detail.modal.vaccine.add_another')}
        </button>

        <FormRow>
          <Field name="administered_date" label={t('common:field.date')} required error={errors.administered_date}>
            <input id={fieldId('administered_date')} type="date" max={localDateStr()} value={vaxDate}
              onChange={e => { setVaxDate(e.target.value); clear('administered_date'); }} className={fieldClass(errors.administered_date)} />
          </Field>
          <Field name="administered_by" label={t('detail.modal.vaccine.administered_by')}>
            <input id={fieldId('administered_by')} value={vaxAdminBy} dir="auto" placeholder={t('placeholder.doctor_name')}
              onChange={e => setVaxAdminBy(e.target.value)} className={fieldClass()} />
          </Field>
        </FormRow>
        <Field name="notes" label={t('cattle:field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={vaxNotes} dir="auto"
            onChange={e => setVaxNotes(e.target.value)} className={fieldClass()} />
        </Field>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{t('detail.modal.vaccine.fifo_hint')}</p>
      </form>
    </Modal>
  );
}
