const mongoose = require("mongoose");
const Pembayaran = require("../../../models/pembayaranModel");

describe("Unit Test — Model — Pembayaran", () => {
  // Mock data yang valid untuk pengujian
  const validData = {
    tenantID: new mongoose.Types.ObjectId(),
    akunKasID: new mongoose.Types.ObjectId(),
    penjualanID: new mongoose.Types.ObjectId(),
    metodePembayaranID: new mongoose.Types.ObjectId(),
    noReferensi: "INV-2026-05-001",
    jumlahBayar: 234300, // Mensimulasikan harga dengan PPN
  };

  describe("Konfigurasi Skema & Default Value", () => {
    test("Sukses membuat instance valid dengan default value", async () => {
      const doc = new Pembayaran(validData);
      await doc.validate();

      expect(doc.status).toBe("PENDING");
      expect(doc.tanggalBayar).toBeNull();
      expect(doc.gatewayPaymentID).toBeNull();
      expect(doc.qrString).toBeNull();
      expect(doc.catatan).toBeNull();
    });

    test("Harus mengaktifkan timestamps dan menonaktifkan versionKey pada opsi Schema", () => {
      const schemaOptions = Pembayaran.schema.options;

      expect(schemaOptions.timestamps).toBe(true);
      expect(schemaOptions.versionKey).toBe(false);
    });

    test("Harus melakukan trim pada field string (noReferensi, gatewayPaymentID, qrString, catatan)", () => {
      const doc = new Pembayaran({
        ...validData,
        noReferensi: "   INV-TRIM-01   ",
        gatewayPaymentID: "   XND-123   ",
        qrString: "   QR-XYZ   ",
        catatan: "   Lunas   ",
      });

      expect(doc.noReferensi).toBe("INV-TRIM-01");
      expect(doc.gatewayPaymentID).toBe("XND-123");
      expect(doc.qrString).toBe("QR-XYZ");
      expect(doc.catatan).toBe("Lunas");
    });
  });

  describe("Validasi Field Wajib & Enum", () => {
    test("Gagal validasi jika field wajib kosong", () => {
      const doc = new Pembayaran({});
      const err = doc.validateSync();

      expect(err.errors.tenantID).toBeDefined();
      expect(err.errors.akunKasID).toBeDefined();
      expect(err.errors.penjualanID).toBeDefined();
      expect(err.errors.metodePembayaranID).toBeDefined();
      expect(err.errors.noReferensi).toBeDefined();
      expect(err.errors.jumlahBayar).toBeDefined();

      // Memastikan pesan kustom keluar
      expect(err.errors.akunKasID.message).toMatch(/Akun Kas wajib diisi/i);
      expect(err.errors.noReferensi.message).toMatch(
        /No Referensi Penjualan wajib diisi/i,
      );
    });

    test("Gagal validasi jika jumlahBayar bernilai negatif", () => {
      const doc = new Pembayaran({
        ...validData,
        jumlahBayar: -50000,
      });

      const err = doc.validateSync();
      expect(err.errors.jumlahBayar).toBeDefined();
      expect(err.errors.jumlahBayar.message).toMatch(
        /Jumlah bayar tidak boleh negatif/i,
      );
    });

    test("Gagal validasi jika status di luar pilihan enum", () => {
      const doc = new Pembayaran({
        ...validData,
        status: "SUCCESS", // Bukan PAID, PENDING, dll
      });

      const err = doc.validateSync();
      expect(err.errors.status).toBeDefined();
    });

    test("Gagal validasi jika status menggunakan huruf kecil (case sensitive)", () => {
      const doc = new Pembayaran({
        ...validData,
        status: "paid", // Harus kapital "PAID"
      });

      const err = doc.validateSync();
      expect(err.errors.status).toBeDefined();
    });
  });

  describe("Pre-validate Hook (Logika Status & Tanggal Bayar)", () => {
    test("Sukses validasi jika status 'PAID' dan tanggalBayar telah diisi", async () => {
      const doc = new Pembayaran({
        ...validData,
        status: "PAID",
        tanggalBayar: new Date(),
      });

      await doc.validate();
      expect(doc.status).toBe("PAID");
      expect(doc.tanggalBayar).not.toBeNull();
    });

    test("Gagal validasi jika status 'PAID' tetapi tanggalBayar dibiarkan kosong (null)", async () => {
      const doc = new Pembayaran({
        ...validData,
        status: "PAID",
        tanggalBayar: null, // Simulasi kelupaan mengisi tanggal saat pelunasan
      });

      let err;
      try {
        await doc.validate();
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.errors.tanggalBayar).toBeDefined();
      expect(err.errors.tanggalBayar.message).toMatch(
        /Tanggal bayar wajib diisi jika status PAID/i,
      );
    });

    test("Sukses validasi jika status selain 'PAID' dan tanggalBayar kosong (null)", async () => {
      const statuses = ["PENDING", "EXPIRED", "FAILED", "VOID"];

      for (const status of statuses) {
        const doc = new Pembayaran({
          ...validData,
          status: status,
          tanggalBayar: null,
        });

        await doc.validate();
        expect(doc.status).toBe(status);
      }
    });
  });
});
