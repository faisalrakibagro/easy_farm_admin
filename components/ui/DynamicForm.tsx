'use client';

import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { FormSchema, FormRow, FieldDef, SelectOption } from '@/lib/schemas/types';
import LocalizedNumberInput from '@/components/LocalizedNumberInput';

const INPUT_CLASS =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const INPUT_ERROR_CLASS =
  'w-full border border-red-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400';

interface DynamicFormProps {
  schema: FormSchema;
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  selectOptions?: Record<string, SelectOption[]>;
  error?: string;
  fieldErrors?: Record<string, string>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabelKey: string;
  isSubmitting?: boolean;
  cancelLabelKey?: string;
  /** Rendered before the schema rows — use for TranslationFields */
  before?: React.ReactNode;
}

export default function DynamicForm({
  schema,
  values,
  onChange,
  selectOptions = {},
  error,
  fieldErrors = {},
  onSubmit,
  onCancel,
  submitLabelKey,
  isSubmitting = false,
  cancelLabelKey = 'common:btn.cancel',
  before,
}: DynamicFormProps) {
  const { t } = useTranslation();

  const renderField = (field: FieldDef) => {
    const val = values[field.key];
    const placeholder = field.placeholderKey ? t(field.placeholderKey) : undefined;
    const fieldError = field.required ? fieldErrors[field.key] : undefined;
    const inputCls = fieldError ? INPUT_ERROR_CLASS : INPUT_CLASS;

    if (field.type === 'checkbox') {
      return (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id={`df-${field.key}`}
            checked={Boolean(val)}
            onChange={e => onChange(field.key, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-500"
          />
          <label htmlFor={`df-${field.key}`} className="text-sm text-slate-700">
            {t(field.labelKey)}
          </label>
        </div>
      );
    }

    const label = (
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {t(field.labelKey)}
        {field.required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
    );

    if (field.type === 'select') {
      const opts = selectOptions[field.key] ?? [];
      return (
        <>
          {label}
          <select
            value={String(val ?? '')}
            onChange={e => onChange(field.key, e.target.value)}
            required={field.required}
            className={inputCls}
          >
            <option value="">—</option>
            {field.staticOptions?.map(o => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
            ))}
            {opts.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {fieldError && <p className="text-xs text-red-500 mt-1">{fieldError}</p>}
        </>
      );
    }

    if (field.type === 'textarea') {
      return (
        <>
          {label}
          <textarea
            rows={field.rows ?? 2}
            value={String(val ?? '')}
            onChange={e => onChange(field.key, e.target.value)}
            placeholder={placeholder}
            className={INPUT_CLASS}
          />
        </>
      );
    }

    if (field.type === 'number') {
      return (
        <>
          {label}
          <LocalizedNumberInput
            value={String(val ?? '')}
            onChange={v => onChange(field.key, v)}
            required={field.required}
            placeholder={placeholder}
            allowDecimal={field.allowDecimal !== false}
            className={inputCls}
          />
          {field.hintKey && (
            <p className="text-xs text-slate-400 mt-0.5">{t(field.hintKey)}</p>
          )}
          {fieldError && <p className="text-xs text-red-500 mt-1">{fieldError}</p>}
        </>
      );
    }

    return (
      <>
        {label}
        <input
          type={field.type}
          value={String(val ?? '')}
          onChange={e => onChange(field.key, e.target.value)}
          required={field.required}
          placeholder={placeholder}
          className={INPUT_CLASS}
        />
        {field.hintKey && (
          <p className="text-xs text-slate-400 mt-0.5">{t(field.hintKey)}</p>
        )}
      </>
    );
  };

  const renderRow = (row: FormRow, i: number) => {
    if (Array.isArray(row)) {
      return (
        <div key={i} className="@container grid grid-cols-1 @lg:grid-cols-2 gap-4 [&>*]:min-w-0">
          {row.map(f => <div key={f.key}>{renderField(f)}</div>)}
        </div>
      );
    }
    return <div key={row.key}>{renderField(row)}</div>;
  };

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      {before}
      {schema.rows.map((row, i) => renderRow(row, i))}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          {t(cancelLabelKey)}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-60"
        >
          <Check size={14} /> {t(submitLabelKey)}
        </button>
      </div>
    </form>
  );
}
