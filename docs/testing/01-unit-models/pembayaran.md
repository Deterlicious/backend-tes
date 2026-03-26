# Unit Test — Model Pembayaran

**File test**: `__tests__/unit/models/pembayaranModel.test.js`  
**Yang diuji**: Hook `pre('validate')` yang memvalidasi `tanggalBayar` wajib ada jika `status === 'PAID'`, serta validasi enum dan constraint numerik.

---

## Setup

```js
const mongoose = require("mongoose");
const Pembayaran = require("../../../models/pembayaranModel");

const basePembayaran = (overrides = {}) => ({
  tenantID: new mongoose.Types.ObjectId(),
  akunKasID: new mongoose.Types.ObjectId(),
  penjualanID: new mongoose.Types.ObjectId(),
  metodePembayaranID: new mongoose.Types.ObjectId(),
  noReferensi: "PAY-001",
  jumlahBayar: 50000,
  status: "PENDING",
  ...overrides,
});
```

---

## Skenario

### ❌ A: Status `PAID` tanpa `tanggalBayar` → `ValidationError`

```js
test("A: status PAID tanpa tanggalBayar harus throw ValidationError", async () => {
  const p = new Pembayaran(basePembayaran({
    status: "PAID",
    tanggalBayar: null,
  }));
  await expect(p.validate()).rejects.toThrow(
    "Tanggal bayar wajib diisi jika status PAID"
  );
});
```

### ✅ B: Status `PAID` dengan `tanggalBayar` harus lolos

```js
test("B: status PAID dengan tanggalBayar harus lolos validasi", async () => {
  const p = new Pembayaran(basePembayaran({
    status: "PAID",
    tanggalBayar: new Date(),
  }));
  await expect(p.validate()).resolves.toBeUndefined();
});
```

### ✅ C: Status `PENDING` tanpa `tanggalBayar` harus lolos

```js
test("C: status PENDING tanpa tanggalBayar harus lolos", async () => {
  const p = new Pembayaran(basePembayaran({
    status: "PENDING",
    tanggalBayar: null,
  }));
  await expect(p.validate()).resolves.toBeUndefined();
});
```

### ❌ D: `jumlahBayar` negatif harus ditolak

```js
test("D: jumlahBayar negatif harus ditolak", async () => {
  const p = new Pembayaran(basePembayaran({ jumlahBayar: -1000 }));
  await expect(p.validate()).rejects.toThrow();
});
```

### ❌ E: `status` di luar enum harus ditolak

```js
test("E: status selain PAID/PENDING/EXPIRED/FAILED harus ditolak", async () => {
  const p = new Pembayaran(basePembayaran({ status: "SELESAI" }));
  await expect(p.validate()).rejects.toThrow();
});
```

### ✅ F: `status` default adalah `PENDING`

```js
test("F: status default adalah PENDING", async () => {
  const p = new Pembayaran(basePembayaran());
  await p.validate();
  expect(p.status).toBe("PENDING");
});
```
