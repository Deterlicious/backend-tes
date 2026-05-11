const mongoose = require("mongoose");
const Penjualan = require("../../../models/penjualanModel");

describe("Unit Test — Model — Penjualan", () => {
  const validItemID = new mongoose.Types.ObjectId();

  const validItem = {
    produkID: validItemID,
    namaProduk: " Kopi Susu Aren ", // Sengaja ada spasi untuk test trim
    jumlah: 2,
    hargaJual: 15000,
    subTotal: 30000,
    jumlahDiskon: 0,
    total: 30000,
    totalharga: 30000,
  };

  const validData = {
    tenantID: new mongoose.Types.ObjectId(),
    noReferensi: " INV-001 ", // Sengaja ada spasi
    penggunaID: new mongoose.Types.ObjectId(),
    pelangganID: new mongoose.Types.ObjectId(),
    jenisTransaksi: "POS",
    jenisPenjualan: "dine-in",
    tanggalTransaksi: new Date(),
    itemPenjualan: [validItem],
  };

  describe("Konfigurasi Skema & Default Value", () => {
    test("Sukses membuat instance valid dan memastikan nilai default (Status Penjualan, Status Bayar, Jatuh Tempo, Item default)", async () => {
      const doc = new Penjualan(validData);

      // Menggunakan await doc.validate() alih-alih validateSync()
      // agar pre('validate') hook Mongoose tereksekusi dengan sempurna
      let err;
      try {
        await doc.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeUndefined(); // Lolos validasi Mongoose

      // Pengecekan nilai default Penjualan
      expect(doc.jatuhTempo).toBeNull();
      expect(doc.statusPenjualan).toBe("DRAFT");
      expect(doc.statusBayar).toBe("UNPAID");
      expect(doc.totalHargaProduk).toBe(30000); // Hook sekarang tereksekusi dan menghasilkan 30000!
      expect(doc.diskonGlobalIDs).toEqual([]);
      expect(doc.keterangan).toBe("");

      // Pengecekan nilai default Item
      expect(doc.itemPenjualan[0].sesiBookingID).toBeNull();
      expect(doc.itemPenjualan[0].rincianPajak).toEqual([]);
      expect(doc.itemPenjualan[0].jumlahPajak).toBe(0);
    });

    test("Memastikan opsi Schema (timestamps & versionKey) dikonfigurasi dengan benar", () => {
      const schemaOptions = Penjualan.schema.options;
      expect(schemaOptions.timestamps).toBe(true);
      expect(schemaOptions.versionKey).toBe(false);
    });

    test("Harus melakukan trim (hapus spasi berlebih) pada string yang relevan", () => {
      const doc = new Penjualan({
        ...validData,
        noReferensi: "   REF-001   ",
        keterangan: "   Catatan Kasir   ",
      });
      // String pada sub-dokumen itemPenjualan
      doc.itemPenjualan[0].namaProduk = "   Es Teh   ";

      expect(doc.noReferensi).toBe("REF-001");
      expect(doc.keterangan).toBe("Catatan Kasir");
      expect(doc.itemPenjualan[0].namaProduk).toBe("Es Teh");
    });
  });

  describe("Validasi Field Wajib (Required) & Minimum Value", () => {
    test("Gagal validasi jika seluruh field wajib di root dokumen dikosongkan", () => {
      const doc = new Penjualan({});
      const err = doc.validateSync();

      expect(err.errors.tenantID).toBeDefined();
      expect(err.errors.noReferensi).toBeDefined();
      expect(err.errors.penggunaID).toBeDefined();
      expect(err.errors.pelangganID).toBeDefined();
      expect(err.errors.jenisTransaksi).toBeDefined();
      expect(err.errors.jenisPenjualan).toBeDefined();
      expect(err.errors.tanggalTransaksi).toBeDefined();
      // Mongoose array defaultnya [], jadi tidak melempar required error langsung kecuali isinya divalidasi custom
    });

    test("Gagal validasi jika field wajib di dalam sub-dokumen itemPenjualan dikosongkan", () => {
      const doc = new Penjualan({
        ...validData,
        itemPenjualan: [{}], // Mengirim item kosong
      });

      const err = doc.validateSync();
      expect(err.errors["itemPenjualan.0.produkID"]).toBeDefined();
      expect(err.errors["itemPenjualan.0.namaProduk"]).toBeDefined();
      expect(err.errors["itemPenjualan.0.jumlah"]).toBeDefined();
      expect(err.errors["itemPenjualan.0.hargaJual"]).toBeDefined();
    });

    test("Gagal validasi jika jumlah, hargaJual, atau jumlahDiskon bernilai di bawah batas minimum (negatif/nol)", () => {
      const doc = new Penjualan({
        ...validData,
        itemPenjualan: [
          {
            ...validItem,
            jumlah: 0, // Minimal 1
            hargaJual: -5000, // Minimal 0
            jumlahDiskon: -100, // Minimal 0
          },
        ],
      });

      const err = doc.validateSync();
      expect(err.errors["itemPenjualan.0.jumlah"].message).toMatch(
        /Jumlah harus minimal 1/i,
      );
      expect(err.errors["itemPenjualan.0.hargaJual"].message).toMatch(
        /Harga Jual tidak boleh negatif/i,
      );
      expect(err.errors["itemPenjualan.0.jumlahDiskon"].message).toMatch(
        /Jumlah Diskon tidak boleh negatif/i,
      );
    });
  });

  describe("Validasi Enum Pilihan", () => {
    test("Gagal validasi jika jenisTransaksi, jenisPenjualan, statusPenjualan, atau statusBayar di luar opsi valid", () => {
      const doc = new Penjualan({
        ...validData,
        jenisTransaksi: "NGUTANG",
        jenisPenjualan: "online-delivery",
        statusPenjualan: "SEMENTARA",
        statusBayar: "NYICIL",
      });

      const err = doc.validateSync();

      expect(err.errors.jenisTransaksi.message).toMatch(
        /bukan jenis transaksi valid/i,
      );
      expect(err.errors.jenisPenjualan.message).toMatch(
        /bukan jenis penjualan valid/i,
      );
      expect(err.errors.statusPenjualan.message).toMatch(
        /is not a valid enum value/i,
      );
      expect(err.errors.statusBayar.message).toMatch(
        /is not a valid enum value/i,
      );
    });
  });

  describe("Logika Pre-Validate Hook (Kalkulasi Tagihan & Status Bayar)", () => {
    let preValidateHook;

    beforeAll(() => {
      // Ekstraksi hook Mongoose secara manual untuk unit test terisolasi
      let hooks;
      if (Penjualan.schema.s && Penjualan.schema.s.hooks) {
        hooks = Penjualan.schema.s.hooks._pres.get("validate"); // Mongoose 6+
      } else {
        hooks = Penjualan.schema._pres.get("validate"); // Mongoose lama
      }
      // Cari hook spesifik kita (yang menghitung grandTotalItem)
      const targetHook = hooks.find((h) =>
        h.fn.toString().includes("grandTotalItem"),
      );
      preValidateHook = targetHook.fn;
    });

    test("Hook menetapkan angka negatif pada item (subTotal, total, totalharga) menjadi 0 (Clamping)", () => {
      const context = {
        itemPenjualan: [{ subTotal: -100, total: -50, totalharga: -200 }],
      };
      const next = jest.fn();

      preValidateHook.call(context, next);

      expect(context.itemPenjualan[0].subTotal).toBe(0);
      expect(context.itemPenjualan[0].total).toBe(0);
      expect(context.itemPenjualan[0].totalharga).toBe(0);
      expect(context.totalHargaProduk).toBe(0); // 0 + 0
      expect(next).toHaveBeenCalled();
    });

    test("Kalkulasi status: 'PAID' karena diskon menutupi seluruh harga (Total Tagihan <= 0 di-clamp ke 0)", () => {
      const context = {
        itemPenjualan: [{ totalharga: 50000 }], // Total item 50k
        jumlahDiskonTransaksi: 60000, // Diskon 60k (Melebihi tagihan)
        jumlahPajakTransaksi: 0,
        totalDibayar: 0,
      };

      preValidateHook.call(context, jest.fn());

      expect(context.totalHargaProduk).toBe(50000);
      expect(context.totalTagihan).toBe(0); // (50k - 60k) dikunci minimal 0
      expect(context.sisaTagihan).toBe(0);
      expect(context.statusBayar).toBe("PAID");
    });

    test("Kalkulasi status: 'PARTIAL' jika ada pembayaran yang masuk namun belum lunas", () => {
      const context = {
        itemPenjualan: [{ totalharga: 100000 }],
        jumlahDiskonTransaksi: 0,
        jumlahPajakTransaksi: 10000, // Total tagihan: 110k
        totalDibayar: 50000, // DP 50k
      };

      preValidateHook.call(context, jest.fn());

      expect(context.totalTagihan).toBe(110000);
      expect(context.sisaTagihan).toBe(60000); // 110k - 50k
      expect(context.statusBayar).toBe("PARTIAL");
    });

    test("Kalkulasi status: 'UNPAID' jika belum ada pembayaran sama sekali", () => {
      const context = {
        itemPenjualan: [{ totalharga: 75000 }],
        jumlahDiskonTransaksi: 0,
        jumlahPajakTransaksi: 0,
        totalDibayar: 0,
      };

      preValidateHook.call(context, jest.fn());

      expect(context.totalTagihan).toBe(75000);
      expect(context.sisaTagihan).toBe(75000);
      expect(context.statusBayar).toBe("UNPAID");
    });

    test("Tidak gagal meskipun array itemPenjualan kosong atau undefined", () => {
      const context = {
        itemPenjualan: [],
      };

      preValidateHook.call(context, jest.fn());

      expect(context.totalHargaProduk).toBe(0);
      expect(context.totalTagihan).toBe(0);
      expect(context.statusBayar).toBe("PAID"); // Jika tagihan 0, otomatis PAID
    });
  });
});
