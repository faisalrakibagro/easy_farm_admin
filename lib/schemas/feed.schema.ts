import type { FormSchema } from './types';

export const feedItemFormSchema: FormSchema = {
  rows: [
    { key: 'name', type: 'text', labelKey: 'feed:items.field.name', required: true },
    [
      { key: 'category_id', type: 'select', labelKey: 'feed:items.field.category', required: true },
      { key: 'unit_id', type: 'select', labelKey: 'feed:items.field.unit', required: true },
    ],
    { key: 'low_stock_alert', type: 'number', labelKey: 'feed:items.field.low_stock_alert', required: true, min: 0, step: '0.1' },
    { key: 'description', type: 'textarea', labelKey: 'common:field.description', rows: 2 },
  ],
};
