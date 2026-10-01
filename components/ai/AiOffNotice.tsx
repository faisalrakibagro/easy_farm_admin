'use client';

import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';

/** Shown where an AI feature would be while AI is switched off or not set up. */
export default function AiOffNotice() {
  const { t } = useTranslation('ai');
  const { hasPermission } = useAuth();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
      <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-violet-50 text-violet-600"><Sparkles size={22} /></span>
      <h2 className="font-semibold text-slate-800">{t('off.title')}</h2>
      <p className="text-sm text-slate-500">{hasPermission('settings.edit') ? t('off.hint') : t('off.ask_admin')}</p>
      {hasPermission('settings.view') && (
        <Link href="/other-settings/ai" className="inline-block text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white">
          {t('off.go_settings')}
        </Link>
      )}
    </div>
  );
}
