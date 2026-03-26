# Unit Test — Model Diskon

**File test**: `__tests__/unit/models/diskonModel.test.js`  
**Yang diuji**: Custom validator `nilai` (persen ≤ 100), enum `cakupan` & `tipe`, default `status`.

---

## Setup

```js
const mongoose = require("mongoose");
const Diskon = require("../../../models/diskonModel");

const baseDiskon = (overrides = {}) => ({
  tenantID: new mongoose.Types.ObjectId(),
  namaDiskon: "Promo Test",
  cakupan: "Item",
  tipe: "nominal",
  nilai: 5000,
  ...overrides,
});
```

---

## Skenario

### ❌ A: Diskon persen > 100 harus throw `ValidationError`

```js
test("A: diskon persen > 100 harus throw ValidationError", async () => {
  const d = new Diskon(baseDiskon({ tipe: "persen", nilai: 150 }));
  await expect(d.validate()).rejects.toThrow(
    "Diskon bertipe persen tidak boleh melebihi 100"
  );
});
```

### ✅ B: Diskon persen tepat 100 harus lolos

```js
test("B: diskon persen tepat 100 harus lolos", async () => {
  const d = new Diskon(baseDiskon({ tipe: "persen", nilai: 100 }));
  await expect(d.validate()).resolves.toBeUndefined();
});
```

### ✅ C: Diskon nominal berapapun harus lolos

```js
test("C: diskon nominal berapapun harus lolos", async () => {
  const d = new Diskon(baseDiskon({ tipe: "nominal", nilai: 500000 }));
  await expect(d.validate()).resolves.toBeUndefined();
});
```

### ❌ D: Nilai negatif harus ditolak

```js
test("D: nilai negatif harus ditolak", async () => {
  const d = new Diskon(baseDiskon({ nilai: -100 }));
  await expect(d.validate()).rejects.toThrow();
});
```

### ❌ E: Enum `cakupan` hanya `Global` atau `Item`

```js
test("E: cakupan selain Global/Item harus ditolak", async () => {
  const d = new Diskon(baseDiskon({ cakupan: "Semua" }));
  await expect(d.validate()).rejects.toThrow();
});
```

### ✅ F: `status` default adalah `Aktif`

```js
test("F: status default adalah Aktif", async () => {
  const d = new Diskon(baseDiskon());
  await d.validate();
  expect(d.status).toBe("Aktif");
});
```
