# Unit Test — Model Tarif

**File test**: `__tests__/unit/models/tarifModel.test.js`  
**Yang diuji**: Enum `basisPerhitungan`, constraint `harga >= 0` dan `durasiMinimum >= 1`, default values (`isDefault`, `jamMulai`, `jamSelesai`), dan unique index `namaTarif` per tenant.

---

## Setup

```js
const mongoose = require("mongoose");
const Tarif = require("../../../models/tarifModel");

const baseTarif = (overrides = {}) => ({
  namaTarif: "Tarif Normal",
  basisPerhitungan: "per jam",
  harga: 30000,
  durasiMinimum: 30,
  tenantID: new mongoose.Types.ObjectId(),
  ...overrides,
});
```

---

## Skenario

### ✅ A: Tarif valid harus lolos validasi

```js
test("A: tarif valid harus lolos validasi", async () => {
  const t = new Tarif(baseTarif());
  await expect(t.validate()).resolves.toBeUndefined();
});
```

### ❌ B: `basisPerhitungan` enum hanya `per jam` atau `per sesi`

```js
test("B: basisPerhitungan selain enum harus ditolak", async () => {
  const t = new Tarif(baseTarif({ basisPerhitungan: "per menit" }));
  await expect(t.validate()).rejects.toThrow();
});
```

### ❌ C: `harga` tidak boleh negatif

```js
test("C: harga negatif harus ditolak", async () => {
  const t = new Tarif(baseTarif({ harga: -1000 }));
  await expect(t.validate()).rejects.toThrow();
});
```

### ❌ D: `durasiMinimum` tidak boleh kurang dari 1

```js
test("D: durasiMinimum 0 harus ditolak", async () => {
  const t = new Tarif(baseTarif({ durasiMinimum: 0 }));
  await expect(t.validate()).rejects.toThrow();
});
```

### ✅ E: `isDefault` default adalah `false`

```js
test("E: isDefault default false", async () => {
  const t = new Tarif(baseTarif());
  await t.validate();
  expect(t.isDefault).toBe(false);
});
```

### ✅ F: `jamMulai` dan `jamSelesai` memiliki default yang sesuai

```js
test("F: jamMulai default 00:00 dan jamSelesai default 23:59", async () => {
  const t = new Tarif(baseTarif());
  await t.validate();
  expect(t.jamMulai).toBe("00:00");
  expect(t.jamSelesai).toBe("23:59");
});
```

### ❌ G: Duplikat `namaTarif` dalam satu tenant harus gagal saat `save`

```js
test("G: duplikat namaTarif dalam satu tenant harus gagal", async () => {
  const tid = new mongoose.Types.ObjectId();
  await Tarif.create(baseTarif({ namaTarif: "Tarif Weekend", tenantID: tid }));
  const duplikat = new Tarif(baseTarif({ namaTarif: "Tarif Weekend", tenantID: tid }));
  await expect(duplikat.save()).rejects.toThrow();
});
```
