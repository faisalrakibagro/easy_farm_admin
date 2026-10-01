'use client';

import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnSecondary } from '@/lib/formStyles';

/** One animal from GET /farm/dairy/milk-check. */
export interface MilkCheckRow {
  cattle_id: number;
  tag_number: string;
  name: string | null;
  ok: boolean;
  reason: 'not_active' | 'male' | 'not_milking_type' | 'dry' | 'not_in_milk' | null;
  reason_text: string | null;
}

interface Props {
  rows: MilkCheckRow[];
  /** Drops the wrong animals from the selection; the milk entry opens only after that. */
  onRemove: (ids: number[]) => void;
  onClose: () => void;
}

/**
 * Milk entry was clicked with animals picked, and some of them give no milk.
 * There is no "continue anyway": the wrong animals must be removed from the
 * selection first, so a mistaken pick is noticed instead of silently skipped.
 */
export default function MilkSelectionWarning({ rows, onRemove, onClose }: Props) {
  const { t } = useTranslation('cattle');
  const wrong = rows.filter(r => !r.ok);

  return (
    <Modal onClose={onClose} dirty={false} size="md" title={t('milk_check.title')}
      subtitle={t('milk_check.subtitle', { count: wrong.length })}
      icon={<span className="grid place-items-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600 shrink-0"><AlertTriangle size={20} /></span>}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="button" onClick={() => onRemove(wrong.map(r => r.cattle_id))}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-3 sm:py-2.5">
          {t('milk_check.remove', { count: wrong.length })}
        </button>
      </>}>
      <div className="px-4 sm:px-6 py-4 space-y-3">
        <ul className="space-y-2">
          {wrong.map(r => (
            <li key={r.cattle_id} className="flex flex-wrap items-start gap-x-2 gap-y-0.5 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm">
              <span className="font-semibold text-red-700 whitespace-nowrap">{r.tag_number}</span>
              <span className="text-red-600 min-w-0">{r.name ? `${r.name} — ` : ''}{r.reason_text}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">{t('milk_check.hint')}</p>
      </div>
    </Modal>
  );
}
