import type { FormSchema } from './types';

export const medicineFormSchema: FormSchema = {
  rows: [
    { key: 'name', type: 'text', labelKey: 'medicine:inventory.field.name', required: true },
    [
      { key: 'category_id', type: 'select', labelKey: 'medicine:inventory.field.category' },
      { key: 'unit_id', type: 'select', labelKey: 'medicine:inventory.field.unit', required: true },
    ],
    { key: 'manufacturer', type: 'text', labelKey: 'medicine:inventory.field.manufacturer' },
    { key: 'low_stock_alert', type: 'number', labelKey: 'medicine:inventory.field.low_stock_alert', required: true, min: 0.01, step: 'any', hintKey: 'medicine:inventory.field.low_stock_alert_hint' },
    { key: 'milk_withdrawal_days', type: 'number', labelKey: 'medicine:inventory.field.milk_withdrawal_days', min: 0, step: '1', hintKey: 'medicine:inventory.field.milk_withdrawal_days_hint' },
    { key: 'notes', type: 'textarea', labelKey: 'common:field.notes', rows: 2 },
  ],
};
