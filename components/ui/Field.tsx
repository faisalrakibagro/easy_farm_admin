'use client';

import type { ReactNode } from 'react';

/** The id a field's control should carry, so its label points at it. */
export const fieldId = (name: string) => `f-${name.replace(/[^\w-]/g, '-')}`;

/**
 * One form field: label (with * when required), the control, then either its
 * error or a hint. `name` matches the API's field name, so an error from the
 * server lands here, and the form can scroll to the first field in error.
 */
export default function Field({ name, label, required, hint, error, children, className = '' }: {
  name: string;
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-field={name} data-field-error={error ? 'true' : undefined} className={`min-w-0 ${className}`}>
      {label && (
        <label htmlFor={fieldId(name)} className="block text-xs font-medium text-slate-600 mb-1">
          {label}
          {required && <span className="text-red-500 ms-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error
        ? <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>
        : hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
