'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { normalizeNumber } from '@/lib/normalizeNumbers';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { frameClass } from '@/lib/formStyles';

export interface SelectOption {
  value: string;
  label: string;
  /** A second, quieter line: stock, animal type, phone … */
  sub?: string;
  /** Extra words to match on (tag, phone, code …). */
  keywords?: string;
  disabled?: boolean;
  /** What the closed box shows when this is picked (defaults to the label). */
  selectedLabel?: string;
}

/** Rows rendered at most; typing narrows the rest. */
const MAX_ROWS = 150;

/** Bengali digits, case, spaces and dashes don't matter: "c০৭৩" finds "C-073". */
const norm = (s: string) => normalizeNumber(s).toLowerCase().replace(/[\s\-_#./]+/g, '');

/**
 * A select you can search. On a computer the list drops down under the box;
 * on a phone it opens as a sheet from the bottom with a big search box and
 * finger-sized rows. Keyboard: ↑ ↓ Enter Esc.
 */
export default function SearchSelect({
  id, value, onChange, options, placeholder, label, error, disabled, clearable = false, emptyText, className = '',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Title of the phone sheet (usually the field's label). */
  label?: string;
  error?: string | boolean | null;
  disabled?: boolean;
  clearable?: boolean;
  emptyText?: string;
  className?: string;
}) {
  const { t } = useTranslation('common');
  const phone = useMediaQuery('(max-width: 639px)');
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find(o => o.value === value);
  const matches = useMemo(() => {
    const q = norm(query);
    return q ? options.filter(o => norm(`${o.label} ${o.sub ?? ''} ${o.keywords ?? ''}`).includes(q)) : options;
  }, [options, query]);
  const shown = matches.slice(0, MAX_ROWS);

  const close = () => { setOpen(false); setQuery(''); };
  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setActive(Math.max(0, options.findIndex(o => o.value === value)));
  };
  const pick = (o: SelectOption) => {
    if (o.disabled) return;
    onChange(o.value);
    close();
  };

  // Focus the search box once it is on screen.
  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);

  // Desktop: a click outside closes the list.
  useEffect(() => {
    if (!open || phone) return;
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, phone]);

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) pick(shown[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };

  const search = (
    <div className="flex items-center gap-2 border-b border-slate-100 px-3">
      <Search size={16} className="text-slate-400 shrink-0" />
      <input ref={searchRef} value={query} dir="auto" onKeyDown={onKey}
        onChange={e => { setQuery(e.target.value); setActive(0); }}
        placeholder={t('select.search')} aria-label={t('select.search')}
        role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
        style={{ outline: 'none' }} className="flex-1 min-w-0 py-3 sm:py-2.5 text-base sm:text-sm bg-transparent" />
      {query && (
        <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label={t('select.clear_search')}
          className="p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
      )}
    </div>
  );

  const list = (
    <ul ref={listRef} id={listId} role="listbox" className={`overflow-y-auto overscroll-contain ${phone ? 'flex-1' : 'max-h-64'}`}>
      {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">{emptyText ?? t('select.no_results')}</li>}
      {shown.map((o, i) => {
        const isSel = o.value === value;
        return (
          <li key={o.value} id={`${listId}-${i}`} data-index={i} role="option" aria-selected={isSel} aria-disabled={o.disabled || undefined}
            onMouseEnter={() => setActive(i)} onClick={() => pick(o)}
            className={`flex items-center gap-3 px-4 min-h-12 sm:min-h-10 py-2 text-sm cursor-pointer select-none
              ${o.disabled ? 'opacity-40 cursor-not-allowed' : ''} ${i === active ? 'bg-slate-100' : ''} ${isSel ? 'text-blue-700 font-medium' : 'text-slate-700'}`}>
            <span className="flex-1 min-w-0">
              <span className="block truncate">{o.label}</span>
              {o.sub && <span className="block truncate text-xs text-slate-400 font-normal">{o.sub}</span>}
            </span>
            {isSel && <Check size={16} className="shrink-0" />}
          </li>
        );
      })}
      {matches.length > MAX_ROWS && <li className="px-4 py-2 text-center text-xs text-slate-400">{t('select.more', { count: matches.length - MAX_ROWS })}</li>}
    </ul>
  );

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button type="button" id={id} onClick={() => (open ? close() : openList())} disabled={disabled}
        onKeyDown={e => { if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openList(); } }}
        aria-haspopup="listbox" aria-expanded={open}
        className={`${frameClass(error)} w-full items-center gap-2 px-3 py-2.5 sm:py-2 text-start text-base sm:text-sm disabled:bg-slate-50 disabled:cursor-not-allowed`}>
        <span className={`flex-1 min-w-0 truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected ? (selected.selectedLabel ?? selected.label) : (placeholder ?? t('select.placeholder'))}
        </span>
        {clearable && selected && !disabled && (
          <span role="button" tabIndex={-1} aria-label={t('select.clear')}
            onClick={e => { e.stopPropagation(); onChange(''); }}
            className="p-1 -m-1 rounded text-slate-400 hover:text-slate-600"><X size={14} /></span>
        )}
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !phone && (
        <div className="absolute z-40 mt-1 w-full min-w-56 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {search}
          {list}
        </div>
      )}

      {open && phone && (
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={close}>
          <div role="dialog" aria-modal="true" aria-label={label ?? placeholder}
            onClick={e => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-white shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
              <span className="mx-auto absolute left-1/2 -translate-x-1/2 top-1.5 h-1 w-10 rounded-full bg-slate-300" aria-hidden />
              <p className="text-sm font-semibold text-slate-800 truncate mt-1">{label ?? placeholder ?? t('select.placeholder')}</p>
              <button type="button" onClick={close} aria-label={t('ui.close')} className="p-2 -m-2 text-slate-400"><X size={18} /></button>
            </div>
            {search}
            {list}
          </div>
        </div>
      )}
    </div>
  );
}
