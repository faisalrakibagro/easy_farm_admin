# Medicine Usage — Runtime Bug Fix

## Bug

**Error:** `RuntimeError: medsData?.find is not a function`  
**Route:** `/farm/medicine/usage`  
**Cause:** `useQuery` for the medicine list (`['medicines-all']`) returned a value that was not a JavaScript `Array` at render time (either stale cached data with a different shape, or the response body wasn't fully unwrapped before React Query first hydrated the component). Because optional chaining `?.` only short-circuits on `null`/`undefined` — not on plain objects — calling `.find()` on a non-array but defined value throws the TypeError.

---

## Fix

**File:** `app/(dashboard)/farm/medicine/usage/page.tsx`

### 1. Explicit generic on `useQuery`

Added `<MedicineWithFifo[]>` so TypeScript knows the expected shape and can flag future mismatches at compile time.

```diff
- const { data: medsData } = useQuery({
+ const { data: medsData } = useQuery<MedicineWithFifo[]>({
```

### 2. Null-safe extraction in `queryFn`

Changed the query function from an inline expression to a block with an explicit fallback:

```diff
- queryFn: async () => (await api.get('/farm/medicine/all')).data.medicines as MedicineWithFifo[],
+ queryFn: async () => {
+   const res = await api.get('/farm/medicine/all');
+   return (res.data?.medicines ?? []) as MedicineWithFifo[];
+ },
```

`res.data?.medicines ?? []` guarantees an array is returned even if the API response body is shaped differently (e.g. `undefined` or missing key).

### 3. Runtime array guard (`meds` constant)

Added a defensive local constant that is always an array, regardless of what the React Query cache holds:

```typescript
const meds: MedicineWithFifo[] = Array.isArray(medsData) ? medsData : [];
```

### 4. Replaced all `medsData?.` usages with `meds.`

| Location | Before | After |
|----------|--------|-------|
| `selectedMed` (line ~121) | `medsData?.find(...)` | `meds.find(...)` |
| Filter dropdown (line ~198) | `medsData?.map(...)` | `meds.map(...)` |
| Create modal select (line ~357) | `medsData?.map(...)` | `meds.map(...)` |

---

## Why this pattern is safer

| Pattern | Risk |
|---------|------|
| `medsData?.find(...)` | Crashes if `medsData` is defined but not an array (e.g. `{}`, stale cache object) |
| `meds.find(...)` where `meds = Array.isArray(medsData) ? medsData : []` | Always safe — worst case is an empty list |
