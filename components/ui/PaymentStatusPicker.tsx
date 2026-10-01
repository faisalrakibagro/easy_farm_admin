'use client';

export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

const TONE: Record<PaymentStatus, string> = {
  paid:    'border-green-500 bg-green-50 text-green-700',
  partial: 'border-amber-500 bg-amber-50 text-amber-700',
  unpaid:  'border-red-500 bg-red-50 text-red-700',
};

/** Paid / part paid / not paid — three big buttons in one row (fits a phone). */
export default function PaymentStatusPicker({ value, onChange, labels, options = ['paid', 'partial', 'unpaid'], id }: {
  value: string;
  onChange: (value: PaymentStatus) => void;
  labels: Record<PaymentStatus, string>;
  options?: PaymentStatus[];
  id?: string;
}) {
  return (
    <div id={id} role="radiogroup" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(opt => (
        <button key={opt} type="button" role="radio" aria-checked={value === opt} onClick={() => onChange(opt)}
          className={`px-2 py-2.5 sm:py-2 rounded-lg border-2 text-sm font-medium text-center transition-colors ${value === opt ? TONE[opt] : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}
