'use client';

import { useTranslation } from 'react-i18next';
import { Trash2, Pencil, FileText } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary } from '@/lib/formStyles';
import type { FeedPurchase, AccountingPaymentAccount } from '@/types';
import { localeFor } from '@/lib/languages';
import { fmtMoney, fmtNum } from '@/lib/format';

interface FeedPurchaseFull extends FeedPurchase {
  supplier_id?: number | null;
  supplier?: { id: number; name: string } | null;
  payment_account_id?: number | null;
  payment_account?: AccountingPaymentAccount | null;
  payment_status?: 'paid' | 'partial' | 'unpaid';
  paid_amount?: string | number;
  due_amount?: string | number;
}

function InvoiceLink({ url }: { url: string | null }) {
  const { t } = useTranslation('feed');
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
      <FileText size={12} /> {t('purchases.view_file')}
    </a>
  );
}

interface FeedPurchaseDetailModalProps {
  purchase: FeedPurchaseFull;
  onClose: () => void;
  isSuperAdmin: boolean;
  getSupplierName: (p: FeedPurchaseFull) => string;
  onEdit: () => void;
  onDelete: () => void;
}

export default function FeedPurchaseDetailModal({
  purchase, onClose, isSuperAdmin, getSupplierName, onEdit, onDelete,
}: FeedPurchaseDetailModalProps) {
  const { t } = useTranslation('feed');
  const { t: tc } = useTranslation('common');

  return (
    <Modal onClose={onClose} dirty={false} size="2xl" title={t('purchases.detail_title')}
      footer={<>
        {isSuperAdmin && (
          <button type="button" onClick={onDelete}
            className="sm:me-auto inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
            <Trash2 size={14} /> {t('purchases.delete_modal.btn')}
          </button>
        )}
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.close')}</button>
        <button type="button" onClick={onEdit} className={btnPrimary}>
          <Pencil size={14} /> {tc('btn.edit')}
        </button>
      </>}>
        <div className="px-4 sm:px-6 py-5 space-y-5">
          {/* Header info */}
          <div className="@container grid grid-cols-1 @lg:grid-cols-2 gap-4 text-sm [&>*]:min-w-0">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t('purchases.col.date')}</p>
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
                <p className="text-xs text-slate-400 mb-0.5">{t('purchases.field.paid_from')}</p>
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

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('purchases.items')}</p>
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <th className="text-start px-4 py-2 w-10"><abbr title={t('common:table.serial_full')} className="no-underline">{t('common:table.serial')}</abbr></th>
                    <th className="text-start px-4 py-2">{t('col.feed_item')}</th>
                    <th className="text-start px-4 py-2">{t('col.category')}</th>
                    <th className="text-end px-4 py-2">{t('col.qty')}</th>
                    <th className="text-end px-4 py-2">{t('purchases.col.unit_price')}</th>
                    <th className="text-end px-4 py-2">{t('purchases.col.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchase.items?.map((pi, i) => (
                    <tr key={i} className="text-slate-600">
                      <td className="px-4 py-2 text-xs text-slate-400 tabular-nums">{fmtNum(i + 1)}</td>
                      <td className="px-4 py-2 font-medium">{pi.item ? pi.item.name : ''}</td>
                      <td className="px-4 py-2 text-slate-400 text-xs">{pi.item?.category ? pi.item.category.name : ''}</td>
                      <td className="px-4 py-2 text-end">{fmtNum(pi.quantity)} {pi.item?.unit?.symbol}</td>
                      <td className="px-4 py-2 text-end">{fmtMoney(pi.unit_price)}</td>
                      <td className="px-4 py-2 text-end font-medium">{fmtMoney(pi.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={5} className="px-4 py-2 text-end text-xs font-medium text-slate-500">{t('purchases.grand_total')}</td>
                    <td className="px-4 py-2 text-end font-bold text-slate-800">{fmtMoney(purchase.total_cost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {purchase.receipt_file_url && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FileText size={14} className="text-blue-400" />
              <span className="text-slate-400 text-xs">{t('purchases.label.invoice_file')}</span>
              <InvoiceLink url={purchase.receipt_file_url} />
            </div>
          )}
        </div>
    </Modal>
  );
}
