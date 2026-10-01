# Medicine Inventory — Low Stock Alert Required

## Summary

The **Low Stock Alert Qty** field is now **required** when adding a new medicine. A medicine cannot be saved without providing a threshold quantity greater than 0.

---

## Changes Made

### Backend — `Farm-Management-Api`

**File:** `app/Http/Controllers/Api/Farm/MedicineController.php` — `store()` method

| Before | After |
|--------|-------|
| `low_stock_alert` was `nullable\|numeric\|min:0` | `low_stock_alert` is `required\|numeric\|min:0.01` |

Custom validation messages added:
- `low_stock_alert.required` → `"Low stock alert quantity is required. Please enter a threshold quantity."`
- `low_stock_alert.numeric` → `"Low stock alert must be a valid number."`
- `low_stock_alert.min` → `"Low stock alert must be greater than 0."`

> **Note:** The `update()` method keeps `low_stock_alert` as nullable — editing an existing medicine does not re-enforce this requirement.

---

### Frontend — `Farm-Management-Admin`

#### 1. Schema — `lib/schemas/medicine.schema.ts`

- Added `required: true` to the `low_stock_alert` field (shows red `*` in the form label).
- Changed `min` from `0` to `0.01`.
- Added `hintKey: 'medicine:inventory.field.low_stock_alert_hint'` so a helper hint appears below the input.

#### 2. Inventory Page — `app/(dashboard)/farm/medicine/inventory/page.tsx`

- `DEFAULT_MED.low_stock_alert` changed from `'0'` to `''` — field now starts empty, forcing the user to fill it.
- Added `fieldErrors` state (`Record<string, string>`) to track per-field validation errors.
- `openCreate` and `openEdit` both call `setFieldErrors({})` to clear stale errors on modal open.
- `handleSubmit` (create flow only) validates `low_stock_alert` before the API call:
  - If the value is empty, `NaN`, or `<= 0` → sets `fieldErrors.low_stock_alert` with the translated message and returns early (no API call is made).
- `fieldErrors` is now passed to `<DynamicForm>` so the error appears inline below the field.

#### 3. Locales

**English** — `locales/en/medicine.json`
```json
"field": {
  "low_stock_alert": "Low Stock Alert Qty *",
  "low_stock_alert_hint": "Required — alert triggers when stock falls below this quantity."
},
"validation": {
  "low_stock_alert_required": "Low stock alert quantity is required. Please enter a threshold greater than 0."
}
```

**Bengali** — `locales/bn/medicine.json`
```json
"field": {
  "low_stock_alert": "কম স্টক সতর্কতার পরিমাণ *",
  "low_stock_alert_hint": "আবশ্যক — স্টক এই পরিমাণের নিচে নামলে সতর্কতা দেখাবে।"
},
"validation": {
  "low_stock_alert_required": "কম স্টক সতর্কতার পরিমাণ আবশ্যক। ০-এর বেশি একটি সীমা লিখুন।"
}
```

---

## Validation Flow

```
User clicks "Add Medicine"
        │
        ▼
   Fill form fields
        │
        ▼
  Click "Add" button
        │
        ▼
  Frontend validation
  (low_stock_alert > 0?)
     │         │
    YES        NO ──► Show inline field error
     │                "Low stock alert quantity is required..."
     ▼                (no API call is made)
  POST /farm/medicine
        │
        ▼
  API validation
  (required|numeric|min:0.01)
     │         │
    PASS      FAIL ──► 422 JSON response with message
     │                "Low stock alert quantity is required.
     ▼                 Please enter a threshold quantity."
  Medicine created ✓
```
