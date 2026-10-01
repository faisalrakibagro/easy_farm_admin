'use client';

import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import Link from '@/components/ui/AppLink';

/** The "Trash" button in a list page's header, linking to that list's trash. */
export default function TrashLink({ href, label, grow = true }: { href: string; label?: string; grow?: boolean }) {
  const { t } = useTranslation('common');
  return (
    <Link
      href={href}
      className={`flex items-center justify-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg ${grow ? 'flex-1 sm:flex-none' : ''}`}
    >
      <Trash2 size={16} /> {label ?? t('btn.trash')}
    </Link>
  );
}
