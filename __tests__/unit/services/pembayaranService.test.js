const pembayaranService = require("../../../services/pembayaranService");
const Pembayaran = require("../../../models/pembayaranModel");
const Penjualan = require("../../../models/penjualanModel");
const MetodePembayaran = require("../../../models/metodePembayaranModel");
const AkunKas = require("../../../models/akunKasModel");
const redis = require("../../../config/redis");
const {
  validatePembayaranPayload,
} = require("../../../validators/pembayaranValidator");

jest.mock("../../../models/pembayaranModel");
jest.mock("../../../models/penjualanModel");
jest.mock("../../../models/metodePembayaranModel");
jest.mock("../../../models/akunKasModel");
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));
jest.mock("../../../validators/pembayaranValidator", () => ({
  validatePembayaranPayload: jest.fn(),
}));

describe("Unit Test — Service — Pembayaran", () => {
  const mockTenantID = "tenant_1";
  const mockDoc = {
    _id: "bayar_1",
    tenantID: mockTenantID,
    akunKasID: { _id: "kas_1" },
    penjualanID: { _id: "jual_1" },
    metodePembayaranID: { _id: "metode_1" },
    noReferensi: "INV-001",
    tanggalBayar: new Date(),
    jumlahBayar: 100000,
    status: "PAID",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockChain = (value) => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Internal Method: Helper Functions", () => {
    test("Method _toNumber sukses mengkonversi berbagai format ke angka", () => {
      expect(pembayaranService._toNumber(100)).toBe(100);
      expect(pembayaranService._toNumber(" 100 ")).toBe(100);
      expect(pembayaranService._toNumber(null)).toBeNaN();
      expect(pembayaranService._toNumber(undefined)).toBeNaN();
      expect(pembayaranService._toNumber("")).toBeNaN();
    });

    test("Method _idOnly sukses mengekstrak ID atau mengembalikan nilai asli", () => {
      expect(pembayaranService._idOnly({ _id: "123" })).toBe("123");
      expect(pembayaranService._idOnly("123")).toBe("123");
      expect(pembayaranService._idOnly(null)).toBeNull();
    });

    test("Method _formatOutput sukses memformat dokumen tunggal maupun array", () => {
      const formatted = pembayaranService._formatOutput(mockDoc);
      expect(formatted.akunKasID).toBe("kas_1");
      expect(formatted.jumlahBayar).toBe(100000);

      const arrFormatted = pembayaranService._formatOutput([mockDoc]);
      expect(Array.isArray(arrFormatted)).toBe(true);
      expect(arrFormatted[0].noReferensi).toBe("INV-001");

      expect(pembayaranService._formatOutput(null)).toBeNull();
    });
  });

  describe("Internal Method: _updateSaldoAkunKas", () => {
    test("Melewati eksekusi jika akunKasID kosong", async () => {
      await pembayaranService._updateSaldoAkunKas({ akunKasID: null });
      expect(AkunKas.findOne).not.toHaveBeenCalled();
    });

    test("Gagal (Throw 404) jika akun kas tidak ditemukan", async () => {
      AkunKas.findOne.mockResolvedValue(null);
      await expect(
        pembayaranService._updateSaldoAkunKas({
          akunKasID: "kas_1",
          tenantID: mockTenantID,
          amount: 100,
        }),
      ).rejects.toThrow(/Akun Kas tidak ditemukan/i);
    });

    test("Gagal (Throw 400) jika hasil update membuat saldo menjadi negatif", async () => {
      AkunKas.findOne.mockResolvedValue({ saldo: 50 });
      await expect(
        pembayaranService._updateSaldoAkunKas({
          akunKasID: "kas_1",
          tenantID: mockTenantID,
          amount: -100,
        }),
      ).rejects.toThrow(/tidak boleh negatif/i);
    });

    test("Sukses memperbarui saldo dan menghapus cache", async () => {
      const mockAkunKas = { saldo: 1000, save: jest.fn() };
      AkunKas.findOne.mockResolvedValue(mockAkunKas);

      await pembayaranService._updateSaldoAkunKas({
        akunKasID: "kas_1",
        tenantID: mockTenantID,
        amount: 500,
      });

      expect(mockAkunKas.saldo).toBe(1500);
      expect(mockAkunKas.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledTimes(2); // list & detail
    });
  });

  describe("Internal Method: _syncPenjualan", () => {
    test("Melewati eksekusi jika penjualan tidak ditemukan", async () => {
      Penjualan.findOne.mockResolvedValue(null);
      await pembayaranService._syncPenjualan("jual_1", mockTenantID);
      expect(Pembayaran.find).not.toHaveBeenCalled();
    });

    test("Sukses menghitung ulang totalDibayar dan tidak mengubah status jika tidak ada VOID", async () => {
      const mockPenjualan = {
        statusPenjualan: "FINAL",
        totalDibayar: 0,
        save: jest.fn(),
      };
      Penjualan.findOne.mockResolvedValue(mockPenjualan);

      // Simulasi 2 pembayaran sukses
      Pembayaran.find.mockResolvedValue([
        { status: "PAID", jumlahBayar: 50000 },
        { status: "PAID", jumlahBayar: 70000 },
        { status: "PENDING", jumlahBayar: 20000 },
      ]);

      await pembayaranService._syncPenjualan("jual_1", mockTenantID);

      expect(mockPenjualan.totalDibayar).toBe(120000); // 50k + 70k
      expect(mockPenjualan.statusPenjualan).toBe("FINAL");
      expect(mockPenjualan.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledTimes(2);
    });

    test("Sukses melakukan Rollback statusPenjualan dari FINAL ke DRAFT jika ada pembayaran VOID", async () => {
      const mockPenjualan = {
        statusPenjualan: "FINAL",
        totalDibayar: 0,
        save: jest.fn(),
      };
      Penjualan.findOne.mockResolvedValue(mockPenjualan);

      Pembayaran.find.mockResolvedValue([
        { status: "VOID", jumlahBayar: 50000 },
      ]);

      await pembayaranService._syncPenjualan("jual_1", mockTenantID);

      expect(mockPenjualan.statusPenjualan).toBe("DRAFT"); // Rollback terjadi
    });
  });

  describe("Internal Method: Validasi Tanggal", () => {
    test("_applyTanggalBayarRules: Sukses dilewati jika status bukan PAID", () => {
      const res = pembayaranService._applyTanggalBayarRules({
        payload: { status: "PENDING" },
      });
      expect(res.ok).toBe(true);
    });

    test("_applyTanggalBayarRules: Gagal jika status PAID tapi tidak ada tanggalBayar", () => {
      const res = pembayaranService._applyTanggalBayarRules({
        payload: { status: "PAID", tanggalBayar: null },
      });
      expect(res.ok).toBe(false);
    });

    test("_validateTanggalBayarNotBeforePenjualan: Gagal jika tanggal bayar mendahului transaksi", () => {
      const res = pembayaranService._validateTanggalBayarNotBeforePenjualan({
        payload: { tanggalBayar: "2026-05-10T10:00:00Z" },
        penjualanDoc: { tanggalTransaksi: "2026-05-15T10:00:00Z" }, // Transaksi lebih baru
      });
      expect(res.ok).toBe(false);
    });
  });

  describe("Method: getAll & getById", () => {
    test("getAll: Mengembalikan data dari Cache Hit", async () => {
      redis.get.mockResolvedValue(JSON.stringify([mockDoc]));
      const result = await pembayaranService.getAll(mockTenantID);
      expect(result).toHaveLength(1);
      expect(Pembayaran.find).not.toHaveBeenCalled();
    });

    test("getAll: Mengambil dari DB pada Cache Miss", async () => {
      redis.get.mockResolvedValue(null);
      Pembayaran.find.mockReturnValue(mockChain([mockDoc]));
      await pembayaranService.getAll(mockTenantID);
      expect(redis.set).toHaveBeenCalled();
    });

    test("getById: Mengembalikan data dari Cache Hit jika tenantID cocok", async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockDoc));
      const result = await pembayaranService.getById("bayar_1", mockTenantID);
      expect(result._id).toBe("bayar_1");
    });
  });

  describe("Method: create", () => {
    const validPayload = {
      tenantID: mockTenantID,
      penjualanID: "jual_1",
      metodePembayaranID: "metode_1",
      akunKasID: "kas_1",
      jumlahBayar: 50000,
      tanggalBayar: "2026-05-20T10:00:00Z",
    };

    const mockPenjualanDoc = {
      _id: "jual_1",
      statusPenjualan: "FINAL",
      sisaTagihan: 100000,
      statusBayar: "UNPAID",
      noReferensi: "INV-001",
    };
    const mockMetodeDoc = {
      _id: "metode_1",
      isActive: true,
      isAutomated: false,
    };

    beforeEach(() => {
      validatePembayaranPayload.mockReturnValue({ valid: true });
      Penjualan.findOne.mockResolvedValue(mockPenjualanDoc);
      MetodePembayaran.findOne.mockResolvedValue(mockMetodeDoc);
      AkunKas.findOne.mockResolvedValue(true);
    });

    test("Gagal jika payload invalid", async () => {
      validatePembayaranPayload.mockReturnValue({
        valid: false,
        errors: ["err"],
      });
      const res = await pembayaranService.create(validPayload);
      expect(res.error).toBeDefined();
    });

    test("Gagal jika Penjualan berstatus VOID", async () => {
      Penjualan.findOne.mockResolvedValue({
        ...mockPenjualanDoc,
        statusPenjualan: "VOID",
      });
      const res = await pembayaranService.create(validPayload);
      expect(res.error[0]).toMatch(/VOID tidak dapat menerima pembayaran/i);
    });

    test("Gagal jika penjualan sudah lunas", async () => {
      Penjualan.findOne.mockResolvedValue({
        ...mockPenjualanDoc,
        statusBayar: "PAID",
        sisaTagihan: 0,
      });
      const res = await pembayaranService.create(validPayload);
      expect(res.error[0]).toMatch(/sudah lunas/i);
    });

    test("Gagal jika bayar melebihi sisa tagihan", async () => {
      const res = await pembayaranService.create({
        ...validPayload,
        jumlahBayar: 200000,
      });
      expect(res.error[0]).toMatch(/tidak boleh melebihi sisa tagihan/i);
    });

    test("Sukses create Non-Automated (Otomatis PAID, Update Kas & Sync)", async () => {
      // Mock methods internal yg dipanggil di create
      jest.spyOn(pembayaranService, "_updateSaldoAkunKas").mockResolvedValue();
      jest.spyOn(pembayaranService, "_syncPenjualan").mockResolvedValue();
      Pembayaran.create.mockResolvedValue({
        _id: "bayar_1",
        status: "PAID",
        jumlahBayar: 50000,
        tenantID: mockTenantID,
        akunKasID: "kas_1",
      });
      Pembayaran.findOne.mockReturnValue(mockChain(mockDoc));

      const res = await pembayaranService.create(validPayload);

      expect(Pembayaran.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: "PAID", noReferensi: "INV-001" }),
      );
      expect(pembayaranService._updateSaldoAkunKas).toHaveBeenCalled();
      expect(pembayaranService._syncPenjualan).toHaveBeenCalled();
      expect(res._id).toBe("bayar_1");
    });

    test("Menangani Error 11000 (Duplicate Key)", async () => {
      const mongoError = new Error("Duplicate");
      mongoError.code = 11000;
      Pembayaran.create.mockRejectedValue(mongoError);

      const res = await pembayaranService.create(validPayload);
      expect(res.error[0]).toMatch(
        /Sistem mendeteksi sisa aturan unique lama/i,
      );
    });
  });

  describe("Method: update", () => {
    const mockPembayaranLama = {
      _id: "bayar_1",
      status: "PENDING",
      penjualanID: "jual_1",
      jumlahBayar: 50000,
      akunKasID: "kas_1",
    };
    const mockPenjualanDoc = { _id: "jual_1", sisaTagihan: 100000 };

    beforeEach(() => {
      validatePembayaranPayload.mockReturnValue({ valid: true });
      Pembayaran.findOne.mockResolvedValue(mockPembayaranLama);
      Penjualan.findOne.mockResolvedValue(mockPenjualanDoc);
      AkunKas.findOne.mockResolvedValue(true);
    });

    test("Gagal update jika pembayaranLama berstatus VOID", async () => {
      Pembayaran.findOne.mockResolvedValue({
        ...mockPembayaranLama,
        status: "VOID",
      });
      const res = await pembayaranService.update("bayar_1", {}, mockTenantID);
      expect(res.error[0]).toMatch(/tidak dapat diubah lagi/i);
    });

    test("Gagal jika jumlahBayar baru melebihi sisaTagihanMurni", async () => {
      // Sisa tagihan murni = 100k + 50k (jumlah lama) = 150k
      const res = await pembayaranService.update(
        "bayar_1",
        { jumlahBayar: 200000 },
        mockTenantID,
      );
      expect(res.error[0]).toMatch(/melebihi sisa tagihan yang diperbolehkan/i);
    });

    test("Sukses update dari PENDING ke PAID (menambah saldo baru)", async () => {
      jest.spyOn(pembayaranService, "_updateSaldoAkunKas").mockResolvedValue();
      jest.spyOn(pembayaranService, "_syncPenjualan").mockResolvedValue();

      const mockUpdated = {
        ...mockPembayaranLama,
        status: "PAID",
        jumlahBayar: 50000,
      };
      Pembayaran.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUpdated),
      });

      await pembayaranService.update(
        "bayar_1",
        { status: "PAID", tanggalBayar: "2026-05-20" },
        mockTenantID,
      );

      // Karena lama PENDING dan baru PAID, saldo ditambah
      expect(pembayaranService._updateSaldoAkunKas).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50000 }),
      );
      expect(pembayaranService._syncPenjualan).toHaveBeenCalled();
    });
  });

  describe("Method: delete", () => {
    test("Gagal jika data tidak ditemukan", async () => {
      Pembayaran.findOne.mockResolvedValue(null);
      const res = await pembayaranService.delete("bayar_1", mockTenantID);
      expect(res).toBeNull();
    });

    test("Gagal menghapus jika data berstatus VOID", async () => {
      Pembayaran.findOne.mockResolvedValue({ status: "VOID" });
      const res = await pembayaranService.delete("bayar_1", mockTenantID);
      expect(res.error[0]).toMatch(/tidak dapat dihapus/i);
    });

    test("Sukses menghapus dan merevert saldo kas jika data PAID", async () => {
      Pembayaran.findOne.mockResolvedValue({
        status: "PAID",
        akunKasID: "kas_1",
        jumlahBayar: 50000,
        penjualanID: "jual_1",
      });
      Pembayaran.deleteOne.mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(pembayaranService, "_updateSaldoAkunKas").mockResolvedValue();
      jest.spyOn(pembayaranService, "_syncPenjualan").mockResolvedValue();

      const res = await pembayaranService.delete("bayar_1", mockTenantID);

      expect(pembayaranService._updateSaldoAkunKas).toHaveBeenCalledWith(
        expect.objectContaining({ amount: -50000 }),
      ); // Revert
      expect(pembayaranService._syncPenjualan).toHaveBeenCalled();
      expect(res).toBe(true);
    });
  });
});
