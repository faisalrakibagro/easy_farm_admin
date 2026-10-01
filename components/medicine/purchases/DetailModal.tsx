'use client';

import { useTranslation } from 'react-i18next';
import { Trash2, Pencil } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary } from '@/lib/formStyles';
import type { MedicinePurchase, AccountingPaymentAccount } from '@/types';
import { localeFor } from '@/lib/languages';
import { fmtMoney, fmtNum } from '@/lib/format';

interface MedicinePurchaseFull extends MedicinePurchase {
  payment_account_id?: number | null;
  payment_account?: AccountingPaymentAccount | null;
  payment_status?: 'paid' | 'partial' | 'unpaid';
  paid_amount?: string | number;
  due_amount?: string | number;
}

interface DetailModalProps {
  purchase: MedicinePurchaseFull | null;
  onClose: () => void;
  isSuperAdmin: boolean;
  getSupplierName: (p: MedicinePurchaseFull) => string;
  onDelete: () => void;
  onEdit: () => void;
}

export default function DetailModal({ purchase, onClose, isSuperAdmin, getSupplierName, onDelete, onEdit }: DetailModalProps) {
  const { t } = useTranslation('medicine');

  if (!purchase) return null;

  return (
    <Modal onClose={onClose} dirty={false} size="2xl" title={t('purchases.detail_title')}
      footer={<>
        {isSuperAdmin && (
          <button type="button" onClick={onDelete}
            className="sm:me-auto inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
            <Trash2 size={14} /> {t('common:btn.delete')}
          </button>
        )}
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.close')}</button>
        <button type="button" onClick={onEdit} className={btnPrimary}>
          <Pencil size={14} /> {t('common:btn.edit')}
        </button>
      </>}>
        <div className="px-4 sm:px-6 py-5 space-y-5">
          <div className="@container grid grid-cols-1 @lg:grid-cols-2 gap-4 text-sm [&>*]:min-w-0">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t('common:field.date')}</p>
              <p className="font-medium text-slate-700">{new Date(purchase.purchase_date).toLocaleDateString(localeFor())}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t('purchases.col.supplier')}</p>
              <p className="font-medium text-slate-700">{getSupplierName(purchase)}</p>
            </div>
            {purchase.supplier_phone && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">{t('purchases.field.supplier_phone')}</p>
                <p className="text-slate-700">{purchase.supplier_phone}</p>
              </div>
            )}
            {purchase.invoice_no && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">{t('purchases.field.invoice_no')}</p>
                <p className="text-slate-700 font-mono">{purchase.invoice_no}</p>
              </div>
            )}
            {purchase.payment_account && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">{t('purchases.col.paid_from')}</p>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{purchase.payment_account.name}</span>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t('purchases.col.total_cost')}</p>
              <p className="text-lg font-bold text-slate-800">{fmtMoney(purchase.total_cost)}</p>
            </div>
          </div>

          {purchase.notes && (
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-600">
              <span className="text-xs font-medium text-slate-400 block mb-1">{t('common:field.notes')}</span>
              {purchase.notes}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('purchases.items')}</p>
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <th className="text-start px-4 py-2 w-10"><abbr title={t('common:table.serial_full')} className="no-underline">{t('common:table.serial')}</abbr></th>
                    <th className="text-start px-4 py-2">{t('purchases.col.medicine')}</th>
                    <th className="text-start px-4 py-2">{t('batches.col.batch_no')}</th>
                    <th className="text-start px-4 py-2">{t('batches.col.expiry')}</th>
                    <th className="text-end px-4 py-2">{t('col.qty')}</th>
                    <th className="text-end px-4 py-2">{t('purchases.col.unit_price')}</th>
                    <th className="text-end px-4 py-2">{t('purchases.col.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchase.items?.map((pi, i) => (
                    <tr key={i} className="text-slate-600">
                      <td className="px-4 py-2 text-xs text-slate-400 tabular-nums">{fmtNum(i + 1)}</td>
                      <td className="px-4 py-2 font-medium">{pi.medicine ? pi.medicine.name : ''}</td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{pi.batch_number}</td>
                      <td className="px-4 py-2 text-xs text-slate-400">
                        {pi.expiry_date ? new Date(pi.expiry_date).toLocaleDateString(localeFor()) : '—'}
                      </td>
                      <td className="px-4 py-2 text-end">{fmtNum(pi.quantity)} {pi.medicine?.unit?.symbol}</td>
                      <td className="px-4 py-2 text-end">{fmtMoney(pi.unit_price)}</td>
                      <td className="px-4 py-2 text-end font-medium">{fmtMoney(pi.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={6} className="px-4 py-2 text-end text-xs font-medium text-slate-500">{t('purchases.grand_total')}</td>
                    <td className="px-4 py-2 text-end font-bold text-slate-800">{fmtMoney(purchase.total_cost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
    </Modal>
  );
}
