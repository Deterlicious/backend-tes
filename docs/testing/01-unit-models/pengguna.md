# Unit Test — Model Pengguna

**File test**: `__tests__/unit/models/penggunaModel.test.js`  
**Yang diuji**: Hook `pre('save')` untuk bcrypt PIN hashing, method `comparePin()`, dan validasi field wajib.

---

## Setup

```js
const mongoose = require("mongoose");
const Pengguna = require("../../../models/penggunaModel");

const basePengguna = (overrides = {}) => ({
  nama: "Kasir Test",
  pin: "123456",
  roleID: new mongoose.Types.ObjectId(),
  tenantID: new mongoose.Types.ObjectId(),
  ...overrides,
});
```

---

## Skenario

### ✅ A: PIN harus di-hash bcrypt sebelum disimpan

```js
test("A: PIN harus di-hash bcrypt sebelum disimpan", async () => {
  const p = new Pengguna(basePengguna());
  await p.save();
  expect(p.pin).not.toBe("123456");
  expect(p.pin).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
});
```

### ✅ B: `comparePin` return `true` untuk PIN yang benar

```js
test("B: comparePin return true untuk PIN yang benar", async () => {
  const p = new Pengguna(basePengguna({ pin: "654321" }));
  await p.save();
  const isMatch = await p.comparePin("654321");
  expect(isMatch).toBe(true);
});
```

### ✅ C: `comparePin` return `false` untuk PIN yang salah

```js
test("C: comparePin return false untuk PIN yang salah", async () => {
  const p = new Pengguna(basePengguna({ pin: "654321" }));
  await p.save();
  const isWrong = await p.comparePin("000000");
  expect(isWrong).toBe(false);
});
```

### ❌ D: PIN kosong harus ditolak

```js
test("D: PIN kosong harus ditolak", async () => {
  const p = new Pengguna(basePengguna({ pin: "" }));
  await expect(p.save()).rejects.toThrow();
});
```

### ✅ E: PIN tidak di-hash ulang jika tidak dimodifikasi

```js
test("E: PIN tidak di-re-hash jika field lain yang diupdate", async () => {
  const p = new Pengguna(basePengguna());
  await p.save();
  const hashAwal = p.pin;
  p.nama = "Nama Diupdate";
  await p.save();
  expect(p.pin).toBe(hashAwal); // hash tidak berubah
});
```
