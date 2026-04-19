const mongoose = require("mongoose");
const Penjualan = require("../../../models/penjualanModel");

function createValidItem(overrides = {}) {
  return {
    produkID: new mongoose.Types.ObjectId(),
    namaProduk: "Produk Test",
    jumlah: 1,
    hargaJual: 10000,
    subTotal: 10000,
    jumlahDiskon: 0,
    total: 10000,
    jumlahPajak: 0,
    totalharga: 10000,
    ...overrides,
  };
}

function createValidPenjualan(overrides = {}) {
  return new Penjualan({
    tenantID: new mongoose.Types.ObjectId(),
    noReferensi: "INV-TEST-001",
    penggunaID: new mongoose.Types.ObjectId(),
    pelangganID: new mongoose.Types.ObjectId(),
    jenisTransaksi: "POS",
    jenisPenjualan: "dine-in",
    tanggalTransaksi: new Date(),
    statusPenjualan: "DRAFT",
    itemPenjualan: [createValidItem()],
    jumlahDiskonTransaksi: 0,
    jumlahPajakTransaksi: 0,
    totalDibayar: 0,
    ...overrides,
  });
}

describe("Penjualan Model Validation", () => {
  describe("Field Wajib (Required)", () => {
    const requiredFields = [
      "tenantID",
      "noReferensi",
      "penggunaID",
      "pelangganID",
      "jenisTransaksi",
      "jenisPenjualan",
      "tanggalTransaksi",
    ];

    requiredFields.forEach((field) => {
      test(`gagal jika ${field} tidak diisi`, async () => {
        const penjualan = createValidPenjualan({ [field]: undefined });
        await expect(penjualan.validate()).rejects.toThrow();
        expect(penjualan.validateSync().errors[field]).toBeDefined();
      });
    });

    test("itemPenjualan kosong tidak otomatis gagal di level model", async () => {
      const penjualan = createValidPenjualan({ itemPenjualan: [] });
      await expect(penjualan.validate()).resolves.toBeUndefined();
    });
  });

  describe("Enum & Value Validation", () => {
    test("gagal jika jenisTransaksi bukan POS/INVOICE", async () => {
      const penjualan = createValidPenjualan({ jenisTransaksi: "CASH" });
      await expect(penjualan.validate()).rejects.toThrow();
    });

    test("gagal jika jenisPenjualan bukan dine-in/takeaway/booking", async () => {
      const penjualan = createValidPenjualan({ jenisPenjualan: "delivery" });
      await expect(penjualan.validate()).rejects.toThrow();
    });

    test("gagal jika statusPenjualan bukan DRAFT/FINAL/VOID", async () => {
      const penjualan = createValidPenjualan({ statusPenjualan: "CANCELLED" });
      await expect(penjualan.validate()).rejects.toThrow();
    });

    test("statusBayar otomatis UNPAID jika totalDibayar 0", async () => {
      const penjualan = createValidPenjualan({ totalDibayar: 0 });
      await penjualan.validate();
      expect(penjualan.statusBayar).toBe("UNPAID");
    });
  });

  describe("Validasi Sub-Dokumen (itemPenjualan)", () => {
    test("gagal jika produkID item tidak diisi", async () => {
      const penjualan = createValidPenjualan({
        itemPenjualan: [createValidItem({ produkID: undefined })],
      });
      const error = penjualan.validateSync();
      expect(error.errors["itemPenjualan.0.produkID"]).toBeDefined();
    });

    test("gagal jika jumlah item kurang dari 1", async () => {
      const penjualan = createValidPenjualan({
        itemPenjualan: [createValidItem({ jumlah: 0 })],
      });
      const error = penjualan.validateSync();
      expect(error.errors["itemPenjualan.0.jumlah"]).toBeDefined();
    });

    test("gagal jika hargaJual item negatif", async () => {
      const penjualan = createValidPenjualan({
        itemPenjualan: [createValidItem({ hargaJual: -100 })],
      });
      await expect(penjualan.validate()).rejects.toThrow();
    });

    test("namaProduk item di-trim otomatis", async () => {
      const penjualan = createValidPenjualan({
        itemPenjualan: [createValidItem({ namaProduk: "  Kopi  " })],
      });
      await penjualan.validate();
      expect(penjualan.itemPenjualan[0].namaProduk).toBe("Kopi");
    });
  });

  describe("Default Values & Formatting", () => {
    test("noReferensi di-trim otomatis", async () => {
      const penjualan = createValidPenjualan({ noReferensi: "  INV-01  " });
      await penjualan.validate();
      expect(penjualan.noReferensi).toBe("INV-01");
    });

    test("jumlahDiskonTransaksi default ke 0", async () => {
      const penjualan = new Penjualan({});
      expect(penjualan.jumlahDiskonTransaksi).toBe(0);
    });

    test("keterangan default ke string kosong", async () => {
      const penjualan = new Penjualan({});
      expect(penjualan.keterangan).toBe("");
    });
  });

  describe("Kalkulasi Hook Pre-Validate (Logic Bisnis)", () => {
    test("PAID: totalDibayar == totalTagihan", async () => {
      const penjualan = createValidPenjualan({
        itemPenjualan: [
          createValidItem({
            hargaJual: 5000,
            subTotal: 5000,
            total: 5000,
            totalharga: 5000,
          }),
        ],
        totalDibayar: 5000,
      });
      await penjualan.validate();
      expect(penjualan.totalTagihan).toBe(5000);
      expect(penjualan.sisaTagihan).toBe(0);
      expect(penjualan.statusBayar).toBe("PAID");
    });

    test("PARTIAL: totalDibayar < totalTagihan", async () => {
      const penjualan = createValidPenjualan({
        itemPenjualan: [
          createValidItem({
            hargaJual: 10000,
            subTotal: 10000,
            total: 10000,
            totalharga: 10000,
          }),
        ],
        totalDibayar: 4000,
      });
      await penjualan.validate();
      expect(penjualan.sisaTagihan).toBe(6000);
      expect(penjualan.statusBayar).toBe("PARTIAL");
    });

    test("diskon global mengurangi total tagihan", async () => {
      const penjualan = createValidPenjualan({
        itemPenjualan: [createValidItem({ totalharga: 10000 })],
        jumlahDiskonTransaksi: 2000,
      });
      await penjualan.validate();
      expect(penjualan.totalTagihan).toBe(8000);
    });

    test("totalTagihan minimal 0 (tidak boleh negatif karena diskon)", async () => {
      const penjualan = createValidPenjualan({
        itemPenjualan: [createValidItem({ totalharga: 1000 })],
        jumlahDiskonTransaksi: 5000,
      });
      await penjualan.validate();
      expect(penjualan.totalTagihan).toBe(0);
      expect(penjualan.statusBayar).toBe("PAID");
    });

    test("normalisasi nilai negatif pada item menjadi 0", async () => {
      const penjualan = createValidPenjualan({
        itemPenjualan: [
          createValidItem({ subTotal: -5000, total: -5000, totalharga: -5000 }),
        ],
      });
      await penjualan.validate();
      expect(penjualan.itemPenjualan[0].totalharga).toBe(0);
      expect(penjualan.totalTagihan).toBe(0);
    });

    test("menangani itemPenjualan null/kosong dengan aman", async () => {
      const penjualan = createValidPenjualan({ itemPenjualan: [] });
      await penjualan.validate();
      expect(penjualan.totalHargaProduk).toBe(0);
      expect(penjualan.totalTagihan).toBe(0);
    });
  });

  describe("Skenario Chaos & Edge Cases (Final Test)", () => {
    test("casting proteksi: totalDibayar string angka harus bisa divalidasi", async () => {
      const penjualan = createValidPenjualan({ totalDibayar: "15000" });
      await expect(penjualan.validate()).resolves.toBeUndefined();
      expect(penjualan.totalDibayar).toBe(15000);
    });

    test("gagal jika format ObjectId salah", async () => {
      const penjualan = createValidPenjualan({ tenantID: "bukan-object-id" });
      await expect(penjualan.validate()).rejects.toThrow();
    });

    test("menerima banyak item dan menjumlahkannya dengan presisi", async () => {
      const penjualan = createValidPenjualan({
        itemPenjualan: [
          createValidItem({ totalharga: 100.5 }),
          createValidItem({ totalharga: 200.25 }),
        ],
      });
      await penjualan.validate();
      expect(penjualan.totalHargaProduk).toBe(300.75);
    });
  });
});