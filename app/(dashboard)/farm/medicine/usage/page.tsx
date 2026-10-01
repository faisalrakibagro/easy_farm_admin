'use client';

import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { MedicineUsage } from '@/types';
import { Check, Trash2, FlaskConical, ChevronDown, ChevronUp, Pencil, Plus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { CATTLE_COST_KEYS, MEDICINE_STOCK_KEYS, invalidateKeys } from '@/lib/invalidateGroups';
import Link from '@/components/ui/AppLink';
import { useDateRange } from '@/lib/hooks/useDateRange';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import TrashLink from '@/components/ui/TrashLink';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import { fmtNum, fmtMoney } from '@/lib/format';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { SortHeader, SortSelect, TablePagination } from '@/components/ui/TableControls';

type MedGroup = {
  key: string;
  medicine_name: string;
  usage_date: string;
  next_due_date: string | null;
  notes: string | null;
  total_qty: number;
  total_cost: number;
  unit: string;
  records: MedicineUsage[];
};

const groupKey = (u: MedicineUsage) =>
  `${u.medicine?.name ?? u.medicine_id}__${u.usage_date.split('T')[0]}`;

const groupRecords = (records: MedicineUsage[]): MedGroup[] => {
  const map = new Map<string, MedGroup>();
  for (const u of records) {
    const k = groupKey(u);
    if (!map.has(k)) {
      map.set(k, {
        key: k,
        medicine_name: u.medicine?.name ?? String(u.medicine_id),
        usage_date:    u.usage_date.split('T')[0],
        next_due_date: u.next_due_date ?? null,
        notes:         u.notes ?? null,
        total_qty:     0,
        total_cost:    0,
        unit:          u.unit ?? '',
        records:       [],
      });
    }
    const g = map.get(k)!;
    g.total_qty  += parseFloat(u.quantity_used ?? '0');
    g.total_cost += parseFloat(u.total_cost ?? '0');
    g.records.push(u);
  }
  return Array.from(map.values());
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d.split('T')[0] + 'T00:00:00').toLocaleDateString(localeFor()) : '—';

const toDateInput = (d: string | null | undefined) => d ? d.split('T')[0] : '';

const TODAY = localDateStr();

const EDIT_FORM_ID = 'medicine-usage-edit';
const EDIT_KNOWN = ['usage_date', 'next_due_date', 'notes'];

export default function MedicineUsagePage() {
  const { t } = useTranslation(['medicine', 'common']);
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [page, setPage] = useState(1);

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Edit modal
  const [editGroup, setEditGroup]   = useState<MedGroup | null>(null);
  const [editForm, setEditForm]     = useState({ usage_date: '', next_due_date: '', notes: '' });
  const [editError, setEditError]   = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editOpened, setEditOpened] = useState('');
  const editDirty = !!editGroup && JSON.stringify(editForm) !== editOpened;
  useScrollToError(editErrors, editError);
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteGroup, setDeleteGroup]     = useState<MedGroup | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const dateRange = useDateRange(setPage);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);

  const { data, isLoading } = useQuery<{ data: MedicineUsage[]; last_page: number; total: number }>({
    queryKey: ['medicine-usages', page, dateRange.params, sorting.params],
    queryFn: async () =>
      (await api.get('/farm/medicine/usages', { params: { page, per_page: 50, ...dateRange.params, ...sorting.params } })).data,
  });

  const usages = data?.data ?? [];
  const groups = groupRecords(usages);

  const toggleExpand = (key: string) =>
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const openEdit = (g: MedGroup) => {
    setEditGroup(g);
    const next = {
      usage_date:    toDateInput(g.usage_date) || TODAY,
      next_due_date: toDateInput(g.next_due_date),
      notes:         g.notes ?? '',
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
    if (!editForm.usage_date) { setEditErrors({ usage_date: t('common:form.v.date_required') }); return; }
    setEditErrors({});
    setEditSaving(true);
    try {
      await Promise.all(
        editGroup.records.map(r =>
          api.put(`/farm/medicine/usages/${r.id}`, {
            usage_date:    editForm.usage_date,
            next_due_date: editForm.next_due_date || null,
            notes:         editForm.notes || null,
          })
        )
      );
      invalidateKeys(qc, [...MEDICINE_STOCK_KEYS, ...CATTLE_COST_KEYS, ['medicine-usages'], ['medicine-usages-trash'], ['cattle-medicine'], ['farm-cattle']]);
      toast.success(t('usage.toast.updated', { count: editGroup.records.length }));
      setEditGroup(null);
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, t('usage.toast.update_failed'));
      setEditErrors(fields);
      if (!Object.keys(fields).length) setEditError(message);
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteGroup) return;
    setDeleteLoading(true);
    try {
      await Promise.all(deleteGroup.records.map(r => api.delete(`/farm/medicine/usages/${r.id}`)));
      invalidateKeys(qc, [...MEDICINE_STOCK_KEYS, ...CATTLE_COST_KEYS, ['medicine-usages'], ['medicine-usages-trash'], ['cattle-medicine'], ['farm-cattle']]);
      toast.success(t('usage.toast.moved_to_trash', { count: deleteGroup.records.length }));
      setDeleteGroup(null);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? t('usage.toast.delete_failed'));
    } finally { setDeleteLoading(false); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('usage.title')}</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto [&>*]:whitespace-nowrap">
          {isSuperAdmin && (
            <TrashLink href="/farm/medicine/usage/trash" />
          )}
          {/* Usage is recorded against animals: pick them on the animal list, then the medicine. */}
          {hasPermission('farm.medicine.create') && (
            <Link href="/farm/cattle?new=medicine"
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
              <Plus size={16} /> {t('usage.btn.give')}
            </Link>
          )}
        </div>
      </div>

      <DateRangeFilter value={dateRange.range} onChange={dateRange.setRange} />

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* Mobile cards */}
        <div className="block sm:hidden divide-y divide-slate-100">
          <SortSelect options={[{ key: 'date', label: t('usage.col.date'), type: 'date' }]} sorting={sorting} className="px-4 py-2.5" />
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-3 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ))
          ) : groups.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400">{t('usage.empty')}</div>
          ) : groups.map(g => {
            const expanded = expandedKeys.has(g.key);
            return (
              <div key={g.key} className="p-4">
                <div className="flex items-start justify-between mb-2 flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                      <FlaskConical size={13} className="text-blue-400 shrink-0" />
                      {g.medicine_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmt(g.usage_date)}</p>
                  </div>
                  <div className="flex gap-1 ms-2 shrink-0">
                    {hasPermission('farm.medicine.edit') && (
                      <button onClick={() => openEdit(g)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400" title={t('common:btn.edit')} aria-label={t('common:btn.edit')}>
                        <Pencil size={14} />
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button onClick={() => setDeleteGroup(g)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title={t('common:btn.delete')} aria-label={t('common:btn.delete')}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                  <div>
                    <span className="text-slate-400">{t('usage.col.quantity')}: </span>
                    <span className="text-slate-600 font-medium">{fmtNum(g.total_qty, 2)} {g.unit}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{t('usage.col.cost')}: </span>
                    <span className="text-slate-800 font-semibold">{fmtMoney(g.total_cost)}</span>
                  </div>
                  {g.next_due_date && (
                    <div className="col-span-full">
                      <span className="text-slate-400">{t('usage.col.next_due_date')}: </span>
                      <span className="text-blue-600 font-medium">{fmt(g.next_due_date)}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleExpand(g.key)}
                  className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs px-2.5 py-1 rounded-full transition-colors"
                >
                  <FlaskConical size={11} />
                  {t('usage.cattle_count', { count: g.records.length })}
                  {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                {expanded && (
                  <div className="mt-2 flex flex-wrap gap-1.5 bg-blue-50/40 rounded-lg p-3">
                    {g.records.map(r => (
                      <span key={r.id}
                        className="text-xs bg-white border border-blue-200 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                        {r.cattle?.tag_number ?? `#${r.cattle_id}`}
                        {r.cattle?.name ? ` (${r.cattle.name})` : ''}
                        <span className="text-blue-400 ms-1">— {fmtNum(r.quantity_used)} {r.unit}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('usage.col.medicine')}</th>
                <SortHeader label={t('usage.col.date')} sortKey="date" sortType="date" sorting={sorting} />
                <th className="text-start px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">{t('usage.col.next_due_date')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('usage.col.cattle')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600 hidden md:table-cell">{t('usage.col.quantity')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('usage.col.cost')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('common:actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                : groups.length === 0
                  ? <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{t('usage.empty')}</td></tr>
                  : groups.map(g => {
                    const expanded = expandedKeys.has(g.key);
                    return (
                      <Fragment key={g.key}>
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            <span className="flex items-center gap-1.5">
                              <FlaskConical size={13} className="text-blue-400 shrink-0" />
                              {g.medicine_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{fmt(g.usage_date)}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {g.next_due_date
                              ? <span className="text-blue-600 font-medium">{fmt(g.next_due_date)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleExpand(g.key)}
                              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs px-2.5 py-1 rounded-full transition-colors"
                            >
                              <FlaskConical size={11} />
                              {t('usage.cattle_count', { count: g.records.length })}
                              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-end text-slate-600 hidden md:table-cell">
                            {fmtNum(g.total_qty, 2)} {g.unit}
                          </td>
                          <td className="px-4 py-3 text-end font-medium text-slate-800">
                            {fmtMoney(g.total_cost)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {hasPermission('farm.medicine.edit') && (
                                <button onClick={() => openEdit(g)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400" title={t('common:btn.edit')} aria-label={t('common:btn.edit')}>
                                  <Pencil size={14} />
                                </button>
                              )}
                              {isSuperAdmin && (
                                <button onClick={() => setDeleteGroup(g)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title={t('common:btn.delete')} aria-label={t('common:btn.delete')}>
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${g.key}__exp`} className="bg-blue-50/40">
                            <td colSpan={7} className="px-6 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {g.records.map(r => (
                                  <span key={r.id}
                                    className="text-xs bg-white border border-blue-200 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                                    {r.cattle?.tag_number ?? `#${r.cattle_id}`}
                                    {r.cattle?.name ? ` (${r.cattle.name})` : ''}
                                    <span className="text-blue-400 ms-1">— {fmtNum(r.quantity_used)} {r.unit}</span>
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
        {(data?.total ?? 0) > 0 && (
          <TablePagination page={page} lastPage={data?.last_page ?? 1} total={data?.total} perPage={50} onPageChange={setPage} />
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={!!editGroup} onClose={() => setEditGroup(null)} dirty={editDirty} size="lg"
        icon={<FlaskConical size={18} className="text-blue-500 shrink-0" />}
        title={t('usage.modal.edit_title')}
        subtitle={editGroup ? `${editGroup.medicine_name} — ${t('usage.cattle_count', { count: editGroup.records.length })}` : undefined}
        footer={<>
          <button type="button" onClick={() => setEditGroup(null)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={EDIT_FORM_ID} disabled={editSaving} className={btnPrimary}>
            <Check size={15} /> {t('usage.btn.save')}
          </button>
        </>}>
        {editGroup && (
          <form id={EDIT_FORM_ID} onSubmit={handleEditSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
            <FormAlert message={editError} extra={otherErrors(editErrors, EDIT_KNOWN)} />
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">{t('usage.label.cattle_list', { count: editGroup.records.length })}</p>
              <div className="flex flex-wrap gap-1.5">
                {editGroup.records.map(r => (
                  <span key={r.id} className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                    {r.cattle?.tag_number ?? `#${r.cattle_id}`}
                    {r.cattle?.name ? ` (${r.cattle.name})` : ''}
                  </span>
                ))}
              </div>
            </div>
            <FormRow>
              <Field name="usage_date" label={t('usage.field.date')} required error={editErrors.usage_date}>
                <input id={fieldId('usage_date')} type="date" value={editForm.usage_date}
                  onChange={e => setEditField('usage_date', e.target.value)} className={fieldClass(editErrors.usage_date)} />
              </Field>
              <Field name="next_due_date" label={t('usage.field.next_due_date_optional')} error={editErrors.next_due_date}>
                <input id={fieldId('next_due_date')} type="date" value={editForm.next_due_date}
                  onChange={e => setEditField('next_due_date', e.target.value)} className={fieldClass(editErrors.next_due_date)} />
              </Field>
            </FormRow>
            <Field name="notes" label={t('usage.field.notes')} error={editErrors.notes}>
              <textarea id={fieldId('notes')} rows={2} value={editForm.notes} dir="auto"
                onChange={e => setEditField('notes', e.target.value)} className={fieldClass(editErrors.notes)} />
            </Field>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              {t('usage.modal.update_all_warning', { count: editGroup.records.length })}
            </p>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteGroup}
        title={t('usage.confirm.move_to_trash_title')}
        message={deleteGroup
          ? t('usage.confirm.move_to_trash_message', { medicine: deleteGroup.medicine_name, count: deleteGroup.records.length })
          : ''}
        confirmLabel={t('usage.confirm.move_to_trash_label')}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteGroup(null)}
      />
    </div>
  );
}
