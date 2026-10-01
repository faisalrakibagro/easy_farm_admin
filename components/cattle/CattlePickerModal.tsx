'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, CheckSquare, Search, Square } from 'lucide-react';
import api from '@/lib/api';
import type { Cattle } from '@/types';
import Modal from '@/components/ui/Modal';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';

/**
 * Pick the animals a bulk action (medicine, sale…) applies to, when the action
 * is started from outside the animal list — e.g. a dashboard quick action.
 */
export default function CattlePickerModal({ title, icon: Icon, onClose, onConfirm, filter }: {
  title: string;
  icon: React.ElementType;
  onClose: () => void;
  onConfirm: (animals: Cattle[]) => void;
  filter?: (c: Cattle) => boolean;
}) {
  const { t } = useTranslation('cattle');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<{ cattle: Cattle[] }>({
    queryKey: ['cattle-active'],
    queryFn: async () => (await api.get('/farm/cattle/all')).data,
  });

  const all = (data?.cattle ?? []).filter(c => !filter || filter(c));
  const q = search.trim().toLowerCase();
  const shown = q
    ? all.filter(c => c.tag_number.toLowerCase().includes(q) || (c.name ?? '').toLowerCase().includes(q) || (c.breed ?? '').toLowerCase().includes(q))
    : all;
  const allShownPicked = shown.length > 0 && shown.every(c => picked.has(c.id));

  const toggle = (id: number) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleShown = () => setPicked(prev => {
    const next = new Set(prev);
    shown.forEach(c => (allShownPicked ? next.delete(c.id) : next.add(c.id)));
    return next;
  });

  return (
    <Modal onClose={onClose} dirty={false} size="xl" title={title} subtitle={t('picker.subtitle')}
      icon={<span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"><Icon size={19} /></span>}
      footer={<>
        <span className="w-full sm:w-auto sm:me-auto text-xs text-slate-500">{t('picker.picked', { count: picked.size })}</span>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="button" disabled={picked.size === 0} onClick={() => onConfirm(all.filter(c => picked.has(c.id)))} className={btnPrimary}>
          {t('picker.next')} <ArrowRight size={15} className="rtl:rotate-180" />
        </button>
      </>}>
      <div className="px-4 sm:px-6 py-4 space-y-3">
        <div className="flex gap-2 items-stretch">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('picker.search')} aria-label={t('picker.search')} data-autofocus
              className={fieldClass(false, 'ps-9')} />
          </div>
          <button type="button" onClick={toggleShown} disabled={shown.length === 0}
            className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 rounded-lg disabled:opacity-40 whitespace-nowrap">
            {allShownPicked ? <CheckSquare size={14} /> : <Square size={14} />}
            {allShownPicked ? t('picker.clear_all') : t('picker.select_all')}
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">{t('picker.empty')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {shown.map(c => {
              const on = picked.has(c.id);
              return (
                <button key={c.id} type="button" onClick={() => toggle(c.id)} aria-pressed={on}
                  className={`flex items-center gap-3 min-w-0 text-start rounded-xl border px-3 py-2.5 transition-colors ${on ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                  <span className={`grid place-items-center w-5 h-5 rounded-md border shrink-0 ${on ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                    {on && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 truncate">{c.tag_number}{c.name ? <span className="font-normal text-slate-500"> · {c.name}</span> : null}</span>
                    <span className="block text-xs text-slate-400 truncate">
                      {[c.breed, c.current_weight ? t('bulk.expense.kg', { kg: parseFloat(String(c.current_weight)) }) : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
