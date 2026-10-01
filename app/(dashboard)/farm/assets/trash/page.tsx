'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Trash2 } from 'lucide-react';
import type { FixedAsset } from '@/types';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

type FixedAssetTrashed = FixedAsset;

const fmt = (n: number | string) => fmtMoney(Math.abs(Number(n)));

export default function FixedAssetsTrashPage() {
  const { t } = useTranslation(['assets', 'common']);
  const { hasPermission } = useAuth();
  const canDelete = hasPermission('farm.assets.delete');

  const columns: TrashColumn<FixedAssetTrashed>[] = [
    {
      key: 'name',
      header: t('table.name'),
      primary: true,
      render: (a) => (
        <div>
          <p className="font-medium text-slate-700">{a.name}</p>
          {a.vendor_name && <p className="text-xs text-slate-400">{a.vendor_name}</p>}
        </div>
      ),
    },
    {
      key: 'category',
      header: t('table.category'),
      render: (a) => t(`category.${a.category}`),
    },
    {
      key: 'purchase_price',
      header: t('table.purchase_price'),
      align: 'right',
      render: (a) => fmt(a.purchase_price),
    },
    {
      key: 'deleted_at',
      header: t('common:deleted_at'),
      align: 'center',
      className: 'text-xs text-slate-400',
      render: (a) => (a.deleted_at ? new Date(a.deleted_at).toLocaleDateString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<FixedAssetTrashed>
      title={t('trash.title')}
      subtitle={t('subtitle')}
      backHref="/farm/assets"
      apiBasePath="/farm/assets"
      queryKey="fixed-assets-trash"
      invalidateOnRestore={['fixed-assets', 'fixed-assets-summary']}
      invalidateOnForceDelete={['fixed-assets', 'fixed-assets-summary']}
      money
      columns={columns}
      canRestore={canDelete}
      canForceDelete={canDelete}
      restoreMessages={{ success: t('common:restored'), error: t('common:error.generic') }}
      forceDeleteMessages={{ success: t('common:deleted'), error: t('common:error.failed_delete') }}
      emptyIcon={Trash2}
      emptyTitle={t('empty_trash')}
      labels={{
        restore: t('trash.restore'),
        forceDelete: t('trash.force_delete'),
        confirmMessage: t('trash.force_delete_confirm'),
        confirmLabel: t('trash.force_delete'),
        searchPlaceholder: t('search_placeholder'),
      }}
    />
  );
}
