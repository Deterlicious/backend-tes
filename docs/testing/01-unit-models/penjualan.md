# Unit Test — Model Penjualan

**File test**: `__tests__/unit/models/penjualanModel.test.js`  
**Yang diuji**: Hook `pre('validate')` yang menghitung `totalHargaProduk`, `totalTagihan`, `sisaTagihan`, dan `statusBayar` secara otomatis.

---

## Setup

```js
const mongoose = require("mongoose");
const Penjualan = require("../../../models/penjualanModel");

const baseItem = (namaProduk, hargaJual, jumlah) => ({
  produkID: new mongoose.Types.ObjectId(),
  namaProduk,
  jumlah,
  hargaJual,
  subTotal: hargaJual * jumlah,
  jumlahDiskon: 0,
  total: hargaJual * jumlah,
  jumlahPajak: 0,
  totalharga: hargaJual * jumlah,
});

const basePenjualan = (overrides = {}) => ({
  tenantID: new mongoose.Types.ObjectId(),
  noReferensi: "INV-TEST-001",
  penggunaID: new mongoose.Types.ObjectId(),
  pelangganID: new mongoose.Types.ObjectId(),
  jenisTransaksi: "POS",
  jenisPenjualan: "dine-in",
  tanggalTransaksi: new Date(),
  jumlahDiskonTransaksi: 0,
  jumlahPajakTransaksi: 0,
  totalDibayar: 0,
  ...overrides,
});
```

---

## Skenario

### ✅ A: Transaksi lunas → `statusBayar` PAID, `sisaTagihan` 0

```js
test("A: transaksi lunas → statusBayar PAID, sisaTagihan 0", async () => {
  const p = new Penjualan(basePenjualan({
    itemPenjualan: [baseItem("Es Teh Manis", 8000, 2)],
    totalDibayar: 16000,
  }));
  await p.validate();
  expect(p.totalHargaProduk).toBe(16000);
  expect(p.totalTagihan).toBe(16000);
  expect(p.sisaTagihan).toBe(0);
  expect(p.statusBayar).toBe("PAID");
});
```

### ✅ B: Pembayaran sebagian → `statusBayar` PARTIAL

```js
test("B: pembayaran sebagian → statusBayar PARTIAL", async () => {
  const p = new Penjualan(basePenjualan({
    itemPenjualan: [baseItem("Kopi Susu", 25000, 1)],
    totalDibayar: 10000,
  }));
  await p.validate();
  expect(p.totalTagihan).toBe(25000);
  expect(p.sisaTagihan).toBe(15000);
  expect(p.statusBayar).toBe("PARTIAL");
});
```

### ✅ C: Belum dibayar → `statusBayar` UNPAID

```js
test("C: belum dibayar → statusBayar UNPAID", async () => {
  const p = new Penjualan(basePenjualan({
    itemPenjualan: [baseItem("Nasi Goreng", 30000, 1)],
    totalDibayar: 0,
  }));
  await p.validate();
  expect(p.statusBayar).toBe("UNPAID");
  expect(p.sisaTagihan).toBe(30000);
});
```

### ✅ D: Diskon global memotong `totalTagihan`

```js
test("D: diskon global memotong totalTagihan", async () => {
  const p = new Penjualan(basePenjualan({
    itemPenjualan: [baseItem("Nasi Goreng", 30000, 1)],
    jumlahDiskonTransaksi: 5000,
    totalDibayar: 0,
  }));
  await p.validate();
  expect(p.totalHargaProduk).toBe(30000);
  expect(p.totalTagihan).toBe(25000); // 30000 - 5000
  expect(p.statusBayar).toBe("UNPAID");
});
```

### ✅ E: Pajak transaksi menambah `totalTagihan`

```js
test("E: pajak transaksi menambah totalTagihan", async () => {
  const p = new Penjualan(basePenjualan({
    itemPenjualan: [baseItem("Kopi", 20000, 1)],
    jumlahPajakTransaksi: 2200, // 11% dari 20000
    totalDibayar: 22200,
  }));
  await p.validate();
  expect(p.totalTagihan).toBe(22200);
  expect(p.statusBayar).toBe("PAID");
});
```

### ✅ F: Multiple item → `totalHargaProduk` adalah jumlah semua `totalharga`

```js
test("F: multiple item → totalHargaProduk akumulasi benar", async () => {
  const p = new Penjualan(basePenjualan({
    itemPenjualan: [
      baseItem("Es Teh", 8000, 2),  // 16000
      baseItem("Kopi", 15000, 1),   // 15000
    ],
    totalDibayar: 31000,
  }));
  await p.validate();
  expect(p.totalHargaProduk).toBe(31000);
  expect(p.totalTagihan).toBe(31000);
  expect(p.statusBayar).toBe("PAID");
});
```
