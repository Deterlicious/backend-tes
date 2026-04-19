const mongoose = require("mongoose");
const Pembayaran = require("../../../models/pembayaranModel");

function createValidPembayaran(overrides = {}) {
  return new Pembayaran({
    tenantID: new mongoose.Types.ObjectId(),
    akunKasID: new mongoose.Types.ObjectId(),
    penjualanID: new mongoose.Types.ObjectId(),
    metodePembayaranID: new mongoose.Types.ObjectId(),
    noReferensi: "PAY-TEST-001",
    tanggalBayar: new Date(),
    jumlahBayar: 10000,
    status: "PAID",
    catatan: "Pembayaran test",
    ...overrides,
  });
}

describe("Pembayaran Model Validation", () => {
  describe("field wajib", () => {
    test("gagal jika tenantID tidak diisi", async () => {
      const pembayaran = createValidPembayaran({ tenantID: undefined });

      await expect(pembayaran.validate()).rejects.toThrow();
      expect(pembayaran.validateSync().errors.tenantID).toBeDefined();
    });

    test("gagal jika akunKasID tidak diisi", async () => {
      const pembayaran = createValidPembayaran({ akunKasID: undefined });

      await expect(pembayaran.validate()).rejects.toThrow();
      expect(pembayaran.validateSync().errors.akunKasID).toBeDefined();
    });

    test("gagal jika penjualanID tidak diisi", async () => {
      const pembayaran = createValidPembayaran({ penjualanID: undefined });

      await expect(pembayaran.validate()).rejects.toThrow();
      expect(pembayaran.validateSync().errors.penjualanID).toBeDefined();
    });

    test("gagal jika metodePembayaranID tidak diisi", async () => {
      const pembayaran = createValidPembayaran({
        metodePembayaranID: undefined,
      });

      await expect(pembayaran.validate()).rejects.toThrow();
      expect(pembayaran.validateSync().errors.metodePembayaranID).toBeDefined();
    });

    test("gagal jika noReferensi tidak diisi", async () => {
      const pembayaran = createValidPembayaran({ noReferensi: undefined });

      await expect(pembayaran.validate()).rejects.toThrow();
      expect(pembayaran.validateSync().errors.noReferensi).toBeDefined();
    });

    test("gagal jika jumlahBayar tidak diisi", async () => {
      const pembayaran = createValidPembayaran({ jumlahBayar: undefined });

      await expect(pembayaran.validate()).rejects.toThrow();
      expect(pembayaran.validateSync().errors.jumlahBayar).toBeDefined();
    });
  });

  describe("enum validation", () => {
    test("gagal jika status bukan enum yang valid", async () => {
      const pembayaran = createValidPembayaran({ status: "LUNAS" });

      await expect(pembayaran.validate()).rejects.toThrow();
      expect(pembayaran.validateSync().errors.status).toBeDefined();
    });

    test("status VOID valid", async () => {
      const pembayaran = createValidPembayaran({
        status: "VOID",
        tanggalBayar: null,
      });

      await expect(pembayaran.validate()).resolves.toBeUndefined();
      expect(pembayaran.status).toBe("VOID");
    });

    test("status PENDING valid", async () => {
      const pembayaran = createValidPembayaran({
        status: "PENDING",
        tanggalBayar: null,
      });

      await expect(pembayaran.validate()).resolves.toBeUndefined();
      expect(pembayaran.status).toBe("PENDING");
    });
  });

  describe("nilai dan hook pre-validate", () => {
    test("gagal jika jumlahBayar negatif", async () => {
      const pembayaran = createValidPembayaran({ jumlahBayar: -1000 });

      await expect(pembayaran.validate()).rejects.toThrow();
      expect(pembayaran.validateSync().errors.jumlahBayar).toBeDefined();
    });

    test("jumlahBayar 0 masih valid di level model", async () => {
      const pembayaran = createValidPembayaran({ jumlahBayar: 0 });

      await expect(pembayaran.validate()).resolves.toBeUndefined();
      expect(pembayaran.jumlahBayar).toBe(0);
    });

    test("status PAID wajib punya tanggalBayar", async () => {
      const pembayaran = createValidPembayaran({
        status: "PAID",
        tanggalBayar: null,
      });

      try {
        await pembayaran.validate();
        throw new Error("Seharusnya validasi gagal");
      } catch (err) {
        expect(err).toBeDefined();
        expect(err.errors).toBeDefined();
        expect(err.errors.tanggalBayar).toBeDefined();
        expect(err.errors.tanggalBayar.message).toBe(
          "Tanggal bayar wajib diisi jika status PAID"
        );
      }
    });

    test("status selain PAID tidak wajib tanggalBayar", async () => {
      const pembayaran = createValidPembayaran({
        status: "FAILED",
        tanggalBayar: null,
      });

      await expect(pembayaran.validate()).resolves.toBeUndefined();
      expect(pembayaran.tanggalBayar).toBeNull();
    });
  });

  describe("default dan trim", () => {
    test("status default adalah PENDING", async () => {
      const pembayaran = new Pembayaran({
        tenantID: new mongoose.Types.ObjectId(),
        akunKasID: new mongoose.Types.ObjectId(),
        penjualanID: new mongoose.Types.ObjectId(),
        metodePembayaranID: new mongoose.Types.ObjectId(),
        noReferensi: "PAY-DEFAULT-001",
        jumlahBayar: 10000,
      });

      await pembayaran.validate().catch(() => {});

      expect(pembayaran.status).toBe("PENDING");
    });

    test("tanggalBayar default null", () => {
      const pembayaran = new Pembayaran({
        tenantID: new mongoose.Types.ObjectId(),
        akunKasID: new mongoose.Types.ObjectId(),
        penjualanID: new mongoose.Types.ObjectId(),
        metodePembayaranID: new mongoose.Types.ObjectId(),
        noReferensi: "PAY-DEFAULT-002",
        jumlahBayar: 10000,
      });

      expect(pembayaran.tanggalBayar).toBeNull();
    });

    test("gatewayPaymentID default null", () => {
      const pembayaran = new Pembayaran({
        tenantID: new mongoose.Types.ObjectId(),
        akunKasID: new mongoose.Types.ObjectId(),
        penjualanID: new mongoose.Types.ObjectId(),
        metodePembayaranID: new mongoose.Types.ObjectId(),
        noReferensi: "PAY-DEFAULT-003",
        jumlahBayar: 10000,
      });

      expect(pembayaran.gatewayPaymentID).toBeNull();
    });

    test("qrString default null", () => {
      const pembayaran = new Pembayaran({
        tenantID: new mongoose.Types.ObjectId(),
        akunKasID: new mongoose.Types.ObjectId(),
        penjualanID: new mongoose.Types.ObjectId(),
        metodePembayaranID: new mongoose.Types.ObjectId(),
        noReferensi: "PAY-DEFAULT-004",
        jumlahBayar: 10000,
      });

      expect(pembayaran.qrString).toBeNull();
    });

    test("catatan default null", () => {
      const pembayaran = new Pembayaran({
        tenantID: new mongoose.Types.ObjectId(),
        akunKasID: new mongoose.Types.ObjectId(),
        penjualanID: new mongoose.Types.ObjectId(),
        metodePembayaranID: new mongoose.Types.ObjectId(),
        noReferensi: "PAY-DEFAULT-005",
        jumlahBayar: 10000,
      });

      expect(pembayaran.catatan).toBeNull();
    });

    test("noReferensi di-trim oleh schema", async () => {
      const pembayaran = createValidPembayaran({
        noReferensi: "   PAY-TRIM-001   ",
      });

      await pembayaran.validate();

      expect(pembayaran.noReferensi).toBe("PAY-TRIM-001");
    });

    test("gatewayPaymentID di-trim oleh schema", async () => {
      const pembayaran = createValidPembayaran({
        gatewayPaymentID: "   MID-001   ",
      });

      await pembayaran.validate();

      expect(pembayaran.gatewayPaymentID).toBe("MID-001");
    });

    test("qrString di-trim oleh schema", async () => {
      const pembayaran = createValidPembayaran({
        qrString: "   QR-STRING-001   ",
      });

      await pembayaran.validate();

      expect(pembayaran.qrString).toBe("QR-STRING-001");
    });

    test("catatan di-trim oleh schema", async () => {
      const pembayaran = createValidPembayaran({
        catatan: "   Catatan pembayaran   ",
      });

      await pembayaran.validate();

      expect(pembayaran.catatan).toBe("Catatan pembayaran");
    });
  });
});