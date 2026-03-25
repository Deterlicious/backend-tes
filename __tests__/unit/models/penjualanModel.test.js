const mongoose = require("mongoose");
const Penjualan = require("../../../models/penjualanModel");

// Scenario A (Full payment)
test("harus menghitung totalTagihan dan set statusBayar PAID", async () => {
  const penjualan = new Penjualan({
    tenantID: new mongoose.Types.ObjectId(),
    noReferensi: "INV-001",
    penggunaID: new mongoose.Types.ObjectId(),
    pelangganID: new mongoose.Types.ObjectId(),
    jenisTransaksi: "POS",
    jenisPenjualan: "dine-in",
    tanggalTransaksi: new Date(),
    itemPenjualan: [
      {
        produkID: new mongoose.Types.ObjectId(),
        namaProduk: "Es Teh Manis",
        jumlah: 2,
        hargaJual: 8000,
        subTotal: 16000,
        jumlahDiskon: 0,
        total: 16000,
        jumlahPajak: 0,
        totalharga: 16000,
      },
    ],
    jumlahDiskonTransaksi: 0,
    jumlahPajakTransaksi: 0,
    totalDibayar: 16000,
  });

  await penjualan.validate();

  expect(penjualan.totalHargaProduk).toBe(16000);
  expect(penjualan.totalTagihan).toBe(16000);
  expect(penjualan.sisaTagihan).toBe(0);
  expect(penjualan.statusBayar).toBe("PAID");
});

// Scenario B (Partial payment)
test("harus set statusBayar PARTIAL jika totalDibayar sebagian", async () => {
  const penjualan = new Penjualan({
    tenantID: new mongoose.Types.ObjectId(),
    noReferensi: "INV-002",
    penggunaID: new mongoose.Types.ObjectId(),
    pelangganID: new mongoose.Types.ObjectId(),
    jenisTransaksi: "POS",
    jenisPenjualan: "dine-in",
    tanggalTransaksi: new Date(),
    itemPenjualan: [
      {
        produkID: new mongoose.Types.ObjectId(),
        namaProduk: "Kopi Susu",
        jumlah: 1,
        hargaJual: 25000,
        subTotal: 25000,
        jumlahDiskon: 0,
        total: 25000,
        jumlahPajak: 0,
        totalharga: 25000,
      },
    ],
    jumlahDiskonTransaksi: 0,
    jumlahPajakTransaksi: 0,
    totalDibayar: 10000, // hanya bayar sebagian
  });

  await penjualan.validate();

  expect(penjualan.totalTagihan).toBe(25000);
  expect(penjualan.sisaTagihan).toBe(15000);
  expect(penjualan.statusBayar).toBe("PARTIAL");
});

// Scenario C (Global discount)
test("diskon global harus mengurangi totalTagihan", async () => {
  const penjualan = new Penjualan({
    tenantID: new mongoose.Types.ObjectId(),
    noReferensi: "INV-003",
    penggunaID: new mongoose.Types.ObjectId(),
    pelangganID: new mongoose.Types.ObjectId(),
    jenisTransaksi: "POS",
    jenisPenjualan: "dine-in",
    tanggalTransaksi: new Date(),
    itemPenjualan: [
      {
        produkID: new mongoose.Types.ObjectId(),
        namaProduk: "Nasi Goreng",
        jumlah: 1,
        hargaJual: 30000,
        subTotal: 30000,
        jumlahDiskon: 0,
        total: 30000,
        jumlahPajak: 0,
        totalharga: 30000,
      },
    ],
    jumlahDiskonTransaksi: 5000, // diskon global Rp5.000
    jumlahPajakTransaksi: 0,
    totalDibayar: 0,
  });

  await penjualan.validate();

  expect(penjualan.totalHargaProduk).toBe(30000);
  expect(penjualan.totalTagihan).toBe(25000); // 30000 - 5000
  expect(penjualan.statusBayar).toBe("UNPAID");
});
