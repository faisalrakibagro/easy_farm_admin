'use client';

import { useCallback, useMemo, useState } from 'react';

export interface TableSort { key: string; dir: 'asc' | 'desc' }

export interface UseTableSortResult {
  /** The order the list is in — the endpoint's own default until a header is clicked. */
  sort: TableSort;
  setSort: (next: TableSort) => void;
  defaultSort: TableSort;
  /** Spread into list query params; empty while the list is in its default order. */
  params: { sort?: string; dir?: 'asc' | 'desc' };
}

/**
 * Column-sort state for a paginated list page; pass the result to the table as
 * `sorting`. Sorting happens on the server — the list arrives a page at a time.
 *
 * `defaultSort` names the order the endpoint already uses, so its header shows
 * the arrow from the start and no extra params are sent for it; an empty key
 * means the endpoint's own order that no column gives. Like
 * `useDateRange`, changing the order calls `onPageChange(1)`: page 4 of the old
 * order is not page 4 of the new one.
 */
export function useTableSort(defaultSort: TableSort, onPageChange?: (page: number) => void): UseTableSortResult {
  const [sort, setSortState] = useState<TableSort>(defaultSort);

  const setSort = useCallback(
    (next: TableSort) => {
      setSortState(next);
      onPageChange?.(1);
    },
    [onPageChange]
  );

  const isDefault = sort.key === defaultSort.key && sort.dir === defaultSort.dir;
  const params = useMemo(
    () => (isDefault ? {} : { sort: sort.key, dir: sort.dir }),
    [isDefault, sort.key, sort.dir]
  );

  return { sort, setSort, defaultSort, params };
}
