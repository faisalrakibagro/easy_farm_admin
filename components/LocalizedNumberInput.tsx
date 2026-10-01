'use client';

import { normalizeNumberInput } from '@/lib/normalizeNumbers';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
  allowDecimal?: boolean;
}

export default function LocalizedNumberInput({
  value,
  onChange,
  allowDecimal = true,
  className,
  ...props
}: Props) {
  return (
    <input
      {...props}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={value}
      className={className}
      onChange={e => onChange(normalizeNumberInput(e.target.value, allowDecimal))}
    />
  );
}
