# Unit Test — Model SesiBooking

**File test**: `__tests__/unit/models/sesiBookingModel.test.js`  
**Yang diuji**: Kalkulasi otomatis `durasiMenit` dari selisih `waktuMulai` dan `waktuSelesai`.

---

## Setup

```js
const mongoose = require("mongoose");
const SesiBooking = require("../../../models/sesiBookingModel");

const baseSesi = (overrides = {}) => ({
  tenantID: new mongoose.Types.ObjectId(),
  dataPengguna: new mongoose.Types.ObjectId(),
  dataPelanggan: new mongoose.Types.ObjectId(),
  dataAset: new mongoose.Types.ObjectId(),
  dataPenjualan: new mongoose.Types.ObjectId(),
  dataTarif: new mongoose.Types.ObjectId(),
  waktuMulai: new Date("2026-03-24T10:00:00Z"),
  waktuSelesai: new Date("2026-03-24T11:30:00Z"),
  ...overrides,
});
```

---

## Skenario

### ✅ A: Durasi 90 menit dihitung otomatis (1.5 jam)

```js
test("A: durasiMenit 90 dari selisih waktu 1.5 jam", async () => {
  const sesi = new SesiBooking(baseSesi());
  await sesi.save();
  expect(sesi.durasiMenit).toBe(90);
});
```

### ✅ B: Durasi tepat 2 jam = 120 menit

```js
test("B: durasiMenit 120 dari selisih waktu 2 jam", async () => {
  const sesi = new SesiBooking(baseSesi({
    waktuMulai: new Date("2026-03-24T14:00:00Z"),
    waktuSelesai: new Date("2026-03-24T16:00:00Z"),
  }));
  await sesi.save();
  expect(sesi.durasiMenit).toBe(120);
});
```

### ✅ C: Durasi 30 menit (minimum booking)

```js
test("C: durasiMenit 30 dari selisih waktu 30 menit", async () => {
  const sesi = new SesiBooking(baseSesi({
    waktuMulai: new Date("2026-03-24T09:00:00Z"),
    waktuSelesai: new Date("2026-03-24T09:30:00Z"),
  }));
  await sesi.save();
  expect(sesi.durasiMenit).toBe(30);
});
```

### ⚠️ D: `waktuSelesai` sebelum `waktuMulai` → throw atau `durasiMenit` ≤ 0

```js
test("D: waktuSelesai sebelum waktuMulai → error atau durasiMenit invalid", async () => {
  const sesi = new SesiBooking(baseSesi({
    waktuMulai: new Date("2026-03-24T16:00:00Z"),
    waktuSelesai: new Date("2026-03-24T14:00:00Z"),
  }));
  try {
    await sesi.save();
    expect(sesi.durasiMenit).toBeLessThanOrEqual(0);
  } catch (err) {
    expect(err).toBeDefined();
  }
});
```
