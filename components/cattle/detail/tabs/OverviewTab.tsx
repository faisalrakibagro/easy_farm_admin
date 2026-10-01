'use client';

import { useTranslation } from 'react-i18next';
import { ENTRY_TYPE_COLOR } from './types';
import type { CattleDetail } from './types';
import { animalTypeName } from '@/lib/animalType';
import Link from '@/components/ui/AppLink';
import { fmtMoney } from '@/lib/format';

interface OverviewTabProps {
  cattle: CattleDetail;
  breakdown: Record<string, number>;
}

export default function OverviewTab({ cattle, breakdown }: OverviewTabProps) {
  const { t } = useTranslation('cattle');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('detail.animal_information')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { label: t('field.tag_number'),  value: cattle.tag_number },
            { label: t('field.ear_tag'),     value: cattle.ear_tag_number || '—' },
            { label: t('field.animal_type'), value: animalTypeName(cattle.animal_type) ?? '—' },
            { label: t('field.breed'),       value: cattle.breed },
            { label: t('field.gender'),      value: t('gender.' + cattle.gender, { defaultValue: cattle.gender }) },
            { label: t('field.color'),       value: cattle.color || '—' },
            { label: t('field.age_category'), value: cattle.ageCategory?.name || '—' },
            { label: t('field.shed'),        value: cattle.shed?.name || '—' },
            { label: t('col.status'),      value: t('status.' + cattle.status, { defaultValue: cattle.status }) },
            { label: t('breeding.origin_label'),  value: t('breeding.origin.' + (cattle.origin ?? 'purchased')) },
            { label: t('breeding.purpose_label'), value: cattle.purpose ? t('breeding.purpose.' + cattle.purpose) : '—' },
            ...(cattle.birth_date ? [{ label: t('breeding.birth_date'), value: cattle.birth_date.split('T')[0] }] : []),
            ...(cattle.birth_weight ? [{ label: t('breeding.birth_weight'), value: `${parseFloat(cattle.birth_weight)}` }] : []),
            ...(cattle.gender === 'female' ? [{
              label: t('breeding.reproductive_status_label'),
              value: cattle.reproductive_status ? t('breeding.reproductive_status.' + cattle.reproductive_status) : t('breeding.not_set'),
            }] : []),
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
              <p className="text-sm font-medium text-slate-700 capitalize">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Parents — full tree on the Pedigree tab */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-2 gap-4">
          {([['dam', cattle.dam], ['sire', cattle.sire]] as const).map(([role, parent]) => (
            <div key={role}>
              <p className="text-xs text-slate-400 mb-0.5">{t('breeding.' + role)}</p>
              {parent ? (
                <Link href={`/farm/cattle/${parent.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                  {parent.tag_number}{parent.name ? ` — ${parent.name}` : ''}
                </Link>
              ) : (
                <p className="text-sm text-slate-400">{t('breeding.unknown')}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {Object.keys(breakdown).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('detail.cost_breakdown')}</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(breakdown).map(([type, amount]) => (
              <div key={type} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${ENTRY_TYPE_COLOR[type] ?? 'bg-slate-50 text-slate-600'}`}>
                <span className="capitalize">{t(`detail.entry_type.${type}`, { defaultValue: type })}</span>
                <span>{fmtMoney(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(cattle.seller_name || cattle.seller_phone || cattle.seller_address) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('detail.supplier_information')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {cattle.seller_name && <div><p className="text-xs text-slate-400">{t('detail.supplier_name_label')}</p><p className="text-sm font-medium text-slate-700">{cattle.seller_name}</p></div>}
            {cattle.seller_phone && <div><p className="text-xs text-slate-400">{t('field.seller_phone')}</p><p className="text-sm font-medium text-slate-700">{cattle.seller_phone}</p></div>}
            {cattle.seller_address && <div><p className="text-xs text-slate-400">{t('label.address')}</p><p className="text-sm font-medium text-slate-700">{cattle.seller_address}</p></div>}
          </div>
        </div>
      )}

      {cattle.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 mb-1">{t('field.notes')}</p>
          <p className="text-sm text-amber-800">{cattle.notes}</p>
        </div>
      )}
    </div>
  );
}
