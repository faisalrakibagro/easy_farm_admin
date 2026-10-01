import type { ReactNode } from 'react';

export type FieldType = 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'date';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  type: FieldType;
  labelKey: string;
  placeholderKey?: string;
  hintKey?: string;
  required?: boolean;
  min?: number;
  step?: string;
  allowDecimal?: boolean;
  rows?: number;
  staticOptions?: Array<{ value: string; labelKey: string }>;
}

export type FormRow = FieldDef | [FieldDef, FieldDef];

export interface FormSchema {
  rows: FormRow[];
}

/**
 * What a sortable column holds: sets its first click and its labels in the
 * phone sort menu. `date` is a past date (newest first), `due` a coming one —
 * an expiry or next dose (soonest first).
 */
export type SortType = 'date' | 'due' | 'number' | 'text';

export interface ColDef<T = Record<string, unknown>> {
  key: string;
  labelKey: string;
  align?: 'left' | 'right' | 'center';
  render?: (item: T) => ReactNode;
  /** The list endpoint's `sort` key for this column; set, the header becomes a sort button. */
  sortKey?: string;
  sortType?: SortType;
}
