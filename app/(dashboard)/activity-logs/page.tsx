'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityLog, User } from '@/types';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { localeFor } from '@/lib/languages';
import { activityText, changeValue, eventLabel, fieldLabel, logNameLabel, recordLabel } from '@/lib/activityText';

const MODULE_KEYS = ['', 'auth', 'cattle', 'breeding', 'dairy', 'byproducts', 'feed', 'medicine', 'labour', 'finance', 'accounting', 'suppliers', 'customers', 'partners', 'master_data', 'users', 'default'] as const;

const EVENT_KEYS = ['login', 'logout', 'created', 'updated', 'deleted', 'restored', 'force_deleted', 'sold', 'dead', 'transferred', 'purpose_changed', 'uploaded'] as const;

const EVENT_COLORS: Record<string, string> = {
  login:   'bg-green-50 text-green-700 border border-green-200',
  logout:  'bg-slate-100 text-slate-600 border border-slate-200',
  created: 'bg-blue-50 text-blue-700 border border-blue-200',
  updated: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  deleted: 'bg-red-50 text-red-700 border border-red-200',
  force_deleted: 'bg-red-50 text-red-700 border border-red-200',
  restored:'bg-purple-50 text-purple-700 border border-purple-200',
  sold:    'bg-green-50 text-green-700 border border-green-200',
};

const MODULE_COLORS: Record<string, string> = {
  auth:        'bg-green-100 text-green-700',
  cattle:      'bg-orange-100 text-orange-700',
  feed:        'bg-lime-100 text-lime-700',
  medicine:    'bg-pink-100 text-pink-700',
  labour:      'bg-cyan-100 text-cyan-700',
  finance:     'bg-violet-100 text-violet-700',
  accounting:  'bg-indigo-100 text-indigo-700',
  suppliers:   'bg-amber-100 text-amber-700',
  partners:    'bg-teal-100 text-teal-700',
  master_data: 'bg-slate-100 text-slate-700',
  users:       'bg-blue-100 text-blue-700',
  customers:   'bg-sky-100 text-sky-700',
  breeding:    'bg-rose-100 text-rose-700',
  dairy:       'bg-emerald-100 text-emerald-700',
  byproducts:  'bg-yellow-100 text-yellow-700',
  default:     'bg-slate-100 text-slate-500',
};

function ChangesPanel({ changes }: { changes: { old: Record<string, unknown>; new: Record<string, unknown> } }) {
  const { t } = useTranslation(['settings', 'common', 'activity']);
  const { old: oldVals, new: newVals } = changes;
  const keys = Array.from(new Set([...Object.keys(oldVals ?? {}), ...Object.keys(newVals ?? {})]));
  if (!keys.length) return null;

  return (
    <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden text-xs">
      <div className="hidden sm:grid grid-cols-3 gap-x-3 bg-slate-50 px-3 py-1.5 font-medium text-slate-500">
        <span>{t('activity_logs.changes.field')}</span><span>{t('activity_logs.changes.old_value')}</span><span>{t('activity_logs.changes.new_value')}</span>
      </div>
      {/* Values wrap in full; on a phone the field, old and new value stack. */}
      {keys.map(key => (
        <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-0.5 px-3 py-2 sm:py-1.5 border-t max-sm:[&:nth-child(2)]:border-t-0 border-slate-100 hover:bg-slate-50 [&>*]:min-w-0 [&>*]:[overflow-wrap:anywhere]">
          <span className="font-medium text-slate-600" title={key}>{fieldLabel(key, t)}</span>
          <span className="text-red-500">
            <span className="sm:hidden text-slate-400 me-1">{t('activity_logs.changes.old_value')}</span>
            {oldVals?.[key] != null ? changeValue(key, oldVals[key], t) : <span className="text-slate-300">—</span>}
          </span>
          <span className="text-green-600">
            <span className="sm:hidden text-slate-400 me-1">{t('activity_logs.changes.new_value')}</span>
            {newVals?.[key] != null ? changeValue(key, newVals[key], t) : <span className="text-slate-300">—</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

type LogWithChanges = ActivityLog & {
  changes?: { old: Record<string, unknown>; new: Record<string, unknown> };
  subject_type?: string;
  properties?: Record<string, unknown>;
  /** Message key + raw values of the line (null on older rows) — see lib/activityText. */
  key?: string | null;
  params?: Record<string, string | number | null> | null;
};

export default function ActivityLogsPage() {
  const { t } = useTranslation(['settings', 'common', 'activity']);
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    user_id: '',
    date_from: '',
    date_to: '',
    event: '',
    log_name: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['activity-logs', page, filters],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: 20 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get('/activity-logs', { params });
      return res.data;
    },
  });

  // Pick a person by name instead of typing their ID — only for roles that may list users.
  const canListUsers = hasPermission('users.view');
  const { data: userOptions } = useQuery({
    queryKey: ['users', 'activity-filter'],
    queryFn: async () => (await api.get('/users', { params: { per_page: 100 } })).data.data as User[],
    enabled: canListUsers,
    staleTime: 5 * 60 * 1000,
  });

  const logs: LogWithChanges[] = data?.activities?.data ?? data?.activities ?? [];
  const meta = data?.meta ?? {};
  const totalPages = meta?.last_page ?? 1;

  const clearFilters = () => {
    setFilters({ user_id: '', date_from: '', date_to: '', event: '', log_name: '', search: '' });
    setPage(1);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const hasChanges = (log: LogWithChanges) => {
    const c = log.changes;
    return c && (Object.keys(c.old ?? {}).length > 0 || Object.keys(c.new ?? {}).length > 0);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            className="flex items-center gap-2 min-h-10 text-sm text-slate-600 hover:text-slate-800"
          >
            <Filter size={15} />
            {t('activity_logs.filters_label')}
            {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-500" />}
          </button>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="flex items-center gap-1.5 min-h-10 text-xs text-red-500 hover:text-red-700">
              <X size={13} /> {t('activity_logs.clear_filters')}
            </button>
          )}
        </div>

        {showFilters && (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            {/* Search */}
            <div>
              <label htmlFor="al-search" className="block text-xs font-medium text-slate-600 mb-1">{t('activity_logs.filter_field.search_description')}</label>
              <input
                id="al-search"
                type="text"
                value={filters.search}
                onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
                placeholder={t('activity_logs.filter_field.search_description')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* User */}
            <div>
              <label htmlFor="al-user" className="block text-xs font-medium text-slate-600 mb-1">
                {userOptions ? t('activity_logs.col.user') : t('activity_logs.filter_field.user_id')}
              </label>
              {userOptions ? (
                <select
                  id="al-user"
                  value={filters.user_id}
                  onChange={e => { setFilters(f => ({ ...f, user_id: e.target.value })); setPage(1); }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('activity_logs.filter.all_users')}</option>
                  {userOptions.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                </select>
              ) : (
                <input
                  id="al-user"
                  type="text"
                  inputMode="numeric"
                  value={filters.user_id}
                  onChange={e => { setFilters(f => ({ ...f, user_id: e.target.value })); setPage(1); }}
                  placeholder={t('activity_logs.filter_field.user_id_placeholder')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Module / Log Name */}
            <div>
              <label htmlFor="al-module" className="block text-xs font-medium text-slate-600 mb-1">{t('activity_logs.filter_field.module')}</label>
              <select
                id="al-module"
                value={filters.log_name}
                onChange={e => { setFilters(f => ({ ...f, log_name: e.target.value })); setPage(1); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MODULE_KEYS.map(key => (
                  <option key={key} value={key}>
                    {key === '' ? t('activity:log_name.all') : logNameLabel(key, t)}
                  </option>
                ))}
              </select>
            </div>

            {/* Event */}
            <div>
              <label htmlFor="al-event" className="block text-xs font-medium text-slate-600 mb-1">{t('activity_logs.filter_field.event')}</label>
              <select
                id="al-event"
                value={filters.event}
                onChange={e => { setFilters(f => ({ ...f, event: e.target.value })); setPage(1); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('activity_logs.filter.all_events')}</option>
                {EVENT_KEYS.map(key => (
                  <option key={key} value={key}>{eventLabel(key, t)}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label htmlFor="al-from" className="block text-xs font-medium text-slate-600 mb-1">{t('activity_logs.filter_field.date_from')}</label>
              <input
                id="al-from"
                type="date"
                value={filters.date_from}
                onChange={e => { setFilters(f => ({ ...f, date_from: e.target.value })); setPage(1); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label htmlFor="al-to" className="block text-xs font-medium text-slate-600 mb-1">{t('activity_logs.filter_field.date_to')}</label>
              <input
                id="al-to"
                type="date"
                value={filters.date_to}
                onChange={e => { setFilters(f => ({ ...f, date_to: e.target.value })); setPage(1); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* ── Mobile card view (hidden on sm+) ── */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {isLoading
            ? [...Array(8)].map((_, i) => (
                <div key={i} className="p-4 space-y-3 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-4 bg-slate-100 rounded w-1/4" />
                    <div className="h-4 bg-slate-100 rounded w-1/3" />
                  </div>
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-3 bg-slate-100 rounded" />
                    <div className="h-3 bg-slate-100 rounded" />
                  </div>
                </div>
              ))
            : logs.length === 0
              ? (
                <div className="px-4 py-10 text-center text-slate-400">{t('activity_logs.no_logs')}</div>
              )
              : logs.map((log) => (
                <div key={log.id}>
                  {/* Card: event + model_type at top, tappable if has changes */}
                  <div
                    className={`p-4 ${hasChanges(log) ? 'cursor-pointer' : ''}`}
                    onClick={() => hasChanges(log) && toggleRow(log.id)}
                  >
                    {/* Card header: event badge + module badge + expand icon */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {log.event ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[log.event] ?? 'bg-slate-100 text-slate-600'}`}>
                            {eventLabel(log.event, t)}
                          </span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODULE_COLORS[log.log_name] ?? MODULE_COLORS.default}`}>
                          {logNameLabel(log.log_name, t)}
                        </span>
                      </div>
                      {hasChanges(log) && (
                        expandedRows.has(log.id)
                          ? <ChevronUp size={14} className="text-slate-400 shrink-0" />
                          : <ChevronDown size={14} className="text-slate-400 shrink-0" />
                      )}
                    </div>

                    {/* Description */}
                    <div className="mb-3">
                      <p className="text-sm text-slate-700 line-clamp-2">{activityText(log, t)}</p>
                      {log.subject_type && (
                        <p className="text-xs text-slate-400 mt-0.5">{recordLabel(log.subject_type, log.subject_id, t)}</p>
                      )}
                    </div>

                    {/* Card grid: causer, date */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-400 block">{t('activity_logs.col.performer')}</span>
                        {log.causer ? (
                          <span className="text-slate-700 font-medium">{log.causer.name}</span>
                        ) : (
                          <span className="text-slate-400">{t('activity_logs.system_label')}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 block">{t('activity_logs.col.date_time')}</span>
                        <span className="text-slate-600">{new Date(log.created_at).toLocaleString(localeFor())}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded changes panel */}
                  {expandedRows.has(log.id) && hasChanges(log) && (
                    <div className="px-4 pb-4 bg-slate-50/50">
                      <ChangesPanel changes={log.changes!} />
                    </div>
                  )}
                </div>
              ))
          }
        </div>

        {/* ── Desktop table (hidden on mobile) ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-start px-4 py-3 font-medium text-slate-600 w-6"></th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('activity_logs.col.event')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('activity_logs.col.description')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('activity_logs.col.performer')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('activity_logs.col.model')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('activity_logs.col.record')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('activity_logs.col.date_time')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">{t('activity_logs.no_logs')}</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      className={`hover:bg-slate-50 ${hasChanges(log) ? 'cursor-pointer' : ''}`}
                      onClick={() => hasChanges(log) && toggleRow(log.id)}
                    >
                      {/* Expand toggle */}
                      <td className="px-4 py-3 text-slate-400">
                        {hasChanges(log) && (
                          expandedRows.has(log.id)
                            ? <ChevronUp size={14} />
                            : <ChevronDown size={14} />
                        )}
                      </td>

                      {/* Event badge */}
                      <td className="px-4 py-3">
                        {log.event ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[log.event] ?? 'bg-slate-100 text-slate-600'}`}>
                            {eventLabel(log.event, t)}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 text-slate-700 max-w-xs">
                        <p className="truncate">{activityText(log, t)}</p>
                      </td>

                      {/* Causer */}
                      <td className="px-4 py-3">
                        {log.causer ? (
                          <div>
                            <p className="font-medium text-slate-700">{log.causer.name}</p>
                            <p className="text-xs text-slate-400">{log.causer.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">{t('common:ui.system')}</span>
                        )}
                      </td>

                      {/* Module */}
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODULE_COLORS[log.log_name] ?? MODULE_COLORS.default}`}>
                          {logNameLabel(log.log_name, t)}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {log.subject_type && (
                          <span>{recordLabel(log.subject_type, log.subject_id, t)}</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString(localeFor())}
                      </td>
                    </tr>

                    {/* Expanded Changes Row */}
                    {expandedRows.has(log.id) && hasChanges(log) && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="px-6 pb-3">
                          <ChangesPanel changes={log.changes!} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {(meta?.total ?? 0) > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              {t('common:pagination.page_of', { current: page, total: totalPages })} &bull; {t('common:pagination.total_count', { count: meta?.total ?? 0 })}
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                {t('common:btn.prev')}
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                {t('common:btn.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
