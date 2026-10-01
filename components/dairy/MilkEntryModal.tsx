'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Milk, Save } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import SearchSelect from '@/components/ui/SearchSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import type { MilkSession, Shed } from '@/types';
import { todayStr } from '@/components/breeding/shared';
import MilkSheetTable, { type SheetResponse } from '@/components/dairy/MilkSheetTable';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';

const FORM_ID = 'milk-entry-sheet';

/** Morning until 11:00, noon until 16:00, evening after — the usual milking rounds. */
function sessionNow(): MilkSession {
  const h = new Date().getHours();
  return h < 11 ? 'morning' : h < 16 ? 'noon' : 'evening';
}

/**
 * Record a milking round from the animal list: pick the date and session and
 * only the animals in milk (an open lactation) are listed, each with its kg.
 * With `cattleIds` (animals picked on the list) only those are shown.
 */
export default function MilkEntryModal({ onClose, cattleIds }: { onClose: () => void; cattleIds?: number[] }) {
  const { t } = useTranslation('dairy');
  const [date, setDate] = useState(todayStr());
  const [session, setSession] = useState<MilkSession>(sessionNow);
  // Once the user picks a session we stop choosing it for them.
  const [sessionPicked, setSessionPicked] = useState(false);
  const [shedId, setShedId] = useState('');
  const [state, setState] = useState({ dirty: false, saving: false });
  // Another date, session or shed loads a different sheet: ask before dropping typed amounts.
  const { onStateChange: guardState, guard, dialog: discardDialog } = useUnsavedGuard();
  const onStateChange = useCallback((s: { dirty: boolean; saving: boolean }) => { setState(s); guardState(s); }, [guardState]);

  const { data: sheds } = useQuery({
    queryKey: ['sheds-all'],
    queryFn: async () => (await api.get('/farm/sheds/all')).data.sheds as Shed[],
  });

  const { data: fullSheet, isLoading } = useQuery<SheetResponse>({
    queryKey: ['dairy', 'milk-sheet', date, session, shedId],
    queryFn: async () => (await api.get('/farm/dairy/milk-sheet', { params: { date, session, shed_id: shedId || undefined } })).data,
  });

  // Memoised: the table resyncs whenever it gets a new sheet object, so a
  // filtered copy rebuilt on every render would never settle.
  const sheet = useMemo(() => (fullSheet && cattleIds
    ? { ...fullSheet, rows: fullSheet.rows.filter(r => cattleIds.includes(r.cattle_id)) }
    : fullSheet), [fullSheet, cattleIds]);

  // Most animals are milked once a day (morning only). If the round picked from
  // the clock has nobody to milk, fall back to the morning round.
  if (!sessionPicked && sheet && sheet.session === session && sheet.rows.length === 0 && session !== 'morning') {
    setSession('morning');
  }

  const hasRows = !!sheet && sheet.rows.length > 0;

  return (
    <Modal onClose={onClose} size="3xl" dirty={state.dirty}
      title={t('entry_modal.title')}
      subtitle={cattleIds ? t('entry_modal.subtitle_selected', { count: cattleIds.length }) : t('entry_modal.subtitle')}
      icon={<span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25"><Milk size={19} /></span>}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={!hasRows || state.saving} className={btnPrimary}>
          <Save size={15} /> {state.saving ? '…' : t('btn.save')}
        </button>
      </>}>
      <div className="px-4 sm:px-6 py-4 space-y-4">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:items-end">
          <Field name="date" label={t('field.date')}>
            <input id={fieldId('date')} type="date" value={date} max={todayStr()} onChange={e => { const v = e.target.value; guard(() => setDate(v)); }} className={fieldClass()} />
          </Field>
          <Field name="shed" label={t('field.shed')} className="sm:order-last sm:w-56">
            <SearchSelect id={fieldId('shed')} value={shedId} onChange={v => guard(() => setShedId(v))} label={t('field.shed')}
              options={[{ value: '', label: t('field.all_sheds') }, ...(sheds ?? []).map(s => ({ value: String(s.id), label: s.name }))]} />
          </Field>
          <Field name="session" label={t('field.session')} className="col-span-2 sm:col-span-1">
            <div role="radiogroup" className="grid grid-cols-3 rounded-lg border border-slate-300 overflow-hidden">
              {(['morning', 'noon', 'evening'] as MilkSession[]).map(s => (
                <button key={s} type="button" role="radio" aria-checked={session === s}
                  onClick={() => { if (s !== session) guard(() => { setSession(s); setSessionPicked(true); }); }}
                  className={`px-3 py-2.5 sm:py-2 text-sm font-medium ${session === s ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {t('session.' + s)}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {isLoading || !sheet
          ? <div className="h-48 bg-slate-50 rounded-xl animate-pulse" />
          : (
            <>
              {/* No refetch time in the key: the table keeps typed amounts when fresh data arrives. */}
              <MilkSheetTable key={`${date}-${session}-${shedId}`} sheet={sheet} canEdit onSaved={onClose}
                formId={FORM_ID} hideSave onStateChange={onStateChange} />
              {cattleIds && sheet.rows.length < cattleIds.length && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {t('entry_modal.not_this_session', { count: cattleIds.length - sheet.rows.length })}
                </p>
              )}
              {!cattleIds && sheet.rows.length === 0 && (
                <p className="text-center text-sm">
                  <Link href="/farm/dairy/lactations" className="font-medium text-blue-600 hover:underline">{t('entry_modal.start_lactation')}</Link>
                </p>
              )}
            </>
          )}
      </div>
      {discardDialog}
    </Modal>
  );
}
