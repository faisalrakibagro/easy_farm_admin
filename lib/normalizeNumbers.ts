const NUMERAL_MAP: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

export function normalizeNumber(value: string): string {
  return value.replace(/[০-৯٠-٩۰-۹]/g, ch => NUMERAL_MAP[ch] ?? ch);
}

export function normalizeNumberInput(value: string, allowDecimal = true): string {
  const normalized = normalizeNumber(value);
  return allowDecimal
    ? normalized.replace(/[^\d.-]/g, '')
    : normalized.replace(/[^\d-]/g, '');
}
