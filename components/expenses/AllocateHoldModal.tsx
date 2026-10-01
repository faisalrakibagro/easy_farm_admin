'use client';

import { useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnSecondary } from '@/lib/formStyles';
import type { Expense } from '@/types';
import { fmtNum, fmtMoney } from '@/lib/format';

interface CattleOption {
  id: number;
  tag_number: string;
  name?: string | null;
  breed?: string;
  current_weight?: string | null;
}

interface AllocateHoldModalProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  expense: Expense;
  cattle: CattleOption[];
  isLoading: boolean;
  isSaving: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (cattleIds: number[], method: 'equal' | 'weight_based') => void;
}

/**
 * Releases a held expense onto cattle the user picks.
 *
 * A held expense has already left the payment account but was never charged to
 * any animal, so this is where it finally lands. Only active cattle that carry
 * a weight are offered — the API skips weightless ones, so showing them would
 * let the user select an animal that then receives nothing.
 */
export default function AllocateHoldModal({
  t, expense, cattle, isLoading, isSaving, error, onClose, onSubmit,
}: AllocateHoldModalProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [method, setMethod] = useState<'equal' | 'weight_based'>('equal');
  const [filter, setFilter] = useState('');

  const eligible = cattle.filter(c => parseFloat(String(c.current_weight ?? 0)) > 0);
  const q = filter.trim().toLowerCase();
  const visible = q
    ? eligible.filter(c => String(c.tag_number).toLowerCase().includes(q) || (c.name ?? '').toLowerCase().includes(q))
    : eligible;
  const allVisibleOn = visible.length > 0 && visible.every(c => selected.includes(c.id));
  const amount = parseFloat(expense.amount) || 0;
  const share = selected.length > 0 ? amount / selected.length : 0;

  const toggle = (id: number) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Modal onClose={onClose} title={t('expenses.field.hold_allocate_btn')} size="lg"
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>
          <X size={14} /> {t('common:btn.cancel')}
        </button>
        <button type="button"
          disabled={isSaving || selected.length === 0}
          onClick={() => onSubmit(selected, method)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-3 sm:py-2.5 disabled:opacity-60 disabled:cursor-not-allowed">
          <Check size={14} /> {t('expenses.field.hold_allocate_btn')}
        </button>
      </>}>
      <div className="px-4 sm:px-6 py-5 space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-sm font-medium text-amber-900">{expense.title}</p>
          <p className="text-lg font-bold text-amber-900 mt-0.5">{fmtMoney(amount)}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            {t('expenses.field.allocation_method')}
          </label>
          <div className="flex gap-2">
            {([
              { v: 'equal', label: t('expenses.field.allocation_equal') },
              { v: 'weight_based', label: t('expenses.field.allocation_weight') },
            ] as const).map(opt => (
              <label key={opt.v}
                className={`flex-1 text-center px-3 py-2 rounded-lg border-2 cursor-pointer text-sm font-medium transition-all ${
                  method === opt.v
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>
                <input type="radio" name="alloc_method" value={opt.v}
                  checked={method === opt.v}
                  onChange={() => setMethod(opt.v)}
                  className="sr-only" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-600">
              {t('expenses.col.allocated')} ({fmtNum(selected.length)}/{fmtNum(eligible.length)})
            </label>
            {visible.length > 0 && (
              <button type="button"
                onClick={() => setSelected(allVisibleOn
                  ? selected.filter(id => !visible.some(c => c.id === id))
                  : [...new Set([...selected, ...visible.map(c => c.id)])])}
                className="text-xs text-blue-500 hover:underline py-2 -my-2">
                {allVisibleOn ? t('common:btn.deselect_all') : t('common:btn.select_all')}
              </button>
            )}
          </div>

          {/* A long herd is easier to pick from by typing part of the tag or name. */}
          {!isLoading && eligible.length > 8 && (
            <div className="relative mb-2">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={filter} onChange={e => setFilter(e.target.value)} dir="auto"
                placeholder={t('expenses.field.filter_cattle')} aria-label={t('expenses.field.filter_cattle')}
                className="w-full ps-9 pe-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-400 py-4 text-center">{t('common:loading_ellipsis')}</p>
          ) : eligible.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {t('expenses.field.allocation_hint_hold')}
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">{t('common:table.no_results')}</p>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {visible.map(c => {
                const on = selected.includes(c.id);
                return (
                  <label key={c.id}
                    className={`flex items-center gap-3 px-3 py-2.5 sm:py-2 cursor-pointer text-sm ${on ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(c.id)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                    <span className="font-medium text-slate-700 min-w-0 truncate">
                      {c.tag_number}{c.name ? ` · ${c.name}` : ''}
                    </span>
                    <span className="ms-auto text-xs text-slate-400 whitespace-nowrap">
                      {fmtNum(c.current_weight)} {t('cattle:unit.kg')}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {selected.length > 0 && method === 'equal' && (
          <p className="text-xs text-slate-500 text-end">
            {fmtMoney(share)} × {fmtNum(selected.length)}
          </p>
        )}
      </div>
    </Modal>
  );
}
