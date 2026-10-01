'use client';

import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import SearchSelect from '@/components/ui/SearchSelect';

/** What the picker needs from an account (the full record or a slimmer option both fit). */
type AccountLike = {
  id: number; name: string; type: string; balance?: number | null; is_active?: boolean;
  bank_name?: string | null; mfs_provider?: string | null; account_number?: string | null;
};
import { exceedsBalance, findAccount, formatBalance } from '@/lib/paymentAccountBalance';

/**
 * Pick the cash / bank / mobile-money account the money comes from, with its
 * balance beside each one. With `amount`, warns (does not block) when the
 * payment is more than the account holds.
 */
export default function PaymentAccountSelect({ id, accounts, value, onChange, error, disabled, placeholder, label, amount }: {
  id?: string;
  accounts: AccountLike[] | undefined;
  value: string;
  onChange: (id: string) => void;
  error?: string | boolean | null;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  /** The money going out, to warn about an overdraft. */
  amount?: number | string;
}) {
  const { t } = useTranslation('common');

  const options = (accounts ?? []).filter(a => a.is_active !== false || String(a.id) === value).map(a => {
    const balance = a.balance != null ? `${Number(a.balance) < 0 ? '⚠ ' : ''}${formatBalance(Number(a.balance))}` : '';
    const kind = t(`payment_account_type.${a.type}`, { defaultValue: a.type });
    return {
      value: String(a.id),
      label: a.name,
      sub: [kind, a.bank_name ?? a.mfs_provider, balance && t('select.balance', { amount: balance })].filter(Boolean).join(' · '),
      keywords: `${a.type} ${a.account_number ?? ''}`,
      selectedLabel: balance ? `${a.name} — ${balance}` : a.name,
    };
  });

  const picked = findAccount(accounts, value);
  const over = amount !== undefined && !!picked && exceedsBalance({ name: picked.name, balance: picked.balance ?? undefined }, amount);

  return (
    <>
      <SearchSelect id={id} value={value} onChange={onChange} options={options} error={error} disabled={disabled}
        placeholder={placeholder ?? t('select.account_placeholder')} label={label ?? placeholder ?? t('select.account_placeholder')} />
      {over && picked?.balance != null && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {t('balance_exceeds', { balance: formatBalance(picked.balance) })}
        </p>
      )}
    </>
  );
}
