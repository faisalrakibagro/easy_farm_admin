import type { SaleInvoiceData } from '@/components/cattle/types';
import { fmtMoney, fmtNum } from '@/lib/format';
import { escapeHtml as esc } from '@/lib/escapeHtml';

type TFn = (key: string, options?: Record<string, unknown>) => string;

export function printCattleSaleInvoice(invoiceData: SaleInvoiceData, saleDate: string, t: TFn, onPopupBlocked: () => void) {
  // Each value is escaped here, so the rows are finished markup.
  const rows = invoiceData.sales.map((s, i) => [
    '<tr>',
    `<td>${esc(fmtNum(i + 1))}</td>`,
    `<td>${esc(s.cattle.tag_number)}${s.cattle.name ? ` (${esc(s.cattle.name)})` : ''}</td>`,
    `<td>${s.sale_weight != null ? `${esc(fmtNum(s.sale_weight))} ${esc(t('cattle:unit.kg'))}` : '—'}</td>`,
    `<td style="text-align:right">${esc(fmtMoney(s.sale_price))}</td>`,
    `<td style="text-align:right">${esc(fmtMoney(s.paid_amount))}</td>`,
    `<td style="text-align:right">${esc(fmtMoney(s.due_amount))}</td>`,
    '</tr>',
  ].join('')).join('');

  const html = [
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(t('receipt.title'))}</title>`,
    '<style>',
    'body{font-family:sans-serif;padding:30px;max-width:700px;margin:0 auto}',
    'h2{text-align:center;margin-bottom:4px}',
    '.meta{text-align:center;color:#555;margin-bottom:20px;font-size:14px}',
    'table{width:100%;border-collapse:collapse;margin:16px 0}',
    'th,td{border:1px solid #ccc;padding:8px 12px;font-size:13px}',
    'th{background:#f5f5f5;text-align:left}',
    'tfoot td{font-weight:bold;background:#fafafa}',
    '.footer{text-align:center;margin-top:30px;color:#888;font-size:12px;border-top:1px solid #eee;padding-top:10px}',
    '@media print{button{display:none}}',
    '</style></head><body>',
    `<h2>${esc(t('receipt.title'))}</h2>`,
    `<div class="meta">${esc(t('common:field.date'))}: ${esc(saleDate)} | ${esc(t('bulk.sale.buyer_label'))} ${esc(invoiceData.customer.name)}${invoiceData.customer.phone ? ` (${esc(invoiceData.customer.phone)})` : ''}</div>`,
    '<table><thead><tr>',
    `<th style="width:2.5em">${esc(t('common:table.serial'))}</th>`,
    `<th>${esc(t('bulk.sale.col_cattle_tag'))}</th><th>${esc(t('receipt.col_weight'))}</th>`,
    `<th style="text-align:right">${esc(t('bulk.sale.col_sale_price'))}</th>`,
    `<th style="text-align:right">${esc(t('bulk.sale.col_paid'))}</th>`,
    `<th style="text-align:right">${esc(t('bulk.sale.col_due'))}</th>`,
    '</tr></thead>',
    `<tbody>${rows}</tbody>`,
    '<tfoot><tr>',
    `<td colspan="3"><strong>${esc(t('common:total'))}</strong></td>`,
    `<td style="text-align:right">${esc(fmtMoney(invoiceData.total_revenue))}</td>`,
    `<td style="text-align:right">${esc(fmtMoney(invoiceData.total_paid))}</td>`,
    `<td style="text-align:right">${esc(fmtMoney(invoiceData.total_due))}</td>`,
    '</tr></tfoot></table>',
    `<div class="footer">${esc(t('receipt.footer_note'))}</div>`,
    `<br><button onclick="window.print()" style="padding:8px 20px;cursor:pointer">${esc(t('receipt.print_btn'))}</button>`,
    '</body></html>',
  ].join('');

  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => URL.revokeObjectURL(url));
  } else {
    URL.revokeObjectURL(url);
    onPopupBlocked();
  }
}
