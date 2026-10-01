export interface User {
  id: number;
  name: string;
  email: string;
  /** The number the WhatsApp automation knows this user by (8801XXXXXXXXX). */
  whatsapp_phone?: string | null;
  avatar: string | null;
  is_active: boolean;
  last_login_at: string | null;
  roles: string[];
  permissions: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Role {
  id: number;
  name: string;
  permissions: string[];
  permissions_count: number;
  users_count: number;
  created_at: string;
}

export interface Permission {
  id: number;
  name: string;
}


export interface Setting {
  id: number;
  key: string;
  value: string | boolean | number | null;
  type: 'text' | 'boolean' | 'number' | 'json';
  description: string | null;
}

export interface ThemeSettings {
  theme_mode: 'light' | 'dark';
  theme_primary: string;
  theme_secondary: string;
  theme_sidebar_bg: string;
  theme_header_bg: string;
  theme_border_radius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  theme_font_size: 'sm' | 'base' | 'lg';
  theme_compact_mode: 'true' | 'false';
  theme_sidebar_logo: string;
}

export interface MediaCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  is_active: boolean;
  media_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MediaFile {
  id: number;
  name: string;
  file_name: string;
  mime_type: string | null;
  path: string;
  disk: string;
  size: number;
  url: string;
  thumbnail_url: string | null;
  type: 'image' | 'video' | 'audio' | 'document';
  collection_name: string | null;
  category_id: number | null;
  category?: MediaCategory | null;
  title: string | null;
  alt_text: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  created_by?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CacheLog {
  id: number;
  type: string;
  status: 'success' | 'failed';
  performed_by: number | null;
  performed_by_user?: { id: number; name: string } | null;
  note: string | null;
  cleared_at: string;
}

export interface ActivityLog {
  id: number;
  log_name: string;
  description: string;
  event: string | null;
  subject_type: string | null;
  subject_id: number | null;
  causer: { id: number; name: string; email: string } | null;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface DashboardStats {
  total_users: number;
  total_roles: number;
  total_permissions: number;
  recent_activities: ActivityLog[];
  stats_overview: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    total_roles: number;
    total_permissions: number;
  };
}

// ── Farm ERP Types ──────────────────────────────────────────────────────────

export interface AnimalType {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  maturity_months: number | null;
  maturity_weight_kg: string | null;
  /** Breeding settings (per species) — null until the farm fills them in. */
  gestation_days: number | null;
  heat_cycle_days: number | null;
  pregnancy_check_days: number | null;
  dry_period_days: number | null;
  is_milking: boolean;
  default_milking_times: number;
  /** Sessions its animals may be milked in. */
  milking_sessions?: MilkSession[] | null;
  calf_value_male?: string | number | null;
  calf_value_female?: string | number | null;
  cattle_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Shed {
  id: number;
  name: string;
  capacity: number | null;
  notes: string | null;
  cattle_count?: number;
  created_at: string;
  updated_at: string;
}

export type CattleStatus = 'active' | 'sold' | 'dead' | 'transferred';
export type CattleGender = 'male' | 'female';
export type CattleHealthStatus = 'healthy' | 'sick' | 'critical' | 'recovering';
export type AgeCategory = 'immature' | 'adult';

export interface AnimalAgeCategory {
  id: number;
  animal_type_id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface AnimalAgeStage {
  id: number;
  animal_type_id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export type CattleOrigin = 'purchased' | 'farm_born';
export type CattlePurpose = 'fattening' | 'breeding_female' | 'breeding_male' | 'dairy' | 'young_stock';
export type CattleReproductiveStatus = 'open' | 'inseminated' | 'pregnant' | 'lactating' | 'dry';

/** Purposes an animal of the given gender can have. */
export const PURPOSES_BY_GENDER: Record<CattleGender, CattlePurpose[]> = {
  female: ['fattening', 'breeding_female', 'dairy', 'young_stock'],
  male:   ['fattening', 'breeding_male', 'young_stock'],
};

/** A parent as embedded in /farm/cattle/{id} (dam / sire). */
export interface CattleRelativeRef {
  id: number;
  tag_number: string;
  name: string | null;
  gender: CattleGender;
}

/** One animal in the /farm/cattle/{id}/pedigree response. */
export interface PedigreeAnimal extends CattleRelativeRef {
  breed: string;
  status: CattleStatus;
  origin: CattleOrigin;
  purpose: CattlePurpose;
  birth_date: string | null;
  purchase_date: string | null;
  profile_image_url: string | null;
  is_deleted: boolean;
}

export interface PedigreeParent extends PedigreeAnimal {
  dam: PedigreeAnimal | null;
  sire: PedigreeAnimal | null;
}

export interface CattlePedigree {
  animal: PedigreeAnimal;
  dam: PedigreeParent | null;
  sire: PedigreeParent | null;
  siblings: (PedigreeAnimal & { relation: 'full' | 'half' })[];
  offspring: PedigreeAnimal[];
  counts: { offspring: number; female: number; male: number };
}

export interface CattlePurposeHistory {
  id: number;
  cattle_id: number;
  from_purpose: CattlePurpose | null;
  to_purpose: CattlePurpose;
  changed_on: string;
  reason: string | null;
  changed_by?: { id: number; name: string } | null;
}

export interface Cattle {
  id: number;
  tag_number: string;
  ear_tag_number: string | null;
  name: string | null;
  /**
   * String column on `cattle`, EXCEPT on list endpoints: CattleResource
   * snake_cases the eager-loaded `animalType` relation to the same key and
   * merges it over the column, so /farm/cattle returns {id, name} here
   * while /farm/cattle/{id} (no animalType eager-load) returns the string.
   * Read it through `animalTypeName()`.
   */
  animal_type: string | AnimalType | null;
  animal_type_id: number | null;
  animalType?: AnimalType | null;
  breed: string;
  breed_id?: number | null;
  color: string | null;
  gender: CattleGender;
  origin: CattleOrigin;
  purpose: CattlePurpose;
  dam_id: number | null;
  sire_id: number | null;
  dam?: CattleRelativeRef | null;
  sire?: CattleRelativeRef | null;
  birth_date: string | null;
  birth_weight: string | null;
  birth_value?: string | null;
  /** Females only. */
  reproductive_status: CattleReproductiveStatus | null;
  /** Milkings per day; null = the animal type's default. */
  milking_times: number | null;
  /** Its own milking sessions; null = its type's. */
  milking_sessions?: MilkSession[] | null;
  /** Purchase details are null for a farm-born animal (origin = 'farm_born'). */
  purchase_date: string | null;
  purchase_price: string | null;
  purchase_weight: string | null;
  current_weight: string | null;
  current_market_value: string | null;
  feed_ratio: string;
  status: CattleStatus;
  /** The day it died or was transferred away (a sale keeps its own date). */
  exit_date?: string | null;
  health_status: CattleHealthStatus;
  age_stage_id: number | null;
  age_category_id: number | null;
  ageStage?: AnimalAgeStage | null;
  ageCategory?: AnimalAgeCategory | null;
  shed_id: number | null;
  shed?: Shed | null;
  seller_name: string | null;
  seller_phone: string | null;
  seller_address: string | null;
  notes: string | null;
  profile_image_url: string | null;
  invoice_file: string | null;
  invoice_file_url: string | null;
  sale?: CattleSale | null;
  feedRatioHistories?: CattleFeedRatioHistory[];
  ageTransitionHistories?: AgeTransitionHistory[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CattleWeight {
  id: number;
  cattle_id: number;
  weight_date: string;
  weight: string;
  weight_gain: string | null;
  daily_gain: string | null;
  days_since_last: number | null;
  notes: string | null;
  created_at: string;
}

export interface CattleLedgerEntry {
  id: number;
  cattle_id: number;
  entry_date: string;
  entry_type: string;
  description: string;
  amount: string;
  source_type: string | null;
  source_id: number | null;
  created_at: string;
}

export interface CattleFeedRatioHistory {
  id: number;
  cattle_id: number;
  feed_ratio: string;
  previous_ratio: string | null;
  effective_date: string;
  notes: string | null;
  created_at: string;
}

export interface AgeTransitionHistory {
  id: number;
  cattle_id: number;
  from_category: AgeCategory;
  to_category: AgeCategory;
  transition_reason: 'age_based' | 'weight_based' | 'manual';
  transition_date: string;
  notes: string | null;
  triggered_by?: { id: number; name: string } | null;
  created_at: string;
}

export interface Unit {
  id: number;
  name: string;
  symbol: string;
  is_active: boolean;
  created_at: string;
}

/** @deprecated use Unit */
export type FeedUnit = Unit;

export interface FeedCategory {
  id: number;
  name: string;
  description: string | null;
  items_count?: number;
  created_at: string;
}

export interface FeedItem {
  id: number;
  category_id: number;
  unit_id: number;
  name: string;
  low_stock_alert: string;
  description: string | null;
  category?: FeedCategory;
  unit?: FeedUnit;
  created_at: string;
}

export interface FeedPurchase {
  id: number;
  supplier_name: string;
  supplier_phone: string | null;
  invoice_no: string | null;
  purchase_date: string;
  total_cost: string;
  notes: string | null;
  receipt_file: string | null;
  receipt_file_url: string | null;
  items?: FeedPurchaseItem[];
  created_at: string;
}

export interface FeedPurchaseItem {
  id: number;
  feed_purchase_id: number;
  feed_item_id: number;
  quantity: string;
  unit_price: string;
  total_price: string;
  item?: FeedItem;
}

export interface FeedStock {
  id: number;
  feed_item_id: number;
  item_name: string;
  category_name: string;
  unit: string;
  remaining_quantity: number;
  unit_price: number;
}

export interface FeedAllocation {
  id: number;
  feed_usage_id: number;
  cattle_id: number;
  cattle_weight: string;
  weight_ratio: string;
  allocated_cost: string;
  cattle?: { id: number; tag_number: string; name: string | null; feed_ratio: string };
}

export interface FeedUsage {
  id: number;
  usage_date: string;
  total_feed_cost: string;
  allocation_method: 'weight_based' | 'equal' | 'milk_based';
  milk_share_percent?: number | null;
  shed_id?: number | null;
  profit_center?: string | null;
  animal_type_id: number | null;
  age_category_id: number | null;
  animalType?: AnimalType | null;
  ageCategory?: AnimalAgeCategory | null;
  active_cattle_count: number;
  is_allocated: boolean;
  notes: string | null;
  items?: FeedUsageItem[];
  allocations?: FeedAllocation[];
  created_at: string;
}

export interface FeedFormulation {
  id: number;
  name: string;
  animal_type_id: number | null;
  animal_type?: AnimalType | null;
  age_category_id: number | null;
  ageCategory?: AnimalAgeCategory | null;
  total_quantity_per_day: string | null;
  unit_id: number | null;
  unit?: FeedUnit | null;
  notes: string | null;
  is_active: boolean;
  /** Item quantities are for one animal; daily entry multiplies by the group size. */
  per_animal?: boolean;
  items?: FeedFormulationItem[];
  created_at: string;
  deleted_at?: string | null;
}

export interface FeedFormulationItem {
  id: number;
  formulation_id: number;
  feed_item_id: number;
  feed_item?: FeedItem;
  quantity: string;
  unit_id: number | null;
  unit?: FeedUnit | null;
  notes: string | null;
}

export interface FeedUsageItem {
  id: number;
  feed_usage_id: number;
  feed_stock_id: number;
  feed_item_id: number;
  quantity_used: string;
  unit_price: string;
  total_cost: string;
  item?: FeedItem;
}

/** @deprecated use Unit */
export type MedicineUnit = Unit;

export interface MedicineCategory {
  id: number;
  name: string;
  description: string | null;
  medicines_count?: number;
  created_at: string;
}

export interface Medicine {
  id: number;
  name: string;
  category_id: number | null;
  is_vaccine: boolean;
  unit_id: number;
  category?: MedicineCategory;
  unit?: MedicineUnit;
  manufacturer: string | null;
  /** Days the animal's milk is not sold after this medicine (dairy). */
  milk_withdrawal_days?: number;
  batch_no: string | null;
  expiry_date: string | null;
  supplier_name: string | null;
  invoice_no: string | null;
  purchase_date: string | null;
  quantity: string;
  used_quantity: string;
  remaining_quantity: string;
  unit_price: string;
  total_cost: string;
  low_stock_alert: string;
  notes: string | null;
  invoice_file: string | null;
  invoice_file_url: string | null;
  created_at: string;
}

export interface MedicineUsage {
  id: number;
  cattle_id: number;
  medicine_id: number;
  medicine_batch_id: number | null;
  vaccine_schedule_id: number | null;
  usage_date: string;
  quantity_used: string;
  unit: string;
  unit_cost: string;
  total_cost: string;
  next_due_date: string | null;
  notes: string | null;
  cattle?: Cattle;
  medicine?: Medicine;
  vaccine_schedule?: VaccineSchedule;
  created_at: string;
}

export interface VaccineSchedule {
  id: number;
  cattle_id: number;
  vaccine_name: string;
  vaccine_type: string;
  scheduled_date: string;
  administered_date: string | null;
  administered_by: string | null;
  cost: string;
  next_due_date: string | null;
  status: 'scheduled' | 'completed' | 'overdue' | 'cancelled';
  notes: string | null;
  vendor_name: string | null;
  invoice_no: string | null;
  receipt_file: string | null;
  cattle?: Cattle;
  medicine_usages?: MedicineUsage[];
  created_at: string;
}

export interface Treatment {
  id: number;
  cattle_id: number;
  treatment_date: string;
  doctor_name: string | null;
  doctor_phone: string | null;
  diagnosis: string | null;
  treatment: string;
  medicines_used: string | null;
  vet_fee: string;
  medicine_cost: string;
  total_cost: string;
  follow_up_date: string | null;
  health_status: CattleHealthStatus;
  notes: string | null;
  vendor_name: string | null;
  invoice_no: string | null;
  receipt_file: string | null;
  prescription?: string | null;
  cattle?: Cattle;
  created_at: string;
}

export interface LabourEmployee {
  id: number;
  employee_code: string;
  name: string;
  mobile: string | null;
  nid_number: string | null;
  address: string | null;
  joining_date: string;
  monthly_salary: string;
  status: 'active' | 'inactive' | 'terminated';
  notes: string | null;
  created_at: string;
}

export interface SalaryPayment {
  allocation_method?: 'equal' | 'weight_based';
  id: number;
  employee_id: number;
  payment_month: number;
  payment_year: number;
  base_salary: string;
  advance_deduction: string;
  bonus: string;
  net_paid: string;
  payment_date: string;
  payment_method: string;
  payment_account_id: number | null;
  payment_account?: { id: number; name: string; type: string };
  notes: string | null;
  receipt_file: string | null;
  employee?: LabourEmployee;
  created_at: string;
}

export interface DailyLabour {
  allocation_method?: 'equal' | 'weight_based';
  id: number;
  name: string;
  mobile: string | null;
  work_date: string;
  work_description: string | null;
  working_hours: string;
  daily_wage: string;
  total_paid: string;
  payment_status: 'unpaid' | 'paid' | 'partial';
  payment_date: string | null;
  payment_account_id: number | null;
  payment_account?: { id: number; name: string; type: string } | null;
  notes: string | null;
  receipt_file: string | null;
  created_at: string;
}

export interface Expense {
  id: number;
  category: string;
  title: string;
  amount: string;
  expense_date: string;
  /** 'hold' parks the expense: cash leaves the account, but no cattle is charged until it is released. */
  allocation_method: 'equal' | 'weight_based' | 'hold';
  is_allocated: boolean;
  is_recurring: boolean;
  recurring_period: string | null;
  description: string | null;
  vendor_name: string | null;
  invoice_no: string | null;
  receipt_file: string | null;
  receipt_file_url: string | null;
  payment_account_id: number | null;
  payment_account?: { id: number; name: string; type: string } | null;
  labour_employee_id: number | null;
  labour_employee?: { id: number; name: string; employee_code: string } | null;
  daily_labour_id: number | null;
  daily_labour?: { id: number; name: string; work_date: string; daily_wage: string; working_hours: string } | null;
  created_at: string;
}

export interface CattleSale {
  id: number;
  cattle_id: number;
  sale_date: string;
  buyer_name: string;
  buyer_phone: string | null;
  sale_weight: string | null;
  sale_price: string;
  total_cost: string;
  profit_loss: string;
  notes: string | null;
  payment_account_id: number | null;
  cattle?: Cattle;
  created_at: string;
}

export interface FarmDashboard {
  cattle: {
    active: number;
    sold: number;
    dead: number;
    transferred: number;
    total: number;
    immature: number;
    adult: number;
  };
  stock: {
    feed_value: number;
    medicine_value: number;
  };
  today_costs: {
    feed: number;
    medicine: number;
    labour: number;
    total: number;
  };
  financials: {
    total_investment: number;
    total_pl: number;
    total_feed_cost: number;
    total_medicine_cost: number;
    total_labour_cost: number;
    total_other_cost: number;
    projected_profit: number;
    actual_profit: number;
  };
  alerts: {
    upcoming_vaccines: VaccineSchedule[];
    weight_check_due: number;
    low_feed_stock: FeedItem[];
    low_medicine_stock: Medicine[];
    expiring_medicines: Medicine[];
  };
  top_expensive_cattle: Array<{
    cattle_id: number;
    total_cost: string;
    cattle: { id: number; tag_number: string; name: string | null; breed: string; status: string } | null;
  }>;
}

// ── Accounting Types ───────────────────────────────────────────────────────

export interface AccountingPaymentAccount {
  id: number;
  name: string;
  type: 'cash' | 'bank' | 'mfs';
  bank_name: string | null;
  account_number: string | null;
  mfs_provider: string | null;
  opening_balance: string;
  notes: string | null;
  is_active: boolean;
  is_default: boolean;
  balance?: number;
  created_at: string;
}

// ── Supplier Types ─────────────────────────────────────────────────────────

export interface SupplierType {
  id: number;
  slug: string;
  name: string;
  label: string;
  notes: string | null;
}

export interface Supplier {
  id: number;
  name: string;
  supplier_type_id: number | null;
  supplier_type?: SupplierType | null;
  phone: string | null;
  email: string | null;
  photo: string | null;
  photo_url: string | null;
  address: string | null;
  opening_balance: string;
  notes: string | null;
  is_active: boolean;
  total_purchases?: number;
  total_paid?: number;
  balance?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SupplierPayment {
  id: number;
  supplier_id: number;
  type: 'payment' | 'adjustment';
  amount: string;
  payment_method: string | null;
  payment_date: string;
  notes: string | null;
  payment_account_id: number | null;
  payment_account?: { id: number; name: string } | null;
  created_at: string;
}

export interface SupplierLedgerEntry {
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference_id: number;
}

// ── Customer Types ────────────────────────────────────────────────────────

export interface Customer {
  id: number;
  name: string;
  customer_type_id?: number | null;
  customer_type?: { id: number; slug: string; name: string } | null;
  company_name?: string | null;
  contact_person?: string | null;
  trade_license_no?: string | null;
  phone: string | null;
  email: string | null;
  photo: string | null;
  photo_url: string | null;
  address: string | null;
  opening_balance: string;
  notes: string | null;
  is_active: boolean;
  total_sales?: number;
  total_received?: number;
  balance?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CustomerPayment {
  id: number;
  customer_id: number;
  type: 'payment' | 'adjustment';
  amount: string;
  payment_date: string;
  notes: string | null;
  payment_account_id: number | null;
  payment_account?: { id: number; name: string } | null;
  created_at: string;
}

export interface CustomerLedgerEntry {
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference_id: number;
}

// ── Medicine Purchase Types ───────────────────────────────────────────────

export interface MedicinePurchase {
  id: number;
  supplier_id: number | null;
  supplier?: { id: number; name: string } | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  invoice_no: string | null;
  purchase_date: string;
  total_cost: string;
  notes: string | null;
  receipt_file: string | null;
  receipt_file_url: string | null;
  items?: MedicinePurchaseItem[];
  created_at: string;
}

export interface MedicinePurchaseItem {
  id: number;
  medicine_purchase_id: number;
  medicine_id: number;
  medicine?: Medicine;
  batch_number: string;
  quantity: string;
  unit_price: string;
  total_price: string;
  expiry_date: string | null;
  notes: string | null;
}

export interface MedicineBatch {
  id: number;
  medicine_id: number;
  medicine?: Medicine;
  medicine_purchase_item_id: number | null;
  batch_number: string;
  purchase_date: string | null;
  expiry_date: string | null;
  quantity_received: string;
  quantity_used: string;
  quantity_remaining: string;
  unit_price: string;
  created_at: string;
  /** The purchase this batch came from (null for stock that never had a purchase). */
  supplier_name?: string | null;
  invoice_no?: string | null;
  medicine_purchase_id?: number | null;
}

/** Totals over a whole filtered batch list (not just one page). */
export interface MedicineBatchSummary {
  total: number;
  /** Batches that still hold stock. */
  in_stock: number;
  expiring_soon: number;
  expired: number;
  remaining_value: number;
}

/** One feed stock lot: a purchase line or a ready mix, with its own price. */
export interface FeedLot {
  id: number;
  feed_item: { id: number; name: string; unit: string | null; category: string | null };
  source: 'purchase' | 'mix' | 'other';
  supplier_name: string | null;
  invoice_no: string | null;
  feed_purchase_id: number | null;
  mix_batch_id: number | null;
  received_on: string | null;
  total_quantity: string;
  used_quantity: string;
  remaining_quantity: string;
  unit_price: string;
  remaining_value: number;
}

export interface FeedLotSummary {
  total: number;
  in_stock: number;
  remaining_value: number;
}

// ── Account Transfer Types ────────────────────────────────────────────────

export interface AccountTransfer {
  id: number;
  from_account_id: number;
  to_account_id: number;
  fromAccount?: { id: number; name: string; type: string };
  toAccount?: { id: number; name: string; type: string };
  amount: string;
  transfer_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

// ── Partner & Investment Types ────────────────────────────────────────────

export interface Partner {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  photo: string | null;
  photo_url: string | null;
  investment_amount: string;
  share_percentage: string;
  join_date: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  total_invested?: number;
  total_withdrawn?: number;
  net_investment?: number;
  created_at: string;
  deleted_at: string | null;
}

export interface PartnerTransaction {
  id: number;
  partner_id: number;
  type: 'investment' | 'withdrawal' | 'profit_share' | 'adjustment';
  amount: string;
  transaction_date: string;
  payment_method: string | null;
  payment_account_id: number | null;
  payment_account?: { id: number; name: string } | null;
  notes: string | null;
  created_at: string;
}

export interface FarmAttachment {
  id: number;
  attachable_type: string;
  attachable_id: number;
  file_name: string;
  file_path: string;
  file_type: string | null;
  mime_type: string | null;
  file_size: number;
  attachment_type: string | null;
  url: string;
  uploaded_by: number | null;
  created_at: string;
}

export type FixedAssetCategory = 'equipment' | 'furniture' | 'electronics' | 'vehicle' | 'other';
export type FixedAssetStatus   = 'active' | 'disposed';

export interface FixedAsset {
  id: number;
  name: string;
  category: FixedAssetCategory;
  purchase_date: string;
  purchase_price: string;
  current_value: string | null;
  payment_account_id: number;
  payment_account?: { id: number; name: string; type: string } | null;
  vendor_name: string | null;
  invoice_no: string | null;
  description: string | null;
  photo: string | null;
  status: FixedAssetStatus;
  disposed_date: string | null;
  disposal_amount: string | null;
  book_value_at_disposal: string | null;
  disposal_account_id: number | null;
  disposal_account?: { id: number; name: string; type: string } | null;
  disposal_note: string | null;
  gain_loss: number;
  book_value: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ── Breeding module (plan phase 2) ─────────────────────────────────────────

export type BreedingMethod = 'natural' | 'ai';
export type BreedingStatus = 'pending' | 'pregnant' | 'failed' | 'aborted' | 'delivered';
export type PregnancyCheckMethod = 'manual' | 'ultrasound' | 'test_kit';
export type DeliveryType = 'normal' | 'assisted' | 'caesarean';

/** Tag + name of an animal embedded in breeding records. */
export interface AnimalRef {
  id: number;
  tag_number: string;
  name: string | null;
}

export interface SemenStraw {
  id: number;
  animal_type_id: number;
  animal_type?: { id: number; name: string } | null;
  bull_name: string;
  bull_code: string | null;
  breed: string | null;
  supplier_id: number | null;
  supplier?: { id: number; name: string } | null;
  batch_no: string | null;
  quantity: number;
  remaining: number;
  used?: number;
  cost_per_straw: string;
  total_cost?: number;
  purchase_date: string;
  expiry_date: string | null;
  payment_account_id: number | null;
  payment_account?: { id: number; name: string } | null;
  payment_status: 'paid' | 'partial' | 'unpaid';
  paid_amount: string;
  due_amount: string;
  notes: string | null;
}

export interface HeatRecord {
  id: number;
  cattle_id: number;
  cattle?: AnimalRef & { animal_type_id: number | null };
  detected_on: string;
  signs: string | null;
  notes: string | null;
  next_expected_on?: string | null;
}

export interface PregnancyCheck {
  id: number;
  breeding_record_id: number;
  check_date: string;
  method: PregnancyCheckMethod;
  result: 'positive' | 'negative';
  checked_by: string | null;
  cost: string;
  notes: string | null;
}

export interface BreedingRecord {
  id: number;
  female_id: number;
  female?: AnimalRef & { animal_type_id: number | null; reproductive_status: CattleReproductiveStatus | null };
  service_date: string;
  method: BreedingMethod;
  sire_id: number | null;
  sire?: AnimalRef | null;
  semen_straw_id: number | null;
  semen_straw?: { id: number; bull_name: string; bull_code: string | null; breed?: string | null } | null;
  technician_name: string | null;
  attempt_no: number;
  straw_cost: string;
  service_fee: string;
  total_cost?: number;
  expected_delivery_date: string | null;
  pregnancy_check_due_on?: string | null;
  status: BreedingStatus;
  status_changed_on: string | null;
  notes: string | null;
  pregnancy_checks?: PregnancyCheck[];
  birth?: { id: number; birth_date: string; born_alive: number; born_dead: number } | null;
}

export interface BirthCalf extends AnimalRef {
  gender: CattleGender;
  birth_weight: string | null;
  status: CattleStatus;
}

export interface Birth {
  id: number;
  dam_id: number;
  dam?: AnimalRef;
  breeding_record_id: number | null;
  breeding_record?: { id: number; service_date: string; method: BreedingMethod } | null;
  sire?: AnimalRef | null;
  semen_straw?: { id: number; bull_name: string; bull_code: string | null } | null;
  birth_date: string;
  delivery_type: DeliveryType;
  total_born: number;
  born_alive: number;
  born_dead: number;
  cost: string;
  notes: string | null;
  calves?: BirthCalf[];
}

export interface BreedingUpcomingRow {
  service_id?: number;
  female: AnimalRef;
  service_date?: string;
  date: string;
  days_left: number;
}

export interface BreedingSummary {
  counts: { pregnant: number; inseminated: number; open_breeders: number; semen_remaining: number };
  upcoming: {
    deliveries: BreedingUpcomingRow[];
    pregnancy_checks: BreedingUpcomingRow[];
    heats: BreedingUpcomingRow[];
    dry_off: BreedingUpcomingRow[];
  };
  kpi: {
    services: number; ai_services: number; natural_services: number; conceptions: number;
    conception_rate: number | null; ai_conception_rate: number | null; natural_conception_rate: number | null;
    services_per_conception: number | null;
    births: number; calves_alive: number; calves_dead: number; avg_calving_interval: number | null;
  };
  sires: { method: BreedingMethod; label: string; services: number; conceptions: number; conception_rate: number | null }[];
  period: { from: string; to: string };
}

export interface BreedingHistory {
  reproductive_status: CattleReproductiveStatus | null;
  next_heat_expected: string | null;
  open_service: BreedingRecord | null;
  heats: HeatRecord[];
  services: BreedingRecord[];
  births: Birth[];
  counts: { services: number; births: number; calves_born: number };
}

// ── Dairy module (plan phase 3) ────────────────────────────────────────────

export type MilkSession = 'morning' | 'noon' | 'evening';
export type MilkSaleType = 'wholesale' | 'retail';
export type MilkUsageType = 'calf_feeding' | 'household' | 'wastage';

export interface CustomerType {
  id: number;
  slug: string;
  name: string;
  notes: string | null;
  customers_count?: number;
}

export interface Lactation {
  id: number;
  cattle_id: number;
  cattle?: AnimalRef & { animal_type_id: number | null; shed_id: number | null; milking_times: number | null; status: CattleStatus };
  birth_id: number | null;
  lactation_no: number;
  start_date: string;
  dry_off_date: string | null;
  end_reason: string | null;
  notes: string | null;
  total_kg?: string | number | null;
}

export interface MilkSheetRow {
  cattle_id: number;
  tag_number: string;
  name: string | null;
  shed: string | null;
  lactation_id: number;
  lactation_no: number;
  days_in_milk: number;
  milking_times: number;
  milking_sessions: MilkSession[];
  /** false when it is on this sheet only because it was added or already recorded. */
  in_sessions?: boolean;
  quantity_kg: number | null;
  is_saleable: boolean;
  withdrawal_until: string | null;
}

export interface MilkSale {
  id: number;
  sale_date: string;
  sale_type: MilkSaleType;
  customer_id: number | null;
  customer?: { id: number; name: string; company_name: string | null } | null;
  buyer_name: string | null;
  quantity_kg: string;
  rate: string;
  amount: string;
  period_from: string;
  period_to: string;
  payment_status: 'paid' | 'partial' | 'unpaid';
  paid_amount: string;
  due_amount: string;
  payment_account_id: number | null;
  payment_account?: { id: number; name: string } | null;
  notes: string | null;
  allocations_count?: number;
}

export interface MilkUsage {
  id: number;
  usage_date: string;
  type: MilkUsageType;
  quantity_kg: string;
  notes: string | null;
}

export interface DairySummary {
  period: { from: string; to: string };
  totals: {
    produced_kg: number; saleable_kg: number; withheld_kg: number; sold_kg: number; used_kg: number;
    balance_kg: number; revenue: number; due: number; avg_price: number | null; in_milk: number; avg_per_cow_day: number | null;
  };
  sale_types: Record<MilkSaleType, { kg: number; amount: number; avg: number | null }>;
  usage: Partial<Record<MilkUsageType, number>>;
  daily: { date: string; produced: number; sold: number; used: number }[];
  animals: { cattle_id: number; tag_number: string; name: string | null; kg: number; days: number; avg_per_day: number; income: number }[];
  customers: { customer_id: number; name: string; kg: number; amount: number; due: number; avg_price: number | null }[];
  withdrawal: { cattle_id: number; tag_number: string; name: string | null; until: string }[];
}

export interface DairyHistory {
  is_milking_type: boolean;
  milking_times: number;
  active_lactation: (Lactation & { total_kg: number; days_milked: number; length_days: number; avg_per_day: number }) | null;
  withdrawal_until: string | null;
  lactations: (Lactation & { total_kg: number; days_milked: number; length_days: number; avg_per_day: number; peak_kg: number | null; peak_date: string | null })[];
  daily: { date: string; kg: number; saleable: boolean }[];
  finance: {
    milk_income: number; total_cost: number; dairy_cost: number; profit: number; milk_profit: number;
    total_kg: number; cost_per_kg: number | null; income_per_kg: number | null;
  };
}

// ── By-products (plan phase 3b) ─────────────────────────────────────────────

export type ByproductTracking = 'per_animal' | 'farm';
export type ByproductUsageType = 'fertilizer' | 'biogas' | 'household' | 'wastage' | 'other';

export interface ByproductUnit {
  id: number;
  name: string;
  symbol: string;
}

export interface Byproduct {
  id: number;
  slug: string | null;
  name: string;
  unit_id: number;
  unit?: ByproductUnit | null;
  tracking: ByproductTracking;
  description: string | null;
  is_active: boolean;
  animal_types?: { id: number; name: string }[];
  records_count?: number;
  sales_count?: number;
  usages_count?: number;
}

export interface ByproductSheetRow {
  cattle_id: number;
  tag_number: string;
  name: string | null;
  gender: CattleGender;
  shed: string | null;
  quantity: number | null;
  last_date: string | null;
}

export interface ByproductSale {
  id: number;
  byproduct_id: number;
  byproduct?: { id: number; name: string; tracking: ByproductTracking } | null;
  sale_date: string;
  customer_id: number | null;
  customer?: { id: number; name: string; company_name: string | null } | null;
  buyer_name: string | null;
  unit_id: number;
  unit?: ByproductUnit | null;
  quantity: string;
  rate: string;
  amount: string;
  period_from: string | null;
  period_to: string | null;
  payment_status: 'paid' | 'partial' | 'unpaid';
  paid_amount: string;
  due_amount: string;
  payment_account_id: number | null;
  payment_account?: { id: number; name: string } | null;
  notes: string | null;
  allocations_count?: number;
}

export interface ByproductUsage {
  id: number;
  byproduct_id: number;
  byproduct?: { id: number; name: string } | null;
  usage_date: string;
  type: ByproductUsageType;
  unit_id: number;
  unit?: ByproductUnit | null;
  quantity: string;
  notes: string | null;
}

export interface ByproductSummary {
  period: { from: string; to: string };
  totals: { revenue: number; due: number; farm_revenue: number; animal_revenue: number; sales_count: number; usages_count: number };
  products: {
    id: number;
    name: string;
    tracking: ByproductTracking;
    is_active: boolean;
    unit: ByproductUnit | null;
    animal_types: { id: number; name: string }[];
    revenue: number;
    due: number;
    sales_count: number;
    sold: { unit_id: number; unit: string | null; quantity: number }[];
    used: { unit_id: number; unit: string | null; quantity: number }[];
    used_by_type: Partial<Record<ByproductUsageType, number>>;
    produced: number | null;
    stock: number | null;
    animals: { cattle_id: number; tag_number: string; name: string | null; quantity: number; income: number }[];
  }[];
  customers: { customer_id: number; name: string; amount: number; due: number; count: number }[];
}

export interface ByproductHistory {
  total_income: number;
  products: {
    id: number;
    name: string;
    unit: string | null;
    total_quantity: number;
    income: number;
    income_per_unit: number | null;
    records: { id: number; date: string; quantity: number; notes: string | null }[];
  }[];
}

// ── Profit centers (plan phase 4) ───────────────────────────────────────────

export type ProfitCenter = 'fattening' | 'breeding' | 'dairy';

export interface ProfitCenterColumn {
  income: number;
  income_lines: Record<string, number>;
  running_cost: number;
  cost_lines: Record<string, number>;
  cost_of_sold: number;
  profit: number;
  capital_added: number;
  animals_sold: number;
  active_animals: number;
}

export interface ProfitCenterReport {
  period: { from: string; to: string };
  centers: Record<ProfitCenter, ProfitCenterColumn>;
  general: { income: number; income_lines: Record<string, number>; cost: number; cost_lines: Record<string, number>; profit: number } | null;
  total: { income: number; running_cost: number; cost_of_sold: number; profit: number };
  months: ({ month: string } & Record<ProfitCenter, number>)[];
}

/** GET /farm/dashboard/charts */
export interface FarmDashboardCharts {
  monthly: { month: string; income: number; cost: number; profit: number }[];
  cost_split: { type: string; amount: number }[];
  herd: {
    total: number;
    by_species: { name: string; count: number }[];
    by_center: Record<'fattening' | 'breeding' | 'dairy', number>;
  };
  milk_daily: { date: string; kg: number }[];
}
