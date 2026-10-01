'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { MediaFile } from '@/types';
import { Trash2, Image, Film, Music, FileText, Files } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtNum } from '@/lib/format';

function FileTypeIcon({ type }: { type: string }) {
  const props = { size: 20, className: 'flex-shrink-0' };
  if (type === 'image') return <Image {...props} className="text-blue-400" />;
  if (type === 'video') return <Film {...props} className="text-purple-400" />;
  if (type === 'audio') return <Music {...props} className="text-green-400" />;
  return <FileText {...props} className="text-orange-400" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${fmtNum(bytes)} B`;
  if (bytes < 1048576) return `${fmtNum(bytes / 1024, 1)} KB`;
  return `${fmtNum(bytes / 1048576, 1)} MB`;
}

export default function MediaAssetsTrashPage() {
  const { t } = useTranslation(['media', 'common']);
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  const columns: TrashColumn<MediaFile>[] = [
    {
      key: 'file',
      header: t('assets.col.file'),
      primary: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <FileTypeIcon type={item.type} />
          <div className="min-w-0">
            <p className="font-medium text-slate-600 truncate max-w-[200px]">{item.title || item.name}</p>
            <p className="text-xs text-slate-400 truncate">{item.file_name}</p>
          </div>
        </div>
      ),
    },
    { key: 'type', header: t('assets.col.type'), render: (item) => <span className="capitalize text-slate-500">{item.type}</span> },
    { key: 'size', header: t('assets.col.size'), className: 'text-xs text-slate-400', render: (item) => formatBytes(item.size) },
    {
      key: 'deleted_at',
      header: t('assets.trash.col.deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<MediaFile>
      title={t('assets.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/media/assets"
      backLabel={t('assets.trash.back_link')}
      headerIcon={Trash2}
      warningText={t('assets.trash.warning')}
      apiBasePath="/media"
      queryKey="media-trash"
      invalidateOnRestore={['media']}
      invalidateOnForceDelete={['media']}
      perPage={20}
      columns={columns}
      canRestore
      canForceDelete={isSuperAdmin}
      emptyIcon={Files}
      labels={{
        searchPlaceholder: t('assets.trash.search_placeholder'),
      }}
      bulk={{
        restorePath: '/media/bulk-restore',
        forceDeletePath: '/media/bulk-force-delete',
        confirmMessage: (count) => t('assets.trash.bulk_delete_confirm', { count }),
      }}
    />
  );
}
