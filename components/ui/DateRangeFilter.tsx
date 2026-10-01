'use client';

import { useTranslation } from 'react-i18next';
import { CalendarDays, X } from 'lucide-react';

export interface DateRange {
  date_from: string;
  date_to: string;
}

export const EMPTY_DATE_RANGE: DateRange = { date_from: '', date_to: '' };

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Extra controls (selects, search box) rendered inside the same filter bar. */
  children?: React.ReactNode;
  className?: string;
}

// `text-base` below `sm`: iOS Safari zooms the page when a focused input's font
// is under 16px, and the layout has no `maximum-scale` lock to suppress that
// (nor should it — that breaks pinch-zoom for everyone). Shrink to 14px only
// once there is room for it.
const inputClass =
  'w-full min-w-0 border border-slate-300 rounded-lg px-3 py-2.5 sm:py-2 ' +
  'text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

/**
 * Shared From/To date filter bar.
 *
 * The API already accepts `date_from` / `date_to` on every list endpoint this is
 * used with; this only supplies the inputs. Pair it with `useDateRange()` so the
 * page's query params and the "clear" affordance stay in sync.
 *
 * Layout uses container queries rather than `sm:` for the same reason the form
 * rows do (see components/ui/FormRow.tsx): the bar can sit inside a narrowed
 * content column, where a viewport breakpoint would claim space the bar does not
 * actually have. Two native date pickers need ~320px before they can share a
 * line, so below `@md` every control takes a full row.
 */
export default function DateRangeFilter({
  value,
  onChange,
  children,
  className = '',
}: DateRangeFilterProps) {
  const { t } = useTranslation(['common']);

  const hasValue = Boolean(value.date_from || value.date_to);
  const invalid = Boolean(
    value.date_from && value.date_to && value.date_from > value.date_to
  );

  return (
    <div className={`@container bg-white rounded-xl border border-slate-200 p-3 sm:p-4 ${className}`}>
      {/* Header row: label, and the clear button pinned opposite it so it stays
          reachable on a phone instead of trailing after the inputs. */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <CalendarDays size={15} className="shrink-0" />
          {t('common:date_filter.label')}
        </div>

        {hasValue && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_DATE_RANGE })}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-2 py-1.5 -me-1 rounded shrink-0"
          >
            <X size={13} /> {t('common:date_filter.clear')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 [&>*]:min-w-0">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('common:date_filter.date_from')}
          </label>
          <input
            type="date"
            value={value.date_from}
            max={value.date_to || undefined}
            onChange={e => onChange({ ...value, date_from: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t('common:date_filter.date_to')}
          </label>
          <input
            type="date"
            value={value.date_to}
            min={value.date_from || undefined}
            onChange={e => onChange({ ...value, date_to: e.target.value })}
            className={inputClass}
          />
        </div>

        {children}
      </div>

      {invalid && (
        <p className="mt-2 text-xs text-red-500">{t('common:date_filter.invalid_range')}</p>
      )}
    </div>
  );
}
