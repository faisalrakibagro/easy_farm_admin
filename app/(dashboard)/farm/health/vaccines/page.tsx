'use client';

import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { invalidateMoney } from '@/lib/invalidateGroups';
import { useAuth } from '@/contexts/AuthContext';
import { VaccineSchedule } from '@/types';
import { Check, Trash2, Syringe, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import TrashLink from '@/components/ui/TrashLink';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import { fmtNum, fmtMoney } from '@/lib/format';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { SortHeader, SortSelect, TablePagination } from '@/components/ui/TableControls';

// ── Types ────────────────────────────────────────────────────────
type VaxGroup = {
  key: string;
  vaccine_name: string;
  administered_date: string;
  next_due_date: string | null;
  administered_by: string | null;
  notes: string | null;
  total_qty: number;
  total_cost: number;
  unit: string;
  records: VaccineSchedule[];
};

// ── Helpers ──────────────────────────────────────────────────────
const groupKey = (v: VaccineSchedule) =>
  `${v.vaccine_name}__${v.administered_date ?? v.scheduled_date}__${v.administered_by ?? ''}`;

const groupRecords = (records: VaccineSchedule[]): VaxGroup[] => {
  const map = new Map<string, VaxGroup>();
  for (const v of records) {
    const k = groupKey(v);
    if (!map.has(k)) {
      map.set(k, {
        key: k,
        vaccine_name: v.vaccine_name,
        administered_date: v.administered_date ?? v.scheduled_date,
        next_due_date: v.next_due_date ?? null,
        administered_by: v.administered_by ?? null,
        notes: v.notes ?? null,
        total_qty: 0,
        total_cost: 0,
        unit: '',
        records: [],
      });
    }
    const g = map.get(k)!;
    g.records.push(v);
    if (v.medicine_usages) {
      for (const mu of v.medicine_usages) {
        g.total_qty  += parseFloat(mu.quantity_used ?? '0');
        g.total_cost += parseFloat(mu.total_cost ?? '0');
        if (!g.unit) g.unit = mu.unit ?? '';
      }
    }
  }
  return Array.from(map.values());
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d.split('T')[0] + 'T00:00:00').toLocaleDateString(localeFor()) : '—';

const toDateInput = (d: string | null | undefined) => d ? d.split('T')[0] : '';

const TODAY = localDateStr();

const EDIT_FORM_ID = 'vaccine-edit';
const EDIT_KNOWN = ['administered_date', 'next_due_date', 'administered_by', 'notes'];

// ── Component ────────────────────────────────────────────────────
export default function VaccinesPage() {
  const { t } = useTranslation(['health', 'common']);
  const { t: tc } = useTranslation('common');
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);

  // expanded cattle list per group
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Edit modal
  const [editGroup, setEditGroup] = useState<VaxGroup | null>(null);
  const [editForm, setEditForm] = useState({ administered_date: '', next_due_date: '', administered_by: '', notes: '' });
  const [editError, setEditError] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editOpened, setEditOpened] = useState('');
  const editDirty = !!editGroup && JSON.stringify(editForm) !== editOpened;
  useScrollToError(editErrors, editError);
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteGroup, setDeleteGroup] = useState<VaxGroup | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data, isLoading } = useQuery<{ data: VaccineSchedule[]; last_page: number; total: number }>({
    queryKey: ['vaccine-schedules', page, sorting.params],
    queryFn: async () =>
      (await api.get('/farm/health/vaccines', { params: { page, per_page: 50, ...sorting.params } })).data,
  });

  const vaccines = data?.data ?? [];
  const groups   = groupRecords(vaccines);

  const toggleExpand = (key: string) =>
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const openEdit = (g: VaxGroup) => {
    setEditGroup(g);
    const next = {
      administered_date: toDateInput(g.administered_date) || TODAY,
      next_due_date:     toDateInput(g.next_due_date),
      administered_by:   g.administered_by ?? '',
      notes:             g.notes ?? '',
    };
    setEditForm(next);
    setEditOpened(JSON.stringify(next));
    setEditError('');
    setEditErrors({});
  };

  const setEditField = (key: keyof typeof editForm, value: string) => {
    setEditForm(f => ({ ...f, [key]: value }));
    if (editErrors[key]) setEditErrors(p => ({ ...p, [key]: '' }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroup) return;
    setEditError('');
    if (!editForm.administered_date) { setEditErrors({ administered_date: t('common:form.v.date_required') }); return; }
    setEditErrors({});
    setEditSaving(true);
    try {
      await Promise.all(
        editGroup.records.map(r =>
          api.put(`/farm/health/vaccines/${r.id}`, {
            administered_date: editForm.administered_date,
            next_due_date:     editForm.next_due_date || null,
            administered_by:   editForm.administered_by || null,
            notes:             editForm.notes || null,
          })
        )
      );
      invalidateMoney(qc, [['vaccine-schedules'], ['cattle-vaccines']]);
      toast.success(t('vaccines.edit_modal_info', { count: editGroup.records.length }));
      setEditGroup(null);
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, t('vaccines.toast.update_failed'));
      setEditErrors(fields);
      if (!Object.keys(fields).length) setEditError(message);
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteGroup) return;
    setDeleteLoading(true);
    try {
      await Promise.all(deleteGroup.records.map(r => api.delete(`/farm/health/vaccines/${r.id}`)));
      invalidateMoney(qc, [['vaccine-schedules'], ['vaccines-trash'], ['cattle-vaccines']]);
      toast.success(t('vaccines.toast.moved_to_trash', { count: deleteGroup.records.length }));
      setDeleteGroup(null);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? t('vaccines.toast.delete_failed'));
    } finally { setDeleteLoading(false); }
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('vaccines.title')}</h1>
        {isSuperAdmin && (
          <TrashLink href="/farm/health/vaccines/trash" />
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* ── Mobile card view (hidden on sm+) ── */}
        <div className="block sm:hidden divide-y divide-slate-100">
          <SortSelect options={[
            { key: 'date', label: t('vaccines.col.administered_date'), type: 'date' },
            { key: 'next_due', label: t('vaccines.col.next_due_date'), type: 'due' },
          ]} sorting={sorting} className="px-4 py-2.5" />
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 space-y-3 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                    <div className="h-4 bg-slate-100 rounded w-16" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="h-3 bg-slate-100 rounded" />
                    ))}
                  </div>
                </div>
              ))
            : groups.length === 0
              ? (
                <div className="px-4 py-10 text-center text-slate-400">{t('vaccines.empty')}</div>
              )
              : groups.map(g => {
                const expanded = expandedKeys.has(g.key);
                return (
                  <div key={g.key} className="p-4">
                    {/* Card header: vaccine name + actions */}
                    <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{g.vaccine_name}</p>
                        <button
                          onClick={() => toggleExpand(g.key)}
                          className="flex items-center gap-1 mt-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-medium text-xs px-2 py-0.5 rounded-full transition-colors"
                        >
                          <Syringe size={10} />
                          {t('vaccines.cattle_count', { count: g.records.length })}
                          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {hasPermission('farm.health.edit') && (
                          <button onClick={() => openEdit(g)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400" title={tc('btn.edit')} aria-label={tc('btn.edit')}>
                            <Pencil size={14} />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button onClick={() => setDeleteGroup(g)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title={tc('btn.delete')} aria-label={tc('btn.delete')}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card grid: key details */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">{t('vaccines.col.scheduled')}</span>
                        <span className="text-slate-700 font-medium">{fmt(g.administered_date)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{t('vaccines.col.next_due_date')}</span>
                        {g.next_due_date
                          ? <span className="text-cyan-600 font-medium">{fmt(g.next_due_date)}</span>
                          : <span className="text-slate-300">—</span>}
                      </div>
                      <div>
                        <span className="text-slate-400 block">{t('vaccines.field.administered_by')}</span>
                        <span className="text-slate-700">{g.administered_by || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{t('vaccines.col.cost')}</span>
                        <span className="text-slate-800 font-medium">
                          {g.total_cost > 0 ? fmtMoney(g.total_cost) : '—'}
                        </span>
                      </div>
                      {g.notes && (
                        <div className="col-span-full">
                          <span className="text-slate-400 block">{t('vaccines.field.notes')}</span>
                          <span className="text-slate-600">{g.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Expanded cattle list */}
                    {expanded && (
                      <div className="mt-3 pt-3 border-t border-cyan-100 flex flex-wrap gap-1.5">
                        {g.records.map(r => (
                          <span key={r.id}
                            className="text-xs bg-white border border-cyan-200 text-cyan-700 font-medium px-2 py-0.5 rounded-full">
                            {r.cattle?.tag_number ?? `#${r.cattle_id}`}
                            {r.cattle?.name ? ` (${r.cattle.name})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
          }
        </div>

        {/* ── Desktop table (hidden on mobile) ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('vaccines.col.vaccine')}</th>
                <SortHeader label={t('vaccines.col.administered_date')} sortKey="date" sortType="date" sorting={sorting} />
                <SortHeader label={t('vaccines.col.next_due_date')} sortKey="next_due" sortType="due" sorting={sorting} className="hidden sm:table-cell" />
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('vaccines.col.cattle')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">{t('vaccines.field.administered_by')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600 hidden md:table-cell">{t('vaccines.col.quantity')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('vaccines.col.cost')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('common:actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                : groups.length === 0
                  ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">{t('vaccines.empty')}</td></tr>
                  )
                  : groups.map(g => {
                    const expanded = expandedKeys.has(g.key);
                    return (
                      <Fragment key={g.key}>
                        <tr className="hover:bg-slate-50">
                          {/* ভ্যাকসিন নাম */}
                          <td className="px-4 py-3 font-medium text-slate-800">{g.vaccine_name}</td>

                          {/* তারিখ */}
                          <td className="px-4 py-3 text-slate-600">{fmt(g.administered_date)}</td>

                          {/* পরবর্তী তারিখ */}
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {g.next_due_date
                              ? <span className="text-cyan-600 font-medium">{fmt(g.next_due_date)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>

                          {/* পশু count badge */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleExpand(g.key)}
                              className="flex items-center gap-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-medium text-xs px-2.5 py-1 rounded-full transition-colors"
                            >
                              <Syringe size={11} />
                              {t('vaccines.cattle_count', { count: g.records.length })}
                              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          </td>

                          {/* প্রদানকারী */}
                          <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{g.administered_by || '—'}</td>

                          {/* পরিমাণ */}
                          <td className="px-4 py-3 text-end text-slate-600 hidden md:table-cell">
                            {g.total_qty > 0 ? `${fmtNum(g.total_qty, 2)} ${g.unit}` : '—'}
                          </td>

                          {/* খরচ */}
                          <td className="px-4 py-3 text-end font-medium text-slate-800">
                            {g.total_cost > 0 ? fmtMoney(g.total_cost) : '—'}
                          </td>

                          {/* একশন */}
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {hasPermission('farm.health.edit') && (
                                <button onClick={() => openEdit(g)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400" title={tc('btn.edit')} aria-label={tc('btn.edit')}>
                                  <Pencil size={14} />
                                </button>
                              )}
                              {isSuperAdmin && (
                                <button onClick={() => setDeleteGroup(g)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title={tc('btn.delete')} aria-label={tc('btn.delete')}>
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded cattle list */}
                        {expanded && (
                          <tr key={`${g.key}__expanded`} className="bg-cyan-50/40">
                            <td colSpan={8} className="px-6 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {g.records.map(r => (
                                  <span key={r.id}
                                    className="text-xs bg-white border border-cyan-200 text-cyan-700 font-medium px-2 py-0.5 rounded-full">
                                    {r.cattle?.tag_number ?? `#${r.cattle_id}`}
                                    {r.cattle?.name ? ` (${r.cattle.name})` : ''}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(data?.total ?? 0) > 0 && (
          <TablePagination page={page} lastPage={data?.last_page ?? 1} total={data?.total} perPage={50} onPageChange={setPage} />
        )}
      </div>

      {/* ══ Edit Modal ══ */}
      <Modal open={!!editGroup} onClose={() => setEditGroup(null)} dirty={editDirty} size="lg"
        icon={<Syringe size={18} className="text-cyan-500 shrink-0" />}
        title={t('vaccines.edit_modal_title')}
        subtitle={editGroup ? `${editGroup.vaccine_name} — ${t('vaccines.cattle_count', { count: editGroup.records.length })}` : undefined}
        footer={<>
          <button type="button" onClick={() => setEditGroup(null)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={EDIT_FORM_ID} disabled={editSaving} className={btnPrimary}>
            <Check size={15} /> {t('vaccines.btn_save')}
          </button>
        </>}>
        {editGroup && (
          <form id={EDIT_FORM_ID} onSubmit={handleEditSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
            <FormAlert message={editError} extra={otherErrors(editErrors, EDIT_KNOWN)} />

            {/* Cattle chips */}
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">{t('vaccines.field.cattle_list')} ({t('vaccines.count_suffix', { count: editGroup.records.length })})</p>
              <div className="flex flex-wrap gap-1.5">
                {editGroup.records.map(r => (
                  <span key={r.id} className="text-xs bg-cyan-100 text-cyan-700 font-medium px-2 py-0.5 rounded-full">
                    {r.cattle?.tag_number ?? `#${r.cattle_id}`}
                    {r.cattle?.name ? ` (${r.cattle.name})` : ''}
                  </span>
                ))}
              </div>
            </div>

            <FormRow>
              <Field name="administered_date" label={t('vaccines.field.scheduled_date')} required error={editErrors.administered_date}>
                <input id={fieldId('administered_date')} type="date" value={editForm.administered_date}
                  onChange={e => setEditField('administered_date', e.target.value)} className={fieldClass(editErrors.administered_date)} />
              </Field>
              <Field name="next_due_date" label={t('vaccines.field.next_due_date_optional')} error={editErrors.next_due_date}>
                <input id={fieldId('next_due_date')} type="date" value={editForm.next_due_date}
                  onChange={e => setEditField('next_due_date', e.target.value)} className={fieldClass(editErrors.next_due_date)} />
              </Field>
            </FormRow>

            <Field name="administered_by" label={t('vaccines.field.administered_by')} error={editErrors.administered_by}>
              <input id={fieldId('administered_by')} type="text" value={editForm.administered_by} dir="auto"
                onChange={e => setEditField('administered_by', e.target.value)}
                placeholder={t('vaccines.field.doctor_staff_name')} className={fieldClass(editErrors.administered_by)} />
            </Field>

            <Field name="notes" label={t('vaccines.field.notes')} error={editErrors.notes}>
              <textarea id={fieldId('notes')} rows={2} value={editForm.notes} dir="auto"
                onChange={e => setEditField('notes', e.target.value)} className={fieldClass(editErrors.notes)} />
            </Field>

            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              {t('vaccines.edit_modal_info', { count: editGroup.records.length })}
            </p>
          </form>
        )}
      </Modal>

      {/* ══ Delete Confirm ══ */}
      <ConfirmDialog
        open={!!deleteGroup}
        title={t('vaccines.confirm.move_to_trash_title')}
        message={deleteGroup
          ? t('vaccines.confirm.move_to_trash_message', { vaccine_name: deleteGroup.vaccine_name, count: deleteGroup.records.length })
          : ''}
        confirmLabel={t('vaccines.confirm.move_to_trash_label')}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteGroup(null)}
      />
    </div>
  );
}
