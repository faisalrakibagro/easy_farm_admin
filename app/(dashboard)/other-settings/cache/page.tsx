'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CacheLog } from '@/types';
import { localeFor } from '@/lib/languages';
import {
  RefreshCw, Trash2, CheckCircle, XCircle, Clock,
  Database, Settings, Route, Eye, Shield, Zap, AlertTriangle,
  PackagePlus, Lock,
} from 'lucide-react';

interface CacheStatus {
  last_cleared: Record<string, string | null>;
  logs: CacheLog[];
}

const CLEAR_TYPES = [
  { key: 'all',         icon: Zap,         endpoint: 'clear-all',         color: 'red'    },
  { key: 'config',      icon: Settings,    endpoint: 'clear-config',      color: 'blue'   },
  { key: 'route',       icon: Route,       endpoint: 'clear-route',       color: 'indigo' },
  { key: 'view',        icon: Eye,         endpoint: 'clear-view',        color: 'purple' },
  { key: 'application', icon: Database,    endpoint: 'clear-application', color: 'orange' },
  { key: 'permission',  icon: Shield,      endpoint: 'clear-permission',  color: 'green'  },
  { key: 'event',       icon: Zap,         endpoint: 'clear-event',       color: 'pink'   },
  { key: 'optimized',   icon: PackagePlus, endpoint: 'clear-optimized',   color: 'teal'   },
] as const;

const REBUILD_TYPES = [
  { key: 'rebuild-route',  icon: Route,    endpoint: 'rebuild-route',  color: 'indigo' },
  { key: 'rebuild-view',   icon: Eye,      endpoint: 'rebuild-view',   color: 'purple' },
] as const;

type CacheKey = typeof CLEAR_TYPES[number]['key'] | typeof REBUILD_TYPES[number]['key'];

const COLOR_MAP: Record<string, { bg: string; icon: string; btn: string; rebuildBtn: string }> = {
  red:    { bg: 'bg-red-50',    icon: 'text-red-500',    btn: 'bg-red-500 hover:bg-red-600',       rebuildBtn: 'bg-red-100 hover:bg-red-200 text-red-700'       },
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   btn: 'bg-blue-500 hover:bg-blue-600',     rebuildBtn: 'bg-blue-100 hover:bg-blue-200 text-blue-700'     },
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-500', btn: 'bg-indigo-500 hover:bg-indigo-600', rebuildBtn: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'},
  purple: { bg: 'bg-purple-50', icon: 'text-purple-500', btn: 'bg-purple-500 hover:bg-purple-600', rebuildBtn: 'bg-purple-100 hover:bg-purple-200 text-purple-700'},
  orange: { bg: 'bg-orange-50', icon: 'text-orange-500', btn: 'bg-orange-500 hover:bg-orange-600', rebuildBtn: 'bg-orange-100 hover:bg-orange-200 text-orange-700'},
  green:  { bg: 'bg-green-50',  icon: 'text-green-500',  btn: 'bg-green-500 hover:bg-green-600',   rebuildBtn: 'bg-green-100 hover:bg-green-200 text-green-700'  },
  pink:   { bg: 'bg-pink-50',   icon: 'text-pink-500',   btn: 'bg-pink-500 hover:bg-pink-600',     rebuildBtn: 'bg-pink-100 hover:bg-pink-200 text-pink-700'     },
  teal:   { bg: 'bg-teal-50',   icon: 'text-teal-500',   btn: 'bg-teal-500 hover:bg-teal-600',     rebuildBtn: 'bg-teal-100 hover:bg-teal-200 text-teal-700'     },
};

function formatRelative(iso: string | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!iso) return t('cache.never');
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return t('cache.just_now');
  if (mins < 60) return t('cache.mins_ago', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return t('cache.hours_ago', { count: hrs });
  return new Date(iso).toLocaleDateString(localeFor());
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString(localeFor(), {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function CachePage() {
  const { t } = useTranslation('settings');
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canRebuild = hasPermission('cache.rebuild');

  const [active, setActive] = useState<CacheKey | null>(null);
  const [flash, setFlash] = useState<{ key: CacheKey; ok: boolean } | null>(null);

  const { data, isLoading } = useQuery<CacheStatus>({
    queryKey: ['cache-status'],
    queryFn: async () => (await api.get('/cache')).data,
    refetchInterval: 5 * 60 * 1000,  // 5 minutes
  });

  const runMutation = useMutation({
    mutationFn: async (endpoint: string) => (await api.post(`/cache/${endpoint}`)).data,
    onMutate: (endpoint) => {
      const key = [...CLEAR_TYPES, ...REBUILD_TYPES].find(t => t.endpoint === endpoint)?.key ?? null;
      setActive(key as CacheKey);
    },
    onSuccess: (_, endpoint) => {
      qc.invalidateQueries({ queryKey: ['cache-status'] });
      const key = [...CLEAR_TYPES, ...REBUILD_TYPES].find(t => t.endpoint === endpoint)?.key ?? 'all';
      setFlash({ key: key as CacheKey, ok: true });
      setTimeout(() => setFlash(null), 3000);
    },
    onError: (_, endpoint) => {
      const key = [...CLEAR_TYPES, ...REBUILD_TYPES].find(t => t.endpoint === endpoint)?.key ?? 'all';
      setFlash({ key: key as CacheKey, ok: false });
      setTimeout(() => setFlash(null), 4000);
    },
    onSettled: () => setActive(null),
  });

  const lastCleared = data?.last_cleared ?? {};
  const logs = data?.logs ?? [];

  return (
    <div className="space-y-8">

      {/* ── Clear Caches ─────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Trash2 size={16} className="text-slate-500" />
          <h2 className="font-semibold text-slate-700">{t('cache.clear_section')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {CLEAR_TYPES.map(({ key, icon: Icon, endpoint, color }) => {
            const c = COLOR_MAP[color];
            const isThis = active === key;
            const didFlash = flash?.key === key;
            return (
              <div key={key} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={18} className={c.icon} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm leading-tight">{t(`cache.types.${key}`)}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-tight">{t(`cache.types.${key}_desc`)}</p>
                    </div>
                  </div>
                  {didFlash && (
                    flash.ok
                      ? <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                      : <XCircle    size={16} className="text-red-500  flex-shrink-0 mt-0.5" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock size={11} />
                  <span>{t('cache.last')} <span className="font-medium text-slate-600">{formatRelative(lastCleared[key] ?? null, t)}</span></span>
                </div>
                <button
                  onClick={() => runMutation.mutate(endpoint)}
                  disabled={runMutation.isPending}
                  className={`mt-auto flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${c.btn}`}
                >
                  <RefreshCw size={12} className={isThis ? 'animate-spin' : ''} />
                  {isThis ? t('cache.clearing') : key === 'all' ? t('cache.clear_all') : t('cache.clear')}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Rebuild Caches (Super Admin only) ────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <PackagePlus size={16} className="text-slate-500" />
          <h2 className="font-semibold text-slate-700">{t('cache.rebuild_section')}</h2>
          {!canRebuild && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <Lock size={10} /> {t('cache.super_admin_only')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REBUILD_TYPES.map(({ key, icon: Icon, endpoint, color }) => {
            const c = COLOR_MAP[color];
            const isThis = active === key;
            const didFlash = flash?.key === key;
            const typeKey = key.replace('rebuild-', '');
            return (
              <div
                key={key}
                className={`bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3 ${!canRebuild ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={18} className={c.icon} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm leading-tight">{t(`cache.rebuild_types.${typeKey}`)}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-tight">{t(`cache.rebuild_types.${typeKey}_desc`)}</p>
                    </div>
                  </div>
                  {didFlash && (
                    flash.ok
                      ? <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                      : <XCircle    size={16} className="text-red-500  flex-shrink-0 mt-0.5" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock size={11} />
                  <span>{t('cache.last')} <span className="font-medium text-slate-600">{formatRelative(lastCleared[key] ?? null, t)}</span></span>
                </div>
                <button
                  onClick={() => canRebuild && runMutation.mutate(endpoint)}
                  disabled={runMutation.isPending || !canRebuild}
                  className={`mt-auto flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${c.rebuildBtn}`}
                >
                  <PackagePlus size={12} className={isThis ? 'animate-spin' : ''} />
                  {isThis ? t('cache.rebuilding') : t('cache.rebuild')}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Production Notice ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>{t('cache.production.clear_safe')}</p>
          <p>{t('cache.production.rebuild_safe')}</p>
          <p>{t('cache.production.permission_note')}</p>
        </div>
      </div>

      {/* ── Activity Log ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">{t('cache.recent_activity')}</h2>
          {isLoading && <RefreshCw size={14} className="animate-spin text-slate-400" />}
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Trash2 size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">{t('cache.no_activity')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('cache.no_activity_desc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-4">
                {log.status === 'success'
                  ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                  : <XCircle    size={16} className="text-red-500  flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-700 capitalize">
                      {log.type.replace(/-/g, ' ')}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  {log.performed_by_user && (
                    <p className="text-xs text-slate-400 mt-0.5">{t('cache.by')} {log.performed_by_user.name}</p>
                  )}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{formatDatetime(log.cleared_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
