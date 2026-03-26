# Unit Test — Model Pajak

**File test**: `__tests__/unit/models/pajakModel.test.js`  
**Yang diuji**: Required fields (`namaPajak`, `tarifPajak`), enum `modelPerhitungan` (1/2/3), enum `prioritas` (1/2), constraint `tarifPajak >= 0`, dan default values.

---

## Setup

```js
const mongoose = require("mongoose");
const Pajak = require("../../../models/pajakModel");

const basePajak = (overrides = {}) => ({
  tenantID: new mongoose.Types.ObjectId(),
  namaPajak: "PPN 11%",
  tarifPajak: 11,
  modelPerhitungan: 1,
  prioritas: 1,
  ...overrides,
});
```

---

## Skenario

### ✅ A: Pajak valid harus lolos validasi

```js
test("A: pajak valid harus lolos validasi", async () => {
  const p = new Pajak(basePajak());
  await expect(p.validate()).resolves.toBeUndefined();
});
```

### ❌ B: `namaPajak` wajib diisi

```js
test("B: namaPajak wajib diisi", async () => {
  const p = new Pajak(basePajak({ namaPajak: undefined }));
  await expect(p.validate()).rejects.toThrow("Nama pajak wajib diisi.");
});
```

### ❌ C: `tarifPajak` wajib diisi

```js
test("C: tarifPajak wajib diisi", async () => {
  const p = new Pajak(basePajak({ tarifPajak: undefined }));
  await expect(p.validate()).rejects.toThrow("Tarif pajak wajib diisi.");
});
```

### ❌ D: `tarifPajak` tidak boleh negatif

```js
test("D: tarifPajak negatif harus ditolak", async () => {
  const p = new Pajak(basePajak({ tarifPajak: -5 }));
  await expect(p.validate()).rejects.toThrow();
});
```

### ❌ E: `modelPerhitungan` enum hanya 1, 2, atau 3

```js
test("E: modelPerhitungan selain 1/2/3 harus ditolak", async () => {
  const p = new Pajak(basePajak({ modelPerhitungan: 5 }));
  await expect(p.validate()).rejects.toThrow();
});
```

### ❌ F: `prioritas` enum hanya 1 atau 2

```js
test("F: prioritas selain 1/2 harus ditolak", async () => {
  const p = new Pajak(basePajak({ prioritas: 3 }));
  await expect(p.validate()).rejects.toThrow();
});
```

### ✅ G: `tipePajak` default adalah `true` (Per Produk)

```js
test("G: tipePajak default true (Per Produk)", async () => {
  const p = new Pajak(basePajak());
  await p.validate();
  expect(p.tipePajak).toBe(true);
});
```

### ✅ H: `statusPajak` default adalah `true` (Aktif)

```js
test("H: statusPajak default true (Aktif)", async () => {
  const p = new Pajak(basePajak());
  await p.validate();
  expect(p.statusPajak).toBe(true);
});
```
