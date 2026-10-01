'use client';

import type { ReactNode } from 'react';

interface FormRowProps {
  /** Columns once the row is wide enough. Always single-column when it is not. */
  cols?: 2 | 3;
  className?: string;
  children: ReactNode;
}

// Container queries, not viewport ones: `sm:` asks how wide the *screen* is, but
// these rows live inside a modal capped at ~512px. On a tablet the viewport
// clears `sm` while the modal has not grown at all, so fields were splitting
// into two cramped columns with no room for their content. @container measures
// the row itself, so columns appear only when they actually fit.
// Deliberately high thresholds. Anything narrower gets one field per line: a
// half-width input in a ~500px modal leaves ~220px, which is not enough for a
// date picker, a currency figure, or a label that wraps to two lines. Only
// genuinely small fields should ever share a line.
const COLS = {
  2: '@lg:grid-cols-2',
  3: '@lg:grid-cols-2 @3xl:grid-cols-3',
} as const;

/**
 * Side-by-side form fields that stack whenever the row is narrow.
 *
 * Children get `min-w-0` so a field can shrink below its intrinsic width —
 * without it a native date input keeps its "mm/dd/yyyy" + picker width and
 * overflows the column instead of fitting it.
 */
export default function FormRow({ cols = 2, className = '', children }: FormRowProps) {
  return (
    <div className={`@container ${className}`}>
      <div className={`grid grid-cols-1 ${COLS[cols]} gap-4 [&>*]:min-w-0`}>
        {children}
      </div>
    </div>
  );
}

/**
 * A child of <FormRow> that always occupies the whole row — a textarea or any
 * field that should never sit in a half-width column.
 */
export function FormRowFull({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`col-span-full ${className}`}>{children}</div>;
}
