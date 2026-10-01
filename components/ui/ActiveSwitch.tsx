'use client';

import { useTranslation } from 'react-i18next';

/**
 * Suppliers, customers, partners and payment accounts that have money on
 * record are never deleted — they are made inactive, and leave the lists and
 * the pickers until made active again. The badge and the switch for that.
 */
export function ActiveSwitch({ active, pending, onChange }: { active: boolean; pending?: boolean; onChange: (active: boolean) => void }) {
  const { t } = useTranslation('finance');
  return (
    <>
      {!active && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{t('active_switch.inactive')}</span>}
      <button type="button" onClick={() => onChange(!active)} disabled={pending}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
        {active ? t('active_switch.make_inactive') : t('active_switch.make_active')}
      </button>
    </>
  );
}

/** A list filter: show the inactive ones instead of the active ones. */
export function ShowInactiveFilter({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const { t } = useTranslation('finance');
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {t('active_switch.show_inactive')}
    </label>
  );
}
