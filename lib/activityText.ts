import { fmtDate, fmtMoney, fmtNum } from '@/lib/format';
import { localeFor } from '@/lib/languages';

/**
 * Activity-log and cattle-ledger lines in the reader's language.
 *
 * The API stores these lines as English text. Newer rows also carry a message
 * key and raw values (activity log: App\Support\ActivityText; cattle ledger:
 * App\Support\CattleLedgerText), which are said here from the `activity`
 * namespace with numbers, money and dates in the reader's digits. Older
 * activity rows are recognised by their English wording; anything unknown is
 * shown as stored.
 */

/** Any i18next `t` (or a component's `t` prop). */
type Translate = (key: string, opts?: Record<string, unknown>) => string;

type Raw = string | number | null | undefined;
type Params = Record<string, Raw>;

/** An activity-log row as ActivityLogResource sends it. */
export interface ActivityLine {
  description: string;
  key?: string | null;
  params?: Params | null;
  event: string | null;
  subject_type?: string | null;
  changes?: { old?: Record<string, unknown>; new?: Record<string, unknown> };
}

/** A cattle-ledger row from /farm/cattle/{id}/ledger. */
export interface LedgerLine {
  description: string;
  key?: string | null;
  params?: Params | null;
}

const humanize = (s: string): string => {
  const words = s.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** 'BreedingRecord' → 'breeding_record'. */
const snake = (basename: string): string => basename.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** An identifier (record number, year) in the reader's digits, never grouped: #১২৩৪, not #১,২৩৪. */
const plainDigits = (v: Raw): string =>
  new Intl.NumberFormat(localeFor(), { useGrouping: false, maximumFractionDigits: 0 }).format(Number(v));

/** A snake_case code word (status, purpose …) through activity:value, else as is. */
const valueWord = (v: string, t: Translate): string =>
  /^[a-z][a-z0-9_]*$/.test(v) ? t(`activity:value.${v}`, { defaultValue: v }) : v;

export function eventLabel(event: string, t: Translate): string {
  return t(`activity:event.${event.startsWith('cache_') ? 'cache' : event}`, { defaultValue: humanize(event) });
}

export function logNameLabel(name: string, t: Translate): string {
  return t(`activity:log_name.${name}`, { defaultValue: humanize(name) });
}

/** A subject_type basename ('CattleSale') as a record name ("Animal sale"). */
export function modelLabel(subjectType: string, t: Translate): string {
  const key = snake(subjectType);
  return t(`activity:model.${key}`, { defaultValue: humanize(key) });
}

/** "Cattle #12" → "পশু #১২". */
export function recordLabel(subjectType: string, id: number | null | undefined, t: Translate): string {
  return t('activity:record', { model: modelLabel(subjectType, t), id: id ?? '' });
}

export function fieldLabel(field: string, t: Translate): string {
  return t(`activity:field.${field}`, { defaultValue: humanize(field.replace(/_id$/, '')) });
}

const MONEY_FIELDS = new Set([
  'amount', 'purchase_price', 'sale_price', 'total_cost', 'profit_loss', 'current_market_value', 'current_value',
  'daily_wage', 'total_paid', 'monthly_salary', 'base_salary', 'advance_deduction', 'bonus', 'net_paid', 'cost',
  'cost_per_straw', 'vet_fee', 'medicine_cost', 'unit_price', 'unit_cost', 'rate', 'paid_amount', 'opening_balance',
  'investment_amount', 'disposal_amount', 'book_value_at_disposal', 'total_feed_cost', 'repaid_amount',
  'calf_value_male', 'calf_value_female',
]);

/** Kept as typed even when all digits: phone numbers, codes, invoice numbers. */
const TEXT_FIELDS = new Set([
  'phone', 'mobile', 'buyer_phone', 'supplier_phone', 'nid_number', 'invoice_no', 'tag_number', 'ear_tag_number',
  'employee_code', 'code', 'bull_code', 'reference', 'slug', 'name', 'title', 'notes', 'description',
]);

/** One old/new value of a changed field, as the reader reads it. */
export function changeValue(field: string, value: unknown, t: Translate): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return t(value ? 'activity:value.yes' : 'activity:value.no');
  if (Array.isArray(value)) return value.map(v => changeValue(field, v, t)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);

  const text = String(value);
  const numeric = typeof value === 'number' || (/^-?\d+(\.\d+)?$/.test(text) && !/^0\d/.test(text));
  if (numeric && !TEXT_FIELDS.has(field)) {
    if (MONEY_FIELDS.has(field)) return fmtMoney(text);
    if (field === 'id' || field.endsWith('_id') || field === 'payment_year') return plainDigits(text);
    return fmtNum(text);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) || /^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?Z$/.test(text)) return fmtDate(text);
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text)) {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString(localeFor());
  }
  return TEXT_FIELDS.has(field) ? text : valueWord(text, t);
}

// ── Activity log ────────────────────────────────────────────────────────────

/** Values of an activity message, ready for the sentence. */
function messageParams(key: string, params: Params, t: Translate): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') {
      out[name] = '';
    } else if (name === 'amount' || name === 'profit_loss') {
      out[name] = fmtMoney(v);
    } else if (name === 'count') {
      out[name] = fmtNum(v);
    } else if (name === 'from' || name === 'to') {
      out[name] = valueWord(String(v), t);
    } else if (key === 'cache_operation' && (name === 'type' || name === 'status')) {
      out[name] = t(`activity:cache_${name}.${v}`, { defaultValue: String(v) });
    } else {
      out[name] = String(v);
    }
  }
  return out;
}

/**
 * Rows logged before the key was stored, by their English wording:
 * [pattern, message key, names of its capture groups]. The wording is that of
 * lang/en/activity.php on the API.
 */
const LEGACY: Array<[RegExp, string, string[]]> = [
  [/^(.+) logged in\.$/, 'auth_login', ['name']],
  [/^(.+) logged out\.$/, 'auth_logout', ['name']],
  [/^Account transfer of ৳(-?[\d.,]+) recorded$/, 'account_transfer_recorded', ['amount']],
  [/^Cattle registered: #(.+)$/, 'cattle_registered', ['tag']],
  [/^Updated cattle: #(.+)$/, 'cattle_updated', ['tag']],
  [/^Deleted cattle: #(.+)$/, 'cattle_trashed', ['tag']],
  [/^Purpose changed: #(\S+) (\S+) → (\S+)$/, 'cattle_purpose_changed', ['tag', 'from', 'to']],
  [/^Cattle sold: #(.+) — Profit\/Loss: (-?[\d.]+)$/, 'cattle_sold', ['tag', 'profit_loss']],
  [/^Cattle marked as dead: #(.+)$/, 'cattle_dead', ['tag']],
  [/^Cattle transferred: #(\S+) — (.+)$/, 'cattle_transferred_reason', ['tag', 'reason']],
  [/^Cattle transferred: #(\S+)$/, 'cattle_transferred', ['tag']],
  [/^Cattle age category transitioned$/, 'cattle_age_category_changed_plain', []],
  [/^Expense recorded: (.+) \((-?[\d.]+)\)$/, 'expense_recorded', ['title', 'amount']],
  [/^Held expense allocated: (.+) \((-?[\d.]+)\)$/, 'expense_allocated', ['title', 'amount']],
  [/^Expense deleted: (.+)$/, 'expense_deleted', ['title']],
  [/^Feed purchase recorded from (.+)$/, 'feed_purchase_recorded', ['supplier']],
  [/^Feed purchase recorded from ?$/, 'feed_purchase_recorded_plain', []],
  [/^Medicine purchase recorded from (.+)$/, 'medicine_purchase_recorded', ['supplier']],
  [/^Medicine purchase recorded from ?$/, 'medicine_purchase_recorded_plain', []],
  [/^Medicine added: (.+)$/, 'medicine_added', ['name']],
  [/^Medicine deleted: (.+)$/, 'medicine_deleted', ['name']],
  [/^Employee added: (.+)$/, 'employee_added', ['name']],
  [/^Created shed: (.+)$/, 'shed_created', ['name']],
  [/^Deleted shed: (.+)$/, 'shed_deleted', ['name']],
  [/^Created user: (.+)$/, 'user_created', ['name']],
  [/^Moved user to trash: (.+)$/, 'user_trashed', ['name']],
  [/^Restored user: (.+)$/, 'user_restored', ['name']],
  [/^Permanently deleted user: (.+)$/, 'user_force_deleted', ['name']],
  [/^Uploaded media: (.+)$/, 'media_uploaded', ['name']],
  [/^Updated media metadata: (.+)$/, 'media_updated', ['name']],
  [/^Moved media to trash: (.+)$/, 'media_trashed', ['name']],
  [/^Restored media: (.+)$/, 'media_restored', ['name']],
  [/^Permanently deleted media: (.+)$/, 'media_force_deleted', ['name']],
  [/^Moved (\d+) media file\(s\) to trash\.$/, 'media_bulk_trashed', ['count']],
  [/^Restored (\d+) media file\(s\) from trash\.$/, 'media_bulk_restored', ['count']],
  [/^Permanently deleted (\d+) media file\(s\)\.$/, 'media_bulk_force_deleted', ['count']],
  [/^Created media category: (.+)$/, 'media_category_created', ['name']],
  [/^Updated media category: (.+)$/, 'media_category_updated', ['name']],
  [/^Moved media category to trash: (.+)$/, 'media_category_trashed', ['name']],
  [/^Restored media category: (.+)$/, 'media_category_restored', ['name']],
  [/^Permanently deleted media category: (.+)$/, 'media_category_force_deleted', ['name']],
  [/^Updated theme settings\.$/, 'theme_updated', []],
  [/^Reset theme settings to defaults\.$/, 'theme_reset', []],
  [/^Cache operation \[([^\]]+)\] — status: (\S+)$/, 'cache_operation', ['type', 'status']],
];

/** Events the models log by themselves (description = the event). */
const MODEL_EVENTS = ['created', 'updated', 'deleted', 'restored'];

/** The attribute that names a record in "Animal created: C-0012". */
const NAME_FIELDS = ['tag_number', 'name', 'title', 'vaccine_name', 'bull_name', 'employee_code', 'code', 'invoice_no'];

function message(key: string, params: Params, fallback: string, t: Translate): string {
  return t(`activity:msg.${key}`, { ...messageParams(key, params, t), defaultValue: fallback });
}

/** An activity-log row's description, in the reader's language. */
export function activityText(log: ActivityLine, t: Translate): string {
  if (log.key) return message(log.key, log.params ?? {}, log.description, t);

  for (const [pattern, key, names] of LEGACY) {
    const m = pattern.exec(log.description);
    if (m) return message(key, Object.fromEntries(names.map((n, i) => [n, m[i + 1]])), log.description, t);
  }

  if (log.subject_type && log.event && MODEL_EVENTS.includes(log.event) && log.description === log.event) {
    const model = modelLabel(log.subject_type, t);
    const attrs = { ...(log.changes?.old ?? {}), ...(log.changes?.new ?? {}) };
    const nameField = NAME_FIELDS.find(f => attrs[f] !== null && attrs[f] !== undefined && attrs[f] !== '');
    return nameField
      ? t(`activity:model_event_named.${log.event}`, { model, name: String(attrs[nameField]) })
      : t(`activity:model_event.${log.event}`, { model });
  }

  return log.description;
}

// ── Cattle ledger ───────────────────────────────────────────────────────────

/** A cattle-ledger line's description, in the reader's language. */
export function ledgerText(entry: LedgerLine, t: Translate): string {
  if (!entry.key) return entry.description;

  const p = entry.params ?? {};
  const out: Record<string, string> = {};
  for (const [name, v] of Object.entries(p)) {
    if (v === null || v === undefined) continue;
    if (name === 'date') out.date = fmtDate(String(v));
    else if (name === 'qty' || name === 'total' || name === 'alive' || name === 'dead') out[name] = fmtNum(v);
    else if (name === 'sale' || name === 'attempt') out[name] = plainDigits(v);
    else if (name === 'result' || name === 'type') out[name] = valueWord(String(v), t);
    else out[name] = String(v);
  }
  if (p.month && p.year) {
    out.period = fmtDate(`${p.year}-${String(p.month).padStart(2, '0')}-01`, { month: 'long', year: 'numeric' });
  }
  if (entry.key === 'breeding_ai' || entry.key === 'breeding_natural') {
    out.method = t(`activity:value.${entry.key === 'breeding_ai' ? 'ai' : 'natural'}`);
  }

  return t(`activity:ledger.${entry.key}`, { ...out, defaultValue: entry.description });
}
