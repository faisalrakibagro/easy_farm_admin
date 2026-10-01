'use client';

import { useTranslation } from 'react-i18next';
import { Trash2, AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnSecondary } from '@/lib/formStyles';
import type { FeedPurchase, AccountingPaymentAccount } from '@/types';
import { fmtMoney } from '@/lib/format';

interface FeedPurchaseFull extends FeedPurchase {
  supplier_id?: number | null;
  supplier?: { id: number; name: string } | null;
  payment_account_id?: number | null;
  payment_account?: AccountingPaymentAccount | null;
  payment_status?: 'paid' | 'partial' | 'unpaid';
  paid_amount?: string | number;
  due_amount?: string | number;
}

interface FeedPurchaseDeleteModalProps {
  purchase: FeedPurchaseFull;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  getSupplierName: (p: FeedPurchaseFull) => string;
}

export default function FeedPurchaseDeleteModal({
  purchase, onClose, onConfirm, isPending, getSupplierName,
}: FeedPurchaseDeleteModalProps) {
  const { t } = useTranslation('feed');

  return (
    <Modal onClose={onClose} dirty={false} size="md" title={t('purchases.delete_modal.title')}
      icon={<Trash2 size={16} className="text-red-500 shrink-0" />}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>
          {t('common:btn.cancel')}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onConfirm}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50">
          <Trash2 size={14} />
          {isPending ? t('common:status.loading') : t('purchases.delete_modal.btn')}
        </button>
      </>}>
        <div className="px-4 sm:px-6 py-5 space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p>{t('purchases.delete_modal.desc')}</p>
          </div>
          <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm space-y-1">
            <p className="text-slate-500 text-xs">{t('purchases.col.supplier')}</p>
            <p className="font-medium text-slate-800">{getSupplierName(purchase)}</p>
            <p className="text-slate-500 text-xs mt-1">{t('purchases.col.total_cost')}</p>
            <p className="font-bold text-slate-800">{fmtMoney(purchase.total_cost)}</p>
          </div>
        </div>
    </Modal>
  );
}
