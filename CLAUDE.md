@AGENTS.md

# Dashboard Section Access Control (2026-06-23)

## 7 Controllable Dashboard Sections

Super Admin controls which roles see each section via **User Management → Dashboard Sections** (`/settings/dashboard-sections`).

| Section | Permission Key |
|---------|---------------|
| Quick Access | `dashboard-sections.quick-access` |
| Animals | `dashboard-sections.animals` |
| Financials | `dashboard-sections.financials` |
| Total Expenses | `dashboard-sections.expenses` |
| Today's Costs | `dashboard-sections.todays-costs` |
| Upcoming Vaccines | `dashboard-sections.vaccines` |
| Alerts | `dashboard-sections.alerts` |
| Top Cattle (sub) | `dashboard-sections.top-cattle` |
| Projected Profit (sub) | `dashboard-sections.projected-profit` |

**Logic in `dashboard/page.tsx`:**
- Super Admin always sees everything (no permission check, `isSuperAdmin` bypasses all)
- All other roles: checked via `hasPermission('dashboard-sections.X')`
- Uses `can()` helper: `const can = (perm) => isSuperAdmin || hasPermission(perm)`

**Settings Page: `app/(dashboard)/settings/dashboard-sections/page.tsx`**
- Role × Section matrix table
- Calls `GET /roles` to load roles + their permissions
- Auto-saves on toggle via `PUT /roles/{id}` with full updated permission list
- Super Admin column locked (always enabled)
- Uses `settings` namespace: `dashboard_sections.*` keys
- Uses `dashboard` namespace: `section.*` keys for section labels

**Default role assignments (from seeder):**
- Super Admin: all sections
- Admin: all except `projected-profit`
- Manager: all except `projected-profit`
- Editor: quick-access, animals, todays-costs, vaccines, alerts
- User: quick-access, animals, vaccines, alerts

**Sidebar:** "Dashboard Sections" added under "User Management" with `permission: 'roles.edit'`
**Permission changes require re-login to take effect** (noted in UI with amber info box)

---

# Cattle Module — Required Fields (LOCKED)

## Locked: 2026-06-21

The following fields are **required** in both the form UI and the API for cattle create/edit.
Do NOT revert these to optional/nullable.

### Frontend: `app/(dashboard)/farm/cattle/page.tsx`

| Field | Key | Status |
|---|---|---|
| পশুর ধরন | `animal_type_id` | required + `<Req />` + red-border error |
| জন্ম তারিখ | `birth_date` | **OPTIONAL** — 2026-06-27 থেকে optional, age_stage_id দিয়ে replace |
| কয় দাঁত | `age_stage_id` | optional — animal_type_id change হলে reset |
| বয়সের ক্যাটাগরি | `age_category_id` | optional — animal_type_id change হলে reset |
| শেড | `shed_id` | required + `<Req />` + red-border error |
| যে হিসাব থেকে পরিশোধ | `payment_account_id` | required + `<Req />` (create only) + red-border error |

**Update 2026-09-24 (breeding phase 1):** the form now has an origin switch — `purchased` (কেনা) / `farm_born` (খামারে জন্ম).
- `purchased`: every rule above is unchanged — purchase date/price/weight and `payment_account_id` stay required.
- `farm_born`: no purchase exists, so purchase date/price/weight, seller and `payment_account_id` are hidden and not sent; `birth_date` is required and either `birth_weight` or `current_weight` must be given. No purchase ledger line is booked.
- New optional fields for both: `purpose`, `dam_id` (mother), `sire_id` (father); females also `reproductive_status` and `milking_times`. The API (`StoreCattleRequest`) enforces the same conditional rules.

- Default placeholder for shed select: `field.select_shed`
- Default placeholder for account select: `field.select_account`
- Translation keys `select_shed` and `select_account` added to both `locales/en/cattle.json` and `locales/bn/cattle.json`

### Backend: `Farm-Management-Api/app/Http/Controllers/Api/Farm/CattleController.php`

**store() validation:**
- `birth_date` → `['required', 'date']`
- `animal_type_id` → `['required', 'exists:animal_types,id']`
- `shed_id` → `['required', 'exists:sheds,id']`
- `payment_account_id` → `['required', 'exists:accounting_payment_accounts,id']`

**update() validation:**
- `birth_date` → `['required', 'date']`
- `animal_type_id` → `['required', 'exists:animal_types,id']`
- `shed_id` → `['required', 'exists:sheds,id']`
- `payment_account_id` — NOT in update (field not shown on edit form)

---

## Auto Tag Number — পশু নিবন্ধন ফর্ম (LOCKED: 2026-06-21)

### ট্যাগ ফরম্যাট
```
TAG-{YYYY}-{NNNN}
উদাহরণ: TAG-2026-0001, TAG-2026-0002
```
- `YYYY` = চলতি বছর
- `NNNN` = ৪ সংখ্যার zero-padded সিরিয়াল (deleted সহ মোট count + 1)
- Uniqueness loop দিয়ে নিশ্চিত করা হয় conflict না হলে

### Backend
**File:** `Farm-Management-Api/app/Http/Controllers/Api/Farm/CattleController.php`

```php
public function nextTag(): JsonResponse
// Cattle::withTrashed()->count() + 1 থেকে শুরু করে unique tag জেনারেট করে
```

**Route:** `GET /api/v1/farm/cattle/next-tag`  
**File:** `Farm-Management-Api/routes/api.php` — `{cattle}` wildcard route-এর আগে registered (no permission middleware — create permission page থেকে call হয়)

### Frontend
**File:** `app/(dashboard)/farm/cattle/page.tsx`

- `openCreate()` async → modal খোলার পরপরই `/farm/cattle/next-tag` API call করে
- `tagLoading` state: loading চলাকালে input-এ `...` pulse indicator দেখায়
- API সফল হলে `tag_number` field auto-fill হয়
- **ইউজার যেকোনো সময় field edit করে custom tag দিতে পারবে** (field disabled নয়)
- API fail হলে silently ignore — ইউজার manually টাইপ করবে
- Edit mode-এ tag_number field disabled থাকে (অপরিবর্তিত)

### Translation Keys (নতুন)
| Key | EN | BN |
|---|---|---|
| `field.tag_generating` | Generating tag... | ট্যাগ তৈরি হচ্ছে... |
| `field.tag_auto_hint` | Auto-generated. You can change it to a custom tag. | স্বয়ংক্রিয়ভাবে তৈরি। চাইলে কাস্টম ট্যাগ দিতে পারবেন। |

---

## Payment Account — Required Fields (LOCKED: 2026-06-22)

### `/farm/expenses`
**Frontend:** `app/(dashboard)/farm/expenses/page.tsx`
- `payment_account_id` → required validation + label-এ `*` + red-border error message

**Backend:** `Farm-Management-Api/app/Http/Controllers/Api/Farm/ExpenseController.php`
- `store()`: `payment_account_id` → `['required', 'exists:accounting_payment_accounts,id']`

---

### `/farm/sales`
**Frontend:** `app/(dashboard)/farm/sales/page.tsx`
- `payment_account_id` → required in `validateSale()` + label-এ `*` + red-border error message

**Backend:** `Farm-Management-Api/app/Http/Controllers/Api/Farm/CattleSaleController.php`
- `store()`: `payment_account_id` → `['required', 'exists:accounting_payment_accounts,id']`

---

## Default Payment Account — Auto-select (LOCKED: 2026-06-22)

`AccountingPaymentAccount` model-এ `is_default` boolean field আছে। API `/accounting/payment-accounts` response-এ `is_default` আসে।

### `/farm/expenses`
**File:** `app/(dashboard)/farm/expenses/page.tsx`
```ts
const defaultAccountId = paymentAccountsData?.payment_accounts.find(p => p.is_default)?.id?.toString() ?? '';
```
- `openCreate()` → `{ ...DEFAULT, payment_account_id: defaultAccountId }` দিয়ে form initialize হয়
- `is_default: boolean` canonical `AccountingPaymentAccount` type-এ (`types/index.ts`) আছে — এই পেজ সেটা `@/types` থেকে import করে (B7-এ local `PaymentAccount` interface সরিয়ে canonical type-এ migrate করা হয়েছে)

### `/farm/labour/daily`
**File:** `app/(dashboard)/farm/labour/daily/page.tsx`
```ts
const defaultAccountId = paymentAccountsData?.payment_accounts.find(p => p.is_default)?.id?.toString() ?? '';
```
- `openModal()` → `{ ...EMPTY_FORM, payment_account_id: defaultAccountId }` দিয়ে form initialize হয়
- `useEffect` → page load-এ `markPaidAccountId` state-ও default account দিয়ে set হয়
- `is_default: boolean` canonical `AccountingPaymentAccount` type-এ (`types/index.ts`) আছে — এই পেজ সেটা `@/types` থেকে import করে (B7-এ local `PaymentAccount` interface সরিয়ে canonical type-এ migrate করা হয়েছে)
- `useEffect` import যোগ আছে

---

## Feed Modal Flow — Animal Type → Age Category → Items (LOCKED: 2026-06-27)

### নিয়ম (উভয় পেজে — Daily Feeding ও Formulations)
মোডাল খুললে ইউজারকে **প্রথমে পশুর ধরন** সিলেক্ট করতে হবে, **তারপর বয়সের ক্যাটাগরি** (পশুর ধরনের উপর ভিত্তি করে ডাইনামিক্যালি লোড), **তারপর ফিড আইটেম**।

### `/farm/feed/daily` — Record Daily Feeding
**Frontend:** `app/(dashboard)\farm\feed\daily\page.tsx`

**Form State:**
```ts
{ usage_date, animal_type_id, age_category_id, allocation_method, selected_formulation_id, notes }
// REMOVED: age_category (enum 'all'|'immature'|'adult')
```

**Modal Form Order:**
1. তারিখ + Allocation Method
2. পশুর ধরন (required — animal_type_id)
3. বয়সের ক্যাটাগরি (disabled with "আগে পশুর ধরন সিলেক্ট করুন" if no animal type)
4. ফর্মুলেশন picker (optional, loads after animal type selected)
5. Feed Items

**Queries:**
- `['animal-types-list']` → GET `/farm/animal-types/all`
- `['age-categories-modal', form.animal_type_id]` → GET `/farm/animal-age-categories/by-type/{id}` — enabled when `showModal && !!form.animal_type_id`
- `['age-categories-filter', filterAnimalTypeId]` → same endpoint for list filter
- Formulations: filtered by `animal_type_id` + `age_category_id` params

**List Filter:** animal_type_id dropdown → age_category_id dropdown (cascading) + "ফিল্টার মুছুন" button

**Backend:** `FeedUsageController` — store/update validation:
- `animal_type_id` → `['required', 'exists:animal_types,id']`
- `age_category_id` → `['nullable', 'exists:animal_age_categories,id']`
- `index()` filters: `animal_type_id` + `age_category_id`
- `index()` loads: `with(['animalType:id,name', 'ageCategory:id,name', ...])`

**FeedAllocationService:** cattle query filtered by `animal_type_id` AND `age_category_id`

**Database:** `feed_usages` table has `animal_type_id` FK (nullable) + `age_category_id` FK (nullable)

### `/farm/feed/formulations` — Feed Formulations
**Frontend:** `app/(dashboard)\farm\feed\formulations\page.tsx`

**Form State:**
```ts
{ name, animal_type_id, age_category_id, notes, is_active, items }
// REMOVED: age_category (enum) replaced with age_category_id
```

**Modal Form Order:**
1. নাম
2. পশুর ধরন (animal_type_id — optional, changing resets age_category_id)
3. বয়সের ক্যাটাগরি (disabled with message if no animal type selected)
4. উপাদান (feed items)
5. Active checkbox
6. Notes

**Query key:** `['age-categories-formulation-modal', form.animal_type_id]`

**Table display:** `f.ageCategory?.name` with amber badge (no hardcoded immature/adult colors)

**Backend:** `FeedFormulationController` loads `ageCategory` in all `with()` clauses

### Types (LOCKED: 2026-06-27)
**`types/index.ts`:**
- `AnimalAgeCategory { id, animal_type_id, name, sort_order, is_active }` — new interface
- `AnimalAgeStage { id, animal_type_id, name, sort_order, is_active }` — new interface
- `Cattle`: `age_category` (enum) → `age_stage_id: number|null` + `age_category_id: number|null` + `ageStage?` + `ageCategory?`
- `FeedUsage`: `age_category` (enum) → `animal_type_id: number|null` + `age_category_id: number|null` + `animalType?` + `ageCategory?`
- `FeedFormulation`: `age_category` (enum) → `age_category_id: number|null` + `ageCategory?`

---

## Expense Categories — Salary & Labour (LOCKED: 2026-06-22)

### Backend
**File:** `Farm-Management-Api/app/Http/Controllers/Api/Farm/ExpenseController.php`
- `store()` ও `update()` উভয়ের `Rule::in([...])` তে `'salary'` ও `'labour'` যোগ আছে

### Frontend
**File:** `app/(dashboard)/farm/expenses/page.tsx`
```ts
const CATEGORIES = ['electricity', 'water', 'fuel', 'transport', 'maintenance', 'rent', 'miscellaneous', 'salary', 'labour'];

const CATEGORY_COLORS = {
  // ...existing...
  salary: 'bg-indigo-100 text-indigo-700',
  labour: 'bg-teal-100 text-teal-700',
};
```
- Summary cards grid: `lg:grid-cols-7` → `lg:grid-cols-9`
- Category dropdown-এ Salary ও Labour অপশন দেখায়
- Expense create করলে অন্য categories-এর মতো active cattle-এ auto-allocate হয়
