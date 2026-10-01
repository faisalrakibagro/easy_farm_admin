'use client';

import type { ReactNode } from 'react';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import SearchSelect from '@/components/ui/SearchSelect';
import { fieldClass } from '@/lib/formStyles';
import type { Supplier } from '@/types';

export interface SupplierValue {
  supplier_id: string;
  supplier_name: string;
  supplier_phone: string;
  invoice_no: string;
}

/**
 * Who sold it: a saved supplier (searchable; its phone fills in) or a name
 * typed by hand, plus phone and invoice number. Used by the feed and
 * medicine purchase forms.
 */
export default function SupplierFields({ value, onChange, suppliers, labels, errors = {}, nameRequired = false, keepPhone = false, children }: {
  value: SupplierValue;
  onChange: (patch: Partial<SupplierValue>) => void;
  suppliers: Supplier[];
  labels: { supplier: string; manual: string; name: string; phone: string; invoice: string; phoneHint?: string; autoFilled?: string };
  errors?: Partial<Record<'supplier_name' | 'supplier_phone' | 'invoice_no' | 'supplier_contact', string>>;
  nameRequired?: boolean;
  /** Editing: picking "type by hand" keeps the phone already there. */
  keepPhone?: boolean;
  /** More fields for the same grid (the date, usually). */
  children?: ReactNode;
}) {
  const contact = errors.supplier_contact;

  return (
    <FormRow>
      <Field name="supplier_id" label={labels.supplier}>
        <SearchSelect id={fieldId('supplier_id')} value={value.supplier_id} label={labels.supplier}
          onChange={id => {
            const picked = suppliers.find(s => String(s.id) === id);
            onChange({ supplier_id: id, supplier_phone: picked?.phone ?? (keepPhone ? value.supplier_phone : '') });
          }}
          options={[
            { value: '', label: labels.manual },
            ...suppliers.map(s => ({ value: String(s.id), label: s.name, sub: s.phone ?? undefined, keywords: s.phone ?? '' })),
          ]} />
      </Field>
      {!value.supplier_id && (
        <Field name="supplier_name" label={labels.name} required={nameRequired} error={errors.supplier_name}>
          <input id={fieldId('supplier_name')} value={value.supplier_name} dir="auto" autoComplete="off"
            onChange={e => onChange({ supplier_name: e.target.value })} className={fieldClass(errors.supplier_name)} />
        </Field>
      )}
      <Field name="supplier_phone" error={errors.supplier_phone}
        label={<>{labels.phone}{labels.phoneHint && <span className="ms-1 font-normal text-slate-400">{labels.phoneHint}</span>}
          {value.supplier_id && value.supplier_phone && labels.autoFilled && <span className="ms-1 font-normal text-slate-400">{labels.autoFilled}</span>}</>}>
        <input id={fieldId('supplier_phone')} type="tel" inputMode="tel" dir="ltr" autoComplete="off" value={value.supplier_phone}
          onChange={e => onChange({ supplier_phone: e.target.value })}
          className={fieldClass(errors.supplier_phone || (contact && !value.supplier_phone))} />
      </Field>
      <Field name="invoice_no" label={labels.invoice} error={errors.invoice_no ?? contact}>
        <input id={fieldId('invoice_no')} value={value.invoice_no} autoComplete="off"
          onChange={e => onChange({ invoice_no: e.target.value })}
          className={fieldClass(errors.invoice_no || (contact && !value.invoice_no))} />
      </Field>
      {children}
    </FormRow>
  );
}
