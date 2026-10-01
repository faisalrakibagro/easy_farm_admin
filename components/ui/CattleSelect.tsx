'use client';

import SearchSelect from '@/components/ui/SearchSelect';
import { animalTypeName } from '@/lib/animalType';
import type { Cattle } from '@/types';

type CattleLike = Pick<Cattle, 'id' | 'tag_number' | 'name'> & Partial<Pick<Cattle, 'animal_type' | 'breed' | 'ear_tag_number'>> & {
  shed?: { name?: string | null } | null;
};

/**
 * Pick an animal by typing its tag, name or ear tag ("৭৩" finds C-073).
 * Each row shows the kind of animal, breed and shed, so two similar tags
 * are easy to tell apart.
 */
export default function CattleSelect({ id, cattle, value, onChange, error, disabled, placeholder, label, clearable }: {
  id?: string;
  cattle: CattleLike[];
  value: string;
  onChange: (id: string) => void;
  error?: string | boolean | null;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  clearable?: boolean;
}) {
  const options = cattle.map(c => ({
    value: String(c.id),
    label: c.name ? `${c.tag_number} — ${c.name}` : c.tag_number,
    sub: [animalTypeName(c.animal_type), c.breed, c.shed?.name].filter(Boolean).join(' · ') || undefined,
    keywords: `${c.ear_tag_number ?? ''}`,
  }));

  return (
    <SearchSelect id={id} value={value} onChange={onChange} options={options} error={error} disabled={disabled}
      placeholder={placeholder} label={label ?? placeholder} clearable={clearable} />
  );
}
