'use client';

import type { InputHTMLAttributes } from 'react';
import { normalizeNumberInput } from '@/lib/normalizeNumbers';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * A drop-in for the native number input (type=number) that also takes Bengali and Arabic
 * digits. A browser's number box silently throws those away (the field stays
 * empty and still counts as valid); this one turns them into 0-9 as they are
 * typed, so the value handed to onChange — and saved — is a plain number.
 *
 * Same props and the same `onChange(e)` as the native input, so swapping is a
 * one-word change. A `step` of 1 (or none with an integer `min`) keeps it to
 * whole numbers. No spinner arrows and no accidental change on mouse wheel.
 */
export default function NumericInput({ onChange, step, inputMode, ...props }: Props) {
  const whole = step !== undefined && Number(step) % 1 === 0 && String(step) !== 'any';

  return (
    <input
      {...props}
      step={step}
      type="text"
      inputMode={inputMode ?? (whole ? 'numeric' : 'decimal')}
      autoComplete={props.autoComplete ?? 'off'}
      onChange={e => {
        const clean = normalizeNumberInput(e.target.value, !whole);
        if (clean !== e.target.value) e.target.value = clean;
        onChange?.(e);
      }}
    />
  );
}
