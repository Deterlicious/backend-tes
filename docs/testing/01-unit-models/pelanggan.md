# Unit Test — Model Pelanggan

**File test**: `__tests__/unit/models/pelangganModel.test.js`  
**Yang diuji**: Enum `tipePelanggan`, unique index per tenant untuk `namaPelanggan` & `nomorHp` & `email`, partial index behavior (field opsional tidak trigger constraint jika kosong), dan default values.

---

## Setup

```js
const mongoose = require("mongoose");
const Pelanggan = require("../../../models/pelangganModel");

const tid = new mongoose.Types.ObjectId(); // satu tenant untuk semua test dalam describe

const basePelanggan = (overrides = {}) => ({
  namaPelanggan: "Budi Santoso",
  tipePelanggan: "umum",
  tenantID: tid,
  ...overrides,
});
```

---

## Skenario

### ✅ A: Pelanggan valid harus lolos validasi

```js
test("A: pelanggan valid harus lolos validasi", async () => {
  const p = new Pelanggan(basePelanggan());
  await expect(p.validate()).resolves.toBeUndefined();
});
```

### ❌ B: `tipePelanggan` enum hanya `umum | korporat | member`

```js
test("B: tipePelanggan selain enum harus ditolak", async () => {
  const p = new Pelanggan(basePelanggan({ tipePelanggan: "vip" }));
  await expect(p.validate()).rejects.toThrow();
});
```

### ❌ C: `namaPelanggan` wajib diisi

```js
test("C: namaPelanggan wajib diisi", async () => {
  const p = new Pelanggan(basePelanggan({ namaPelanggan: undefined }));
  await expect(p.validate()).rejects.toThrow();
});
```

### ❌ D: Duplikat `namaPelanggan` dalam satu tenant harus gagal saat `save`

```js
test("D: duplikat namaPelanggan dalam satu tenant harus gagal", async () => {
  await Pelanggan.create(basePelanggan({ namaPelanggan: "Andi" }));
  const duplikat = new Pelanggan(basePelanggan({ namaPelanggan: "Andi" }));
  await expect(duplikat.save()).rejects.toThrow(); // MongoServerError: duplicate key
});
```

### ✅ E: Nama sama di tenant berbeda harus lolos

```js
test("E: namaPelanggan sama di tenant lain harus lolos", async () => {
  const tenant2 = new mongoose.Types.ObjectId();
  await Pelanggan.create(basePelanggan({ namaPelanggan: "Siti" }));
  const p2 = new Pelanggan(basePelanggan({ namaPelanggan: "Siti", tenantID: tenant2 }));
  await expect(p2.save()).resolves.toBeDefined();
});
```

### ✅ F: Dua pelanggan tanpa `nomorHp` tidak trigger unique constraint

```js
test("F: dua pelanggan tanpa nomorHp tidak konflik (partial index)", async () => {
  await Pelanggan.create(basePelanggan({ namaPelanggan: "P1" }));
  const p2 = new Pelanggan(basePelanggan({ namaPelanggan: "P2" }));
  await expect(p2.save()).resolves.toBeDefined();
});
```

### ❌ G: Duplikat `nomorHp` dalam satu tenant harus gagal

```js
test("G: duplikat nomorHp dalam satu tenant harus gagal", async () => {
  await Pelanggan.create(basePelanggan({ namaPelanggan: "C", nomorHp: "08110000001" }));
  const p2 = new Pelanggan(basePelanggan({ namaPelanggan: "D", nomorHp: "08110000001" }));
  await expect(p2.save()).rejects.toThrow();
});
```

### ✅ H: `saldoPiutang` dan `poinLoyalitas` default `0`

```js
test("H: saldoPiutang dan poinLoyalitas default 0", async () => {
  const p = new Pelanggan(basePelanggan());
  await p.validate();
  expect(p.saldoPiutang).toBe(0);
  expect(p.poinLoyalitas).toBe(0);
});
```
