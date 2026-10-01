'use client';

import { useTranslation } from 'react-i18next';
import SearchSelect from '@/components/ui/SearchSelect';

export type MedSelectItem = {
  id: number;
  name: string;
  remaining_quantity: number;
  fifo_unit_price?: number;
  unit?: { symbol: string };
};

interface Props {
  id?: string;
  medicines: MedSelectItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Kept for callers; the shared control has one focus colour. */
  ringColor?: string;
  disabled?: boolean;
  excludeIds?: string[];
  error?: string | boolean | null;
}

/**
 * Pick a medicine by typing its name; each row shows what is in stock, and
 * one that has run out cannot be picked. Built on the shared SearchSelect
 * (a bottom sheet on phones).
 */
export default function MedicineSearchSelect({ id, medicines, value, onChange, placeholder, disabled = false, excludeIds = [], error }: Props) {
  const { t } = useTranslation('medicine');

  const options = medicines
    .filter(m => !excludeIds.includes(m.id.toString()) || m.id.toString() === value)
    .map(m => ({
      value: m.id.toString(),
      label: m.name,
      sub: t('search_select.stock_suffix', { qty: m.remaining_quantity, symbol: m.unit?.symbol ?? '' }),
      disabled: m.remaining_quantity <= 0,
      selectedLabel: t('search_select.stock_display', { name: m.name, qty: m.remaining_quantity, symbol: m.unit?.symbol ?? '' }),
    }));

  return (
    <SearchSelect id={id} value={value} onChange={onChange} options={options} disabled={disabled} error={error} clearable
      placeholder={placeholder ?? t('search_select.placeholder')} label={placeholder ?? t('search_select.placeholder')}
      emptyText={t('search_select.no_results')} />
  );
}
