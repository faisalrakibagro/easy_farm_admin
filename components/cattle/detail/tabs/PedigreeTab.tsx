'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { GitBranch } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import type { CattlePedigree, CattlePurposeHistory, PedigreeAnimal } from '@/types';
import { fmtDate, fmtNum } from '@/lib/format';

interface PedigreeTabProps {
  cattleId: number;
}

/** One relative as a compact, clickable card. */
function AnimalCard({ animal, role, highlight = false }: { animal: PedigreeAnimal | null; role: string; highlight?: boolean }) {
  const { t } = useTranslation('cattle');

  if (!animal) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 bg-slate-50/50">
        <p className="text-[11px] text-slate-400">{role}</p>
        <p className="text-sm text-slate-400">{t('breeding.unknown')}</p>
      </div>
    );
  }

  const born = animal.birth_date ?? animal.purchase_date;

  return (
    <Link href={`/farm/cattle/${animal.id}`}
      className={`block rounded-lg border px-3 py-2 hover:shadow-sm transition-shadow ${highlight ? 'border-blue-300 bg-blue-50' : animal.gender === 'female' ? 'border-pink-200 bg-pink-50/40' : 'border-indigo-200 bg-indigo-50/40'}`}>
      <p className="text-[11px] text-slate-500">{role}</p>
      <p className="text-sm font-semibold text-slate-800 truncate">
        {animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}
      </p>
      <p className="text-[11px] text-slate-500 truncate">
        {animal.breed}
        {born ? ` · ${born}` : ''}
        {animal.status !== 'active' ? ` · ${t('status.' + animal.status)}` : ''}
        {animal.is_deleted ? ` · ${t('breeding.pedigree.deleted')}` : ''}
      </p>
    </Link>
  );
}

export default function PedigreeTab({ cattleId }: PedigreeTabProps) {
  const { t } = useTranslation('cattle');

  const { data, isLoading, isError } = useQuery<CattlePedigree>({
    queryKey: ['cattle-pedigree', cattleId],
    queryFn: async () => (await api.get(`/farm/cattle/${cattleId}/pedigree`)).data,
  });

  const { data: historyData } = useQuery<{ purpose: string; history: CattlePurposeHistory[] }>({
    queryKey: ['cattle-purpose-history', cattleId],
    queryFn: async () => (await api.get(`/farm/cattle/${cattleId}/purpose-history`)).data,
  });

  if (isLoading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-5 h-48 animate-pulse" />;
  }
  if (isError || !data) {
    return <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{t('breeding.pedigree.load_failed')}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Family tree: grandparents → parents → this animal */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <GitBranch size={15} className="text-slate-400" /> {t('breeding.pedigree.title')}
        </h3>

        <p className="text-xs font-medium text-slate-500 mb-2">{t('breeding.pedigree.grandparents')}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          <AnimalCard animal={data.dam?.dam ?? null}   role={t('breeding.pedigree.maternal_grand_dam')} />
          <AnimalCard animal={data.dam?.sire ?? null}  role={t('breeding.pedigree.maternal_grand_sire')} />
          <AnimalCard animal={data.sire?.dam ?? null}  role={t('breeding.pedigree.paternal_grand_dam')} />
          <AnimalCard animal={data.sire?.sire ?? null} role={t('breeding.pedigree.paternal_grand_sire')} />
        </div>

        <p className="text-xs font-medium text-slate-500 mb-2">{t('breeding.pedigree.parents')}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <AnimalCard animal={data.dam}  role={t('breeding.dam')} />
          <AnimalCard animal={data.sire} role={t('breeding.sire')} />
        </div>

        <div className="max-w-sm mx-auto">
          <AnimalCard animal={data.animal} role={t('breeding.purpose.' + data.animal.purpose)} highlight />
        </div>
      </div>

      {/* Offspring */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-700">{t('breeding.pedigree.offspring')}</h3>
          {data.counts.offspring > 0 && (
            <span className="text-xs text-slate-500">
              {t('breeding.pedigree.offspring_count', { count: fmtNum(data.counts.offspring), female: fmtNum(data.counts.female), male: fmtNum(data.counts.male) })}
            </span>
          )}
        </div>
        {data.offspring.length === 0 ? (
          <p className="text-sm text-slate-400">{t('breeding.pedigree.no_offspring')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.offspring.map(o => (
              <AnimalCard key={o.id} animal={o} role={t('gender.' + o.gender)} />
            ))}
          </div>
        )}
      </div>

      {/* Siblings */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('breeding.pedigree.siblings')}</h3>
        {data.siblings.length === 0 ? (
          <p className="text-sm text-slate-400">{t('breeding.pedigree.no_siblings')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.siblings.map(s => (
              <AnimalCard key={s.id} animal={s}
                role={`${t('breeding.pedigree.sibling_' + s.relation)} · ${t('gender.' + s.gender)}`} />
            ))}
          </div>
        )}
      </div>

      {/* Purpose history */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('breeding.purpose_change.history')}</h3>
        {(historyData?.history ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">{t('breeding.purpose_change.no_history')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {historyData!.history.map(h => (
              <li key={h.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-slate-700">
                    {h.from_purpose ? `${t('breeding.purpose.' + h.from_purpose)} → ` : ''}
                    <span className="font-medium">{t('breeding.purpose.' + h.to_purpose)}</span>
                  </p>
                  {h.reason && <p className="text-xs text-slate-400 truncate">{h.reason}</p>}
                </div>
                <div className="text-end flex-shrink-0">
                  <p className="text-xs text-slate-500">{fmtDate(h.changed_on)}</p>
                  {h.changed_by?.name && <p className="text-[11px] text-slate-400">{h.changed_by.name}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
