'use client';

import NumberInput from '@/components/ui/NumberInput';
import { fmtMoney, fmtNum } from '@/lib/format';

export interface PriceRow {
  name: string;
  /** A second line: batch number, etc. */
  sub?: string;
  quantity: string;
  unit_symbol: string;
  unit_price: string;
}

const money = (n: number) => fmtMoney(n);

/**
 * Correct the unit price of items already bought (quantities stay). Phones
 * get one card per item; larger screens a table. The new total updates live.
 */
export default function PriceCorrectionList({ rows, onPrice, labels }: {
  rows: PriceRow[];
  onPrice: (index: number, price: string) => void;
  labels: { item: string; qty: string; unitPrice: string; total: string; newTotal: string };
}) {
  const line = (r: PriceRow) => (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0);
  const grand = rows.reduce((s, r) => s + line(r), 0);
  const box = (r: PriceRow, i: number) => (
    <NumberInput value={r.unit_price} prefix="৳" aria-label={`${r.name} ${labels.unitPrice}`} onChange={v => onPrice(i, v)} />
  );

  return (
    <>
      <ul className="sm:hidden space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="flex justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block font-medium text-slate-800 truncate">{r.name}</span>
                {r.sub && <span className="block text-xs text-slate-400 font-mono">{r.sub}</span>}
              </span>
              <span className="text-slate-500 shrink-0">{fmtNum(r.quantity)} {r.unit_symbol}</span>
            </div>
            {box(r, i)}
            <p className="text-xs text-end text-slate-500">{labels.total}: <span className="font-semibold text-slate-700">{money(line(r))}</span></p>
          </li>
        ))}
        <li className="flex justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800">
          <span>{labels.newTotal}</span><span>{money(grand)}</span>
        </li>
      </ul>

      <div className="hidden sm:block border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <th className="text-start px-3 py-2">{labels.item}</th>
              <th className="text-end px-3 py-2">{labels.qty}</th>
              <th className="text-end px-3 py-2 w-40">{labels.unitPrice}</th>
              <th className="text-end px-3 py-2">{labels.total}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i} className="text-slate-600">
                <td className="px-3 py-2">
                  <span className="font-medium">{r.name}</span>
                  {r.sub && <span className="block text-xs text-slate-400 font-mono">{r.sub}</span>}
                </td>
                <td className="px-3 py-2 text-end whitespace-nowrap">{fmtNum(r.quantity)} {r.unit_symbol}</td>
                <td className="px-3 py-2">{box(r, i)}</td>
                <td className="px-3 py-2 text-end font-medium whitespace-nowrap">{money(line(r))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td colSpan={3} className="px-3 py-2 text-end font-semibold text-slate-600">{labels.newTotal}</td>
              <td className="px-3 py-2 text-end font-bold text-slate-800">{money(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
