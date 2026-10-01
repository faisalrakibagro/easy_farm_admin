'use client';

import { useTranslation } from 'react-i18next';
import type { CattleDetail, SaleRecord } from './types';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';
import CattleAccount from '@/components/cattle/detail/CattleAccount';

interface ProfitAnalysisTabProps {
  cattle: CattleDetail;
  saleRecord: SaleRecord | null;
  profitLoss: number | null;
  isProfit: boolean | null;
  totalCost: number;
  purchasePrice: number;
  breakdown: Record<string, number>;
}

export default function ProfitAnalysisTab({ cattle, saleRecord }: ProfitAnalysisTabProps) {
  const { t } = useTranslation('cattle');

  return (
    <div className="space-y-4">
      {cattle.status === 'sold' && saleRecord && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('detail.sale_information')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><p className="text-xs text-slate-400">{t('detail.sale_date')}</p><p className="text-sm font-medium text-slate-700">{new Date(saleRecord.sale_date).toLocaleDateString(localeFor())}</p></div>
            <div><p className="text-xs text-slate-400">{t('detail.buyer')}</p><p className="text-sm font-medium text-slate-700">{saleRecord.buyer_name}</p></div>
            <div><p className="text-xs text-slate-400">{t('detail.sale_price')}</p><p className="text-sm font-semibold text-green-700">{fmtMoney(saleRecord.sale_price)}</p></div>
          </div>
          {saleRecord.notes && <p className="text-xs text-slate-500 mt-3">{saleRecord.notes}</p>}
        </div>
      )}
      <CattleAccount cattleId={cattle.id} />
    </div>
  );
}
