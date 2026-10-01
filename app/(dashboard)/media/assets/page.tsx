'use client';

import { useState, useRef, useCallback } from 'react';
import Link from '@/components/ui/AppLink';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { invalidateKeys } from '@/lib/invalidateGroups';
import { useAuth } from '@/contexts/AuthContext';
import { MediaFile, MediaCategory, PaginatedResponse } from '@/types';
import { failedMsg, savedMsg } from '@/lib/feedback';
import { localeFor } from '@/lib/languages';
import {
  Upload, Trash2, File, Image, X, Search, Grid, List,
  FileVideo, FileAudio, FileText, ChevronDown, CheckSquare,
  Square, Edit2, Download, Filter, ArchiveRestore,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useFormErrors } from '@/lib/hooks/useFormErrors';
import { fmtNum } from '@/lib/format';

function formatBytes(bytes: number) {
  if (bytes < 1024)    return fmtNum(bytes) + ' B';
  if (bytes < 1048576) return fmtNum(bytes / 1024, 1) + ' KB';
  return fmtNum(bytes / 1048576, 1) + ' MB';
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  if (!mimeType)                        return <File size={32} className="text-slate-400" />;
  if (mimeType.startsWith('video/'))    return <FileVideo size={32} className="text-purple-400" />;
  if (mimeType.startsWith('audio/'))    return <FileAudio size={32} className="text-green-400" />;
  if (mimeType === 'application/pdf')   return <FileText size={32} className="text-red-400" />;
  return <File size={32} className="text-slate-400" />;
}

type ViewMode = 'grid' | 'list';
type FileType = 'all' | 'image' | 'video' | 'audio' | 'document';

interface EditForm { title: string; alt_text: string; description: string; }
const EMPTY_EDIT: EditForm = { title: '', alt_text: '', description: '' };
const EDIT_FORM_ID = 'media-edit';
const EDIT_FIELDS = ['title', 'alt_text', 'description'];

export default function MediaAssetsPage() {
  const { t } = useTranslation('media');
  const qc          = useQueryClient();
  const toast       = useToast();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const inputRef    = useRef<HTMLInputElement>(null);

  const [search,      setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page,        setPage]       = useState(1);
  const [viewMode,    setViewMode]   = useState<ViewMode>('grid');
  const [fileType,    setFileType]   = useState<FileType>('all');
  const [categoryId,  setCategoryId] = useState<string>('');
  const [uploading,   setUploading]  = useState(false);
  const [uploadError, setUploadError]= useState<string | null>(null);
  const [selected,    setSelected]   = useState<Set<number>>(new Set());
  const [preview,     setPreview]    = useState<MediaFile | null>(null);
  const [editItem,    setEditItem]   = useState<MediaFile | null>(null);
  const [editForm,    setEditForm]   = useState<EditForm>(EMPTY_EDIT);
  const [editSaving, setEditSaving]  = useState(false);
  const [editOpened, setEditOpened]  = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const editErr = useFormErrors();

  // Debounce timer for the search box.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }, []);

  const { data, isLoading } = useQuery<PaginatedResponse<MediaFile>>({
    queryKey: ['media', page, debouncedSearch, fileType, categoryId],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (fileType !== 'all') params.type = fileType;
      if (categoryId) params.category_id = categoryId;
      const res = await api.get('/media', { params });
      return res.data;
    },
  });

  const { data: catData } = useQuery<{ categories: MediaCategory[] }>({
    queryKey: ['media-categories'],
    queryFn: async () => (await api.get('/media/categories')).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/media/${id}`),
    onSuccess: (res) => {
      invalidateKeys(qc, [['media'], ['media-trash'], ['media-categories']]);
      setPreview(null);
      setDeleteTarget(null);
      setSelected(new Set());
      toast.success((res as { data?: { message?: string } })?.data?.message ?? t('assets.moved_one'));
    },
    onError: (e) => {
      setDeleteTarget(null);
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.delete('/media/bulk', { data: { ids } }),
    onSuccess: (res) => {
      invalidateKeys(qc, [['media'], ['media-trash'], ['media-categories']]);
      setSelected(new Set());
      setConfirmBulk(false);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? t('assets.moved_many'));
    },
    onError: (e) => {
      setConfirmBulk(false);
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    setUploadError(null);

    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post('/media', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      invalidateKeys(qc, [['media'], ['media-trash'], ['media-categories']]);
      toast.success(savedMsg());
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setUploadError(e?.response?.data?.message ?? t('assets.upload_failed'));
      toast.error(e?.response?.data?.message ?? failedMsg());
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  };

  const openEdit = (item: MediaFile) => {
    const next = {
      title: item.title ?? '',
      alt_text: item.alt_text ?? '',
      description: item.description ?? '',
    };
    setEditItem(item);
    setEditForm(next);
    setEditOpened(JSON.stringify(next));
    editErr.reset();
  };

  const items: MediaFile[] = data?.data ?? [];
  const totalPages = data?.last_page ?? 1;
  const total = data?.total ?? 0;
  const categories = catData?.categories ?? [];

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('assets.search_placeholder')}
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="relative">
          <Filter size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={fileType}
            onChange={e => { setFileType(e.target.value as FileType); setPage(1); }}
            className="ps-8 pe-8 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            <option value="all">{t('assets.filter.all_types')}</option>
            <option value="image">{t('assets.filter.images')}</option>
            <option value="video">{t('assets.filter.videos')}</option>
            <option value="audio">{t('assets.filter.audio')}</option>
            <option value="document">{t('assets.filter.documents')}</option>
          </select>
          <ChevronDown size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {categories.length > 0 && (
          <div className="relative">
            <select
              value={categoryId}
              onChange={e => { setCategoryId(e.target.value); setPage(1); }}
              className="ps-3 pe-8 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="">{t('assets.filter.all_categories')}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        <div className="flex self-start border border-slate-300 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label={t('assets.view_grid')} title={t('assets.view_grid')} aria-pressed={viewMode === 'grid'}
            className={`grid place-items-center min-w-11 min-h-10 px-3 py-2 ${viewMode === 'grid' ? 'bg-slate-100' : 'bg-white'}`}
          ><Grid size={16} /></button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label={t('assets.view_list')} title={t('assets.view_list')} aria-pressed={viewMode === 'list'}
            className={`grid place-items-center min-w-11 min-h-10 px-3 py-2 border-s border-slate-300 ${viewMode === 'list' ? 'bg-slate-100' : 'bg-white'}`}
          ><List size={16} /></button>
        </div>

        <Link
          href="/media/assets/trash"
          className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <ArchiveRestore size={16} /> {t('assets.trash_link')}
        </Link>

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Upload size={16} />
          {uploading ? t('assets.uploading') : t('assets.upload_files')}
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
      </div>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} aria-label={t('common:ui.close')} className="shrink-0 p-3 -m-3"><X size={16} /></button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
          <span className="text-sm text-blue-700 font-medium">{t('assets.selected_count', { count: selected.size })}</span>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setConfirmBulk(true)}
              disabled={bulkDeleteMutation.isPending}
              className="flex items-center gap-1.5 min-h-10 sm:min-h-0 text-sm text-red-600 hover:text-red-800"
            >
              <Trash2 size={14} /> {t('assets.delete_selected')}
            </button>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="min-h-10 sm:min-h-0 text-sm text-slate-500 ms-auto">
            {t('assets.clear')}
          </button>
        </div>
      )}

      {!isLoading && (
        <p className="text-sm text-slate-500">{total !== 1 ? t('assets.file_count_plural', { count: total }) : t('assets.file_count', { count: total })}</p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-square bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-16 text-center">
          <Image size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">{t('assets.no_files_found')}</p>
          <p className="text-sm text-slate-400 mt-1">
            {debouncedSearch || fileType !== 'all' || categoryId
              ? t('assets.no_files_hint_filter')
              : t('assets.no_files_hint_upload')}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <button
            type="button"
            className="col-span-full justify-self-start flex items-center gap-2 min-h-10 sm:min-h-0 text-sm text-slate-500 select-none"
            onClick={toggleSelectAll}
          >
            {selected.size === items.length && items.length > 0
              ? <CheckSquare size={16} className="text-blue-500" />
              : <Square size={16} />}
            {selected.size === items.length && items.length > 0 ? t('assets.deselect_all') : t('assets.select_all')}
          </button>

          {items.map((item) => (
            <div
              key={item.id}
              className={`group relative bg-white border rounded-xl overflow-hidden cursor-pointer transition-all ${
                selected.has(item.id) ? 'border-blue-400 ring-2 ring-blue-300' : 'border-slate-200 hover:border-blue-300'
              }`}
              onClick={() => setPreview(item)}
            >
              {/* Touch screens have no hover, so the select box and the edit/delete
                  buttons stay visible there; a mouse reveals them on hover. */}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); toggleSelect(item.id); }}
                aria-label={t('assets.select_item', { name: item.title || item.name })}
                aria-pressed={selected.has(item.id)}
                className={`absolute top-0 start-0 z-10 grid place-items-center w-10 h-10 transition-opacity ${
                  selected.has(item.id) ? '' : 'pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100'
                }`}
              >
                <span className="grid place-items-center w-6 h-6 pointer-fine:w-5 pointer-fine:h-5 rounded bg-white/80">
                  {selected.has(item.id)
                    ? <CheckSquare size={14} className="text-blue-500" />
                    : <Square size={14} className="text-slate-400" />}
                </span>
              </button>

              <div className="aspect-square flex items-center justify-center bg-slate-50">
                {item.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnail_url ?? item.url}
                    alt={item.alt_text ?? item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileIcon mimeType={item.mime_type} />
                )}
              </div>
              <div className="p-2">
                <p className="text-xs text-slate-600 font-medium truncate">{item.title || item.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(item.size)}</p>
              </div>

              <div className="absolute top-1 end-1 pointer-fine:top-2 pointer-fine:end-2 flex gap-1 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); openEdit(item); }}
                  aria-label={t('common:btn.edit')} title={t('common:btn.edit')}
                  className="w-10 h-10 pointer-fine:w-6 pointer-fine:h-6 rounded-lg pointer-fine:rounded-md bg-blue-500 text-white flex items-center justify-center"
                ><Edit2 size={13} className="pointer-fine:w-[11px] pointer-fine:h-[11px]" /></button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(item); }}
                    aria-label={t('common:btn.delete')} title={t('common:btn.delete')}
                    className="w-10 h-10 pointer-fine:w-6 pointer-fine:h-6 rounded-lg pointer-fine:rounded-md bg-red-500 text-white flex items-center justify-center"
                  ><Trash2 size={13} className="pointer-fine:w-[11px] pointer-fine:h-[11px]" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Mobile card view */}
          <div className="block sm:hidden divide-y divide-slate-100">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-500 select-none border-b border-slate-100"
              onClick={toggleSelectAll}
            >
              {selected.size === items.length && items.length > 0
                ? <CheckSquare size={14} className="text-blue-500" />
                : <Square size={14} />}
              {selected.size === items.length && items.length > 0 ? t('assets.deselect_all') : t('assets.select_all')}
            </button>
            {items.map(item => (
              <div key={item.id} className="p-4 space-y-3" onClick={() => setPreview(item)}>
                <div className="flex items-center justify-between gap-2 flex-wrap gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button type="button" onClick={() => toggleSelect(item.id)} className="w-full h-full flex items-center justify-center"
                        aria-label={t('assets.select_item', { name: item.title || item.name })} aria-pressed={selected.has(item.id)}>
                        {item.type === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.thumbnail_url ?? item.url} alt="" loading="lazy" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <FileIcon mimeType={item.mime_type} />
                        )}
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 truncate">{item.title || item.name}</p>
                      <span className="inline-block text-xs capitalize bg-slate-100 text-slate-500 px-2 py-0.5 rounded mt-0.5">{item.type}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"
                      aria-label={t('common:btn.edit')} title={t('common:btn.edit')}><Edit2 size={14} /></button>
                    {isSuperAdmin && (
                      <button type="button" onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                        aria-label={t('common:btn.delete')} title={t('common:btn.delete')}><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs" onClick={e => e.stopPropagation()}>
                  <div>
                    <p className="text-slate-400 mb-0.5">{t('assets.col.size')}</p>
                    <p className="text-slate-600">{formatBytes(item.size)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">{t('assets.col.category')}</p>
                    <p className="text-slate-600">{item.category?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">{t('assets.col.date')}</p>
                    <p className="text-slate-600">{new Date(item.created_at).toLocaleDateString(localeFor())}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <button type="button" onClick={toggleSelectAll}
                      aria-label={selected.size === items.length && items.length > 0 ? t('assets.deselect_all') : t('assets.select_all')}>
                      {selected.size === items.length && items.length > 0
                        ? <CheckSquare size={14} className="text-blue-500" />
                        : <Square size={14} className="text-slate-400" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600">{t('assets.col.file')}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600 hidden md:table-cell">{t('assets.col.type')}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600 hidden sm:table-cell">{t('assets.col.size')}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600 hidden lg:table-cell">{t('assets.col.category')}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600 hidden lg:table-cell">{t('assets.col.date')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setPreview(item)}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button type="button" onClick={() => toggleSelect(item.id)}
                        aria-label={t('assets.select_item', { name: item.title || item.name })} aria-pressed={selected.has(item.id)}>
                        {selected.has(item.id)
                          ? <CheckSquare size={14} className="text-blue-500" />
                          : <Square size={14} className="text-slate-400" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          {item.type === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.thumbnail_url ?? item.url} alt="" loading="lazy" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <FileIcon mimeType={item.mime_type} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700 truncate">{item.title || item.name}</p>
                          <p className="text-xs text-slate-400 truncate">{item.file_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell capitalize">{item.type}</td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{formatBytes(item.size)}</td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{item.category?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {new Date(item.created_at).toLocaleDateString(localeFor())}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openEdit(item)} className="p-1 text-blue-500 hover:text-blue-700"
                          aria-label={t('common:btn.edit')} title={t('common:btn.edit')}><Edit2 size={14} /></button>
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            aria-label={t('common:btn.delete')} title={t('common:btn.delete')}
                            className="p-1 text-red-500 hover:text-red-700"
                          ><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{t('common:pagination.page_of', { current: page, total: totalPages })} &bull; {t('common:pagination.total_count', { count: total })}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">{t('common:btn.prev')}</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">{t('common:btn.next')}</button>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      <Modal open={!!preview} onClose={() => setPreview(null)} dirty={false} size="lg"
        title={preview ? <span className="block truncate">{preview.title || preview.name}</span> : ''}
        footer={preview && <>
          <a href={preview.url} target="_blank" rel="noopener noreferrer" download
            className={`${btnSecondary} flex-1 sm:flex-none sm:me-auto`}>
            <Download size={14} /> {t('assets.preview.download')}
          </a>
          <button type="button" onClick={() => { openEdit(preview); setPreview(null); }} className={btnSecondary}>
            <Edit2 size={14} /> {t('assets.preview.edit')}
          </button>
          {isSuperAdmin && (
            <button type="button"
              onClick={() => setDeleteTarget(preview)}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60"
            ><Trash2 size={14} /> {t('assets.preview.delete')}</button>
          )}
        </>}>
        {preview && (
          <div className="px-4 sm:px-6 py-5">
            {preview.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={preview.alt_text ?? preview.name} loading="lazy" className="w-full rounded-lg max-h-64 object-contain bg-slate-50" />
            ) : preview.type === 'video' ? (
              <video src={preview.url} controls className="w-full rounded-lg max-h-64" />
            ) : preview.type === 'audio' ? (
              <audio src={preview.url} controls className="w-full mt-4" />
            ) : (
              <div className="flex items-center justify-center h-32 bg-slate-50 rounded-lg">
                <FileIcon mimeType={preview.mime_type} />
              </div>
            )}
            <dl className="mt-4 space-y-2 text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&_dd]:min-w-0 [&_dd]:text-end [&_dd]:break-all [&_dt]:shrink-0">
              <div><dt className="text-slate-400">{t('assets.preview.file_name')}</dt><dd className="text-slate-700 font-mono text-xs" dir="ltr">{preview.file_name}</dd></div>
              <div><dt className="text-slate-400">{t('assets.preview.type')}</dt><dd className="text-slate-700 capitalize">{preview.type}</dd></div>
              <div><dt className="text-slate-400">{t('assets.preview.mime')}</dt><dd className="text-slate-700" dir="ltr">{preview.mime_type ?? '—'}</dd></div>
              <div><dt className="text-slate-400">{t('assets.preview.size')}</dt><dd className="text-slate-700" dir="ltr">{formatBytes(preview.size)}</dd></div>
              {preview.width && <div><dt className="text-slate-400">{t('assets.preview.dimensions')}</dt><dd className="text-slate-700" dir="ltr">{preview.width} × {preview.height}px</dd></div>}
              {preview.category && <div><dt className="text-slate-400">{t('assets.preview.category')}</dt><dd className="text-slate-700">{preview.category.name}</dd></div>}
              <div><dt className="text-slate-400">{t('assets.preview.uploaded')}</dt><dd className="text-slate-700">{new Date(preview.created_at).toLocaleString(localeFor())}</dd></div>
            </dl>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        message={t('assets.delete_confirm')}
        confirmLabel={t('assets.preview.delete')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={confirmBulk}
        message={t('assets.bulk_delete_confirm', { count: selected.size })}
        confirmLabel={t('assets.delete_selected')}
        loading={bulkDeleteMutation.isPending}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selected))}
        onCancel={() => setConfirmBulk(false)}
      />

      {/* ── Edit Modal ── */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} dirty={!!editItem && JSON.stringify(editForm) !== editOpened} size="md"
        title={t('assets.edit_metadata_title')}
        footer={<>
          <button type="button" onClick={() => setEditItem(null)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={EDIT_FORM_ID} disabled={editSaving} className={btnPrimary}>
            {editSaving ? t('assets.edit_form.saving') : t('assets.edit_form.save_changes')}
          </button>
        </>}>
        {editItem && (
          <form
            id={EDIT_FORM_ID}
            noValidate
            className="px-4 sm:px-6 py-5 space-y-4"
            onSubmit={async e => {
              e.preventDefault();
              editErr.reset();
              setEditSaving(true);
              try {
                const res = await api.put(`/media/${editItem.id}`, editForm);
                invalidateKeys(qc, [['media'], ['media-trash'], ['media-categories']]);
                setEditItem(null);
                toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
              } catch (err: unknown) {
                toast.error(editErr.fromApi(err, failedMsg(), EDIT_FIELDS));
              } finally {
                setEditSaving(false);
              }
            }}
          >
            <FormAlert message={editErr.formError} />
            <Field name="title" label={t('assets.edit_form.title_label')} error={editErr.errors.title}>
              <input id={fieldId('title')} value={editForm.title} dir="auto" data-autofocus
                onChange={e => { setEditForm(f => ({ ...f, title: e.target.value })); editErr.clear('title'); }}
                placeholder={t('assets.edit_form.title_placeholder')}
                className={fieldClass(editErr.errors.title)} />
            </Field>
            <Field name="alt_text" label={t('assets.edit_form.alt_text_label')} error={editErr.errors.alt_text}>
              <input id={fieldId('alt_text')} value={editForm.alt_text} dir="auto"
                onChange={e => { setEditForm(f => ({ ...f, alt_text: e.target.value })); editErr.clear('alt_text'); }}
                placeholder={t('assets.edit_form.alt_text_placeholder')}
                className={fieldClass(editErr.errors.alt_text)} />
            </Field>
            <Field name="description" label={t('assets.edit_form.description_label')} error={editErr.errors.description}>
              <textarea id={fieldId('description')} value={editForm.description} dir="auto"
                onChange={e => { setEditForm(f => ({ ...f, description: e.target.value })); editErr.clear('description'); }}
                rows={2} placeholder={t('assets.edit_form.description_placeholder')}
                className={fieldClass(editErr.errors.description)} />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  );
}
