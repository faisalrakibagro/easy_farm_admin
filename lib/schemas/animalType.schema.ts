import type { FormSchema } from './types';

export const animalTypeFormSchema: FormSchema = {
  rows: [
    { key: 'name', type: 'text', labelKey: 'settings:master_data.animal_types.field.name', required: true },
    { key: 'slug', type: 'text', labelKey: 'settings:master_data.animal_types.field.slug', hintKey: 'settings:master_data.animal_types.field.slug_hint' },
    { key: 'sort_order', type: 'number', labelKey: 'settings:master_data.animal_types.field.sort_order', min: 0 },
    { key: 'description', type: 'textarea', labelKey: 'settings:master_data.animal_types.field.description', rows: 2 },
    { key: 'is_active', type: 'checkbox', labelKey: 'settings:master_data.animal_types.field.is_active' },
  ],
};
