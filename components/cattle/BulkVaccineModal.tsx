'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, Syringe } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import FormRow from '@/components/ui/FormRow';
import NumberInput from '@/components/ui/NumberInput';
import MedicineSearchSelect from '@/components/ui/MedicineSearchSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors } from '@/lib/hooks/useFormErrors';
import type { Cattle } from '@/types';
import type { LineItem, MedItem } from './types';
import { newLine } from './types';
import { localDateStr } from '@/lib/dates';
import { fmtNum } from '@/lib/format';

const FORM_ID = 'bulk-vaccine';

interface BulkVaccineModalProps {
  open: boolean;
  onClose: () => void;
  selectedIds: Set<number>;
  selectedCattleList: Cattle[];
  vaxItems: LineItem[];
  setVaxItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
  vaxDate: string;
  setVaxDate: (v: string) => void;
  vaxAdminBy: string;
  setVaxAdminBy: (v: string) => void;
  vaxNotes: string;
  setVaxNotes: (v: string) => void;
  vaxBulkError: string;
  /** Field errors: administered_date, administered_by, notes, items.{row}.medicine_id|quantity_used|next_due_date. */
  vaxBulkErrors: Record<string, string>;
  setVaxBulkErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  vaxBulkSaving: boolean;
  vaccinesOnly: MedItem[];
  getLineMed: (item: LineItem) => MedItem | undefined;
  getLineQty: (item: LineItem, count: number) => number;
  lineHasStock: (item: LineItem, count: number) => boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function BulkVaccineModal(props: BulkVaccineModalProps) {
  if (!props.open) return null;
  return <BulkVaccineForm {...props} />;
}

function BulkVaccineForm({
  onClose, selectedIds, selectedCattleList,
  vaxItems, setVaxItems, vaxDate, setVaxDate, vaxAdminBy, setVaxAdminBy, vaxNotes, setVaxNotes,
  vaxBulkError, vaxBulkErrors: errors, setVaxBulkErrors: setErrors, vaxBulkSaving, vaccinesOnly,
  getLineMed, getLineQty, lineHasStock, onSubmit,
}: BulkVaccineModalProps) {
  const { t } = useTranslation('cattle');
  useScrollToError(errors, vaxBulkError);

  const snapshot = JSON.stringify({ vaxItems, vaxDate, vaxAdminBy, vaxNotes });
  const [opened] = useState(snapshot);
  const dirty = snapshot !== opened;

  const clear = (key: string) => { if (errors[key]) setErrors(p => ({ ...p, [key]: '' })); };
  const updateLine = (key: string, idx: number, patch: Partial<LineItem>, field: string) => {
    setVaxItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i));
    clear(`items.${idx}.${field}`);
  };
  // Rows shift when one is removed, so their errors no longer line up.
  const removeLine = (key: string) => {
    setVaxItems(prev => prev.filter(i => i.key !== key));
    setErrors(p => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith('items.'))));
  };

  const shown = ['administered_date', 'administered_by', 'notes', ...vaxItems.flatMap((_, i) => [`items.${i}.medicine_id`, `items.${i}.quantity_used`, `items.${i}.next_due_date`])];

  return (
    <Modal onClose={onClose} dirty={dirty} size="xl"
      title={t('bulk.vaccine.title')} subtitle={t('bulk.vaccine.subtitle', { count: selectedIds.size })}
      icon={<Syringe size={18} className="text-cyan-500 shrink-0" />}
      footer={<>
        <span className="w-full sm:w-auto sm:me-auto text-xs text-slate-500">
          {t('bulk.vaccine.footer_count', { animals: selectedIds.size, items: vaxItems.filter(i => i.medicine_id).length })}
        </span>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={vaxBulkSaving} className={btnPrimary}>
          <Check size={15} /> {vaxBulkSaving ? t('bulk.saving') : t('bulk.save_btn')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={vaxBulkError} extra={otherErrors(errors, shown)} />

        {/* Selected animals */}
        <div className="bg-slate-50 rounded-xl px-3 sm:px-4 py-3">
          <p className="text-xs font-semibold text-slate-600 mb-2">{t('bulk.selected_animals_count', { count: selectedIds.size })}</p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {selectedCattleList.map(c => (
              <span key={c.id} className="max-w-full truncate text-xs bg-cyan-100 text-cyan-700 font-medium px-2 py-0.5 rounded-full">
                {c.tag_number}{c.name ? ` (${c.name})` : ''}
              </span>
            ))}
          </div>
        </div>

        {/* Vaccine rows */}
        {vaxItems.map((item, idx) => {
          const med    = getLineMed(item);
          const qpa    = getLineQty(item, selectedIds.size);
          const total  = qpa * selectedIds.size;
          const enough = lineHasStock(item, selectedIds.size);
          const fifo   = med?.fifo_unit_price ?? 0;
          const unit   = med?.unit?.symbol ?? '';
          const e = (f: string) => errors[`items.${idx}.${f}`];
          return (
            <div key={item.key} className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">{t('bulk.vaccine.item_label', { n: idx + 1 })}</span>
                {vaxItems.length > 1 && (
                  <button type="button" onClick={() => removeLine(item.key)} aria-label={t('common:ui.remove_item')}
                    className="-m-2 p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><X size={16} /></button>
                )}
              </div>
              <Field name={`items.${idx}.medicine_id`} error={e('medicine_id')}>
                <MedicineSearchSelect medicines={vaccinesOnly} value={item.medicine_id} error={e('medicine_id')}
                  excludeIds={vaxItems.filter(i => i.key !== item.key && i.medicine_id).map(i => i.medicine_id)}
                  onChange={id => updateLine(item.key, idx, { medicine_id: id, qty_value: '' }, 'medicine_id')}
                  placeholder={t('placeholder.select_vaccine')} />
              </Field>
              <div role="radiogroup" className="flex flex-wrap gap-x-4 gap-y-2">
                {(['per_animal', 'total_split'] as const).map(mode => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer text-sm sm:text-xs text-slate-600 py-1">
                    <input type="radio" checked={item.qty_mode === mode} className="accent-cyan-600"
                      onChange={() => updateLine(item.key, idx, { qty_mode: mode, qty_value: '' }, 'quantity_used')} />
                    {t(mode === 'per_animal' ? 'bulk.qty_mode.per_animal' : 'bulk.qty_mode.total_split')}
                  </label>
                ))}
              </div>
              <Field name={`items.${idx}.quantity_used`} error={e('quantity_used')}
                hint={qpa > 0 ? `${item.qty_mode === 'per_animal' ? t('bulk.qty_summary.total', { val: fmtNum(total, 2) }) : t('bulk.qty_summary.per_animal', { val: fmtNum(qpa, 2) })} ${unit}` : undefined}>
                <NumberInput id={fieldId(`items.${idx}.quantity_used`)} value={item.qty_value} error={e('quantity_used')}
                  suffix={unit || undefined}
                  onChange={v => updateLine(item.key, idx, { qty_value: v }, 'quantity_used')}
                  placeholder={t(item.qty_mode === 'per_animal' ? 'bulk.qty_placeholder.per_animal' : 'bulk.qty_placeholder.total', { unit })} />
              </Field>
              {med && qpa > 0 && (
                <p className={`text-xs rounded-lg px-2 py-1.5 ${enough ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {enough ? t('bulk.stock.available', { qty: med.remaining_quantity, unit }) : t('bulk.stock.insufficient', { qty: med.remaining_quantity, unit })}
                  {fifo > 0 && enough && <span className="ms-2">{t('bulk.stock.cost_summary', { perAnimal: fmtNum(qpa * fifo, 2), total: fmtNum(qpa * fifo * selectedIds.size, 2) })}</span>}
                </p>
              )}
              <Field name={`items.${idx}.next_due_date`} error={e('next_due_date')}
                label={<>{t('bulk.vaccine.next_due_label')} <span className="text-slate-400 font-normal">({t('common:optional')})</span></>}>
                <input id={fieldId(`items.${idx}.next_due_date`)} type="date" value={item.next_due_date ?? ''}
                  onChange={ev => updateLine(item.key, idx, { next_due_date: ev.target.value }, 'next_due_date')}
                  className={fieldClass(e('next_due_date'))} />
              </Field>
            </div>
          );
        })}

        <button type="button" onClick={() => setVaxItems(prev => [...prev, newLine()])}
          className="w-full border border-dashed border-cyan-300 text-cyan-600 hover:bg-cyan-50 rounded-xl py-3 sm:py-2.5 text-sm font-medium">
          {t('bulk.vaccine.add_another')}
        </button>

        <FormRow>
          <Field name="administered_date" label={t('bulk.application_date')} required error={errors.administered_date}>
            <input id={fieldId('administered_date')} type="date" max={localDateStr()} value={vaxDate}
              onChange={e => { setVaxDate(e.target.value); clear('administered_date'); }} className={fieldClass(errors.administered_date)} />
          </Field>
          <Field name="administered_by" label={t('bulk.vaccine.administered_by_label')} error={errors.administered_by}>
            <input id={fieldId('administered_by')} value={vaxAdminBy} dir="auto" placeholder={t('placeholder.doctor_name')}
              onChange={e => { setVaxAdminBy(e.target.value); clear('administered_by'); }} className={fieldClass(errors.administered_by)} />
          </Field>
        </FormRow>
        <Field name="notes" label={t('cattle:field.notes')} error={errors.notes}>
          <textarea id={fieldId('notes')} rows={2} value={vaxNotes} dir="auto"
            onChange={e => { setVaxNotes(e.target.value); clear('notes'); }} className={fieldClass(errors.notes)} />
        </Field>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{t('bulk.fifo_cost_note')}</p>
      </form>
    </Modal>
  );
}
