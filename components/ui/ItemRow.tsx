'use client';

import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

interface ItemRowProps {
  /** The item picker. Takes the full width on mobile, then shares the line from `sm` up. */
  select: ReactNode;
  /** Narrow trailing fields — quantity, unit price, unit. Split evenly on mobile. */
  fields: ReactNode;
  onRemove?: () => void;
  className?: string;
}

/**
 * One line of a repeating "Add Item" list.
 *
 * The hand-written version put a flex-1 select and fixed-width number inputs on
 * a single line. Inside a narrow modal the fixed widths won, leaving the select
 * a few dozen pixels wide — it rendered as "Select f…" with the item name
 * unreadable. Here the select gets its own full-width row on mobile and only
 * joins the line once there is room for it.
 */
export default function ItemRow({ select, fields, onRemove, className = '' }: ItemRowProps) {
  const { t } = useTranslation('common');
  return (
    <div className={`grid grid-cols-[1fr_1fr_auto] sm:flex gap-2 items-end ${className}`}>
      <div className="col-span-3 sm:col-span-1 sm:flex-1 min-w-0">{select}</div>
      {fields}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('ui.remove_item')}
          className="shrink-0 p-2 text-red-400 hover:bg-red-50 rounded-lg"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
