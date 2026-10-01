'use client';

import { useCallback, useMemo, useState } from 'react';
import { EMPTY_DATE_RANGE, type DateRange } from '@/components/ui/DateRangeFilter';

interface UseDateRangeResult {
  /** Bind to `<DateRangeFilter value=... onChange=... />`. */
  range: DateRange;
  setRange: (next: DateRange) => void;
  /** Spread into list query params — omits empty and invalid ranges. */
  params: { date_from?: string; date_to?: string };
  hasValue: boolean;
  clear: () => void;
}

/**
 * Date-range filter state for a paginated list page.
 *
 * `onPageChange` is invoked whenever the range changes so the list falls back to
 * page 1 — otherwise a filter applied while on page 4 can land on an empty page.
 * An inverted range (from > to) yields no params, so the list keeps showing the
 * last valid result instead of an empty table while the user is mid-edit.
 */
export function useDateRange(onPageChange?: (page: number) => void): UseDateRangeResult {
  const [range, setRangeState] = useState<DateRange>({ ...EMPTY_DATE_RANGE });

  const setRange = useCallback(
    (next: DateRange) => {
      setRangeState(next);
      onPageChange?.(1);
    },
    [onPageChange]
  );

  const clear = useCallback(() => setRange({ ...EMPTY_DATE_RANGE }), [setRange]);

  const params = useMemo(() => {
    const { date_from, date_to } = range;
    if (date_from && date_to && date_from > date_to) return {};
    return {
      date_from: date_from || undefined,
      date_to: date_to || undefined,
    };
  }, [range]);

  return {
    range,
    setRange,
    params,
    hasValue: Boolean(range.date_from || range.date_to),
    clear,
  };
}
