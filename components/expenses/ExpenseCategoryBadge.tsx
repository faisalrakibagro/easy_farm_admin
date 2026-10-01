'use client';

import { useTranslation } from 'react-i18next';
import Badge from '@/components/ui/Badge';
import { CATEGORY_COLORS } from './types';

/** An expense category ('electricity', 'rent', …) as a coloured, translated pill. */
export default function ExpenseCategoryBadge({ category, className }: { category: string; className?: string }) {
  const { t } = useTranslation('common');
  return (
    <Badge tone={CATEGORY_COLORS[category]} className={className}>
      {t(`expense_category.${category}`, { defaultValue: category })}
    </Badge>
  );
}
