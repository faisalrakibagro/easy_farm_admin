'use client';

import Field, { fieldId } from '@/components/ui/Field';
import NumberInput from '@/components/ui/NumberInput';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import PaymentStatusPicker, { type PaymentStatus } from '@/components/ui/PaymentStatusPicker';
import { normalizeNumber } from '@/lib/normalizeNumbers';
import type { AccountingPaymentAccount } from '@/types';
import { fmtMoney } from '@/lib/format';

export interface PaymentValue {
  payment_status: string;
  paid_amount: string;
  payment_account_id: string;
}

/**
 * How a purchase was paid: fully / partly / not yet, the amount paid now
 * (with what stays due), and the account the money left — warning when the
 * account holds less.
 */
export default function PaymentFields({ value, onChange, total, accounts, labels, errors = {} }: {
  value: PaymentValue;
  onChange: (patch: Partial<PaymentValue>) => void;
  /** The bill total, for "due" and the overdraft warning. */
  total: number;
  accounts: AccountingPaymentAccount[];
  labels: {
    status: string; paid: string; partial: string; unpaid: string;
    paidAmount: string; paidAmountPlaceholder?: string; due: string;
    account: string; accountPlaceholder?: string;
  };
  errors?: Partial<Record<'paid_amount' | 'payment_account_id', string>>;
}) {
  const paid = parseFloat(normalizeNumber(value.paid_amount)) || 0;

  return (
    <>
      <Field name="payment_status" label={labels.status} required>
        <PaymentStatusPicker id={fieldId('payment_status')} value={value.payment_status}
          onChange={(s: PaymentStatus) => onChange({ payment_status: s, paid_amount: '' })}
          labels={{ paid: labels.paid, partial: labels.partial, unpaid: labels.unpaid }} />
      </Field>

      {value.payment_status === 'partial' && (
        <Field name="paid_amount" label={labels.paidAmount} required error={errors.paid_amount}
          hint={total > 0 && value.paid_amount ? `${labels.due}: ${fmtMoney(Math.max(0, total - paid))}` : undefined}>
          <NumberInput id={fieldId('paid_amount')} value={value.paid_amount} prefix="৳" error={errors.paid_amount}
            placeholder={labels.paidAmountPlaceholder} onChange={v => onChange({ paid_amount: v })} />
        </Field>
      )}

      {value.payment_status !== 'unpaid' && (
        <Field name="payment_account_id" label={labels.account} required error={errors.payment_account_id}>
          <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={accounts} value={value.payment_account_id}
            onChange={id => onChange({ payment_account_id: id })} error={errors.payment_account_id}
            placeholder={labels.accountPlaceholder} label={labels.account}
            amount={value.payment_status === 'partial' ? paid : total} />
        </Field>
      )}
    </>
  );
}
