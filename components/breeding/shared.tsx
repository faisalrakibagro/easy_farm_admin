'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cloneElement, isValidElement, useEffect, useRef } from 'react';
import { fieldId } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import api from '@/lib/api';
import type { AccountingPaymentAccount, BreedingStatus, CattleGender, CattlePurpose, CattleReproductiveStatus } from '@/types';
import { localDateStr } from '@/lib/dates';
import { fmtMoney, fmtNum } from '@/lib/format';

/** The shared control look (taller with 16px text on phones). */
export const inputCls = (hasError?: boolean) => fieldClass(hasError);

export const todayStr = () => localDateStr();

/** "2026-09-24T00:00:00.000000Z" → "2026-09-24". */
export const dateOnly = (v: string | null | undefined) => (v ? v.split('T')[0] : '');

export const money = (v: string | number | null | undefined) => fmtMoney(v);

export const STATUS_COLORS: Record<BreedingStatus, string> = {
  pending:   'bg-amber-50 text-amber-700',
  pregnant:  'bg-pink-50 text-pink-700',
  failed:    'bg-slate-100 text-slate-600',
  aborted:   'bg-red-50 text-red-700',
  delivered: 'bg-green-50 text-green-700',
};

export function StatusBadge({ status }: { status: BreedingStatus }) {
  const { t } = useTranslation('breeding');
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[status]}`}>
      {t('status.' + status)}
    </span>
  );
}

/** Split an API error into a banner message and per-field messages. */
export function apiError(e: unknown, fallback: string): { message: string; fields: Record<string, string> } {
  const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const fields: Record<string, string> = {};
  Object.entries(err.response?.data?.errors ?? {}).forEach(([k, v]) => { fields[k] = v[0]; });
  return { message: err.response?.data?.message ?? fallback, fields };
}

export function Field({ label, error, required, children, hint, name }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode; hint?: React.ReactNode;
  /** The API field name — lets a scroll-to-error or a test find it. */
  name?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // When errors appear, the first one in the form scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!error || !el) return;
    const scope = el.closest('[role="dialog"], form') ?? document;
    if (scope.querySelector('[data-field-error="true"]') !== el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  // The label points at its control, so a tap on it focuses the box and screen readers name it.
  const id = name ? fieldId(name) : undefined;
  const control = id && isValidElement<{ id?: string }>(children) && !children.props.id
    ? cloneElement(children, { id })
    : children;
  const labelFor = isValidElement<{ id?: string }>(control) ? control.props.id : undefined;

  return (
    <div ref={ref} data-field={name} data-field-error={error ? 'true' : undefined} className="min-w-0">
      <label htmlFor={labelFor} className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ms-0.5" aria-hidden="true">*</span>}
      </label>
      {control}
      {error
        ? <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>
        : hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  );
}

/**
 * The frame of every breeding / dairy / by-product form: full screen on a
 * phone, a centred panel elsewhere; a backdrop click never closes it. Pass
 * `dirty` to ask before throwing away what was typed.
 */
export function ModalShell({ title, onClose, children, wide = false, dirty }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; dirty?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose} size={wide ? '2xl' : 'lg'} dirty={dirty}>
      {children}
    </Modal>
  );
}

/**
 * Cancel / Save at the end of a ModalShell form (whose padding is p-6). It
 * stays pinned to the bottom of the screen, so Save is always in reach.
 */
export function FormActions({ onCancel, saving, label }: { onCancel: () => void; saving: boolean; label?: string }) {
  const { t } = useTranslation('breeding');
  return (
    <div className="sticky bottom-0 z-10 -mx-6 -mb-6 !mt-6 flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl [&>button]:flex-1 sm:[&>button]:flex-none">
      <button type="button" onClick={onCancel} className={btnSecondary}>
        {t('btn.cancel')}
      </button>
      <button type="submit" disabled={saving} className={btnPrimary}>
        {saving ? '…' : (label ?? t('btn.save'))}
      </button>
    </div>
  );
}

export type ActiveAnimal = {
  id: number; tag_number: string; name: string | null; gender: CattleGender;
  animal_type_id: number | null; purpose: CattlePurpose | null; reproductive_status: CattleReproductiveStatus | null;
};

/** Active animals (for female / sire pickers) and payment accounts. */
export function useBreedingLookups(enabled: boolean) {
  const animals = useQuery({
    queryKey: ['cattle-active', 'breeding-lookup'],
    queryFn: async () => (await api.get('/farm/cattle/all')).data.cattle as ActiveAnimal[],
    enabled,
  });
  const accounts = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
    enabled,
  });

  return {
    animals: animals.data ?? [],
    females: (animals.data ?? []).filter(a => a.gender === 'female'),
    males: (animals.data ?? []).filter(a => a.gender === 'male'),
    accounts: accounts.data?.payment_accounts ?? [],
    defaultAccountId: accounts.data?.payment_accounts.find(a => a.is_default)?.id?.toString() ?? '',
  };
}

export const animalLabel = (a: { tag_number: string; name: string | null }) => `${a.tag_number}${a.name ? ` — ${a.name}` : ''}`;

export function AccountSelect({ value, onChange, accounts, error, required, label, amount }: {
  value: string; onChange: (v: string) => void; accounts: AccountingPaymentAccount[]; error?: string; required?: boolean; label?: string;
  /** The money going out, to warn when the account holds less. */
  amount?: number | string;
}) {
  const { t } = useTranslation('breeding');
  const text = label ?? t('field.payment_account');
  return (
    <Field name="payment_account_id" label={text} error={error} required={required}>
      <PaymentAccountSelect accounts={accounts} value={value} onChange={onChange} error={error}
        placeholder={t('field.select_account')} label={text} amount={amount} />
    </Field>
  );
}

/** "3 days left" / "Today" / "2 days overdue". */
export function DaysLeft({ days }: { days: number }) {
  const { t } = useTranslation('breeding');
  if (days === 0) return <span className="text-xs font-medium text-amber-700">{t('overview.today')}</span>;
  if (days < 0) return <span className="text-xs font-medium text-red-600">{t('overview.overdue', { count: fmtNum(-days) })}</span>;
  return <span className="text-xs text-slate-500">{t('overview.days_left', { count: fmtNum(days) })}</span>;
}
