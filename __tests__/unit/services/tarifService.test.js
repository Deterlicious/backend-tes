const tarifService = require("../../../services/tarifService");
const Tarif = require("../../../models/tarifModel");
const TipeAset = require("../../../models/tipeAsetModel");
const redis = require("../../../config/redis");
const { validateTarifPayload } = require("../../../validators/tarifValidator");

jest.mock("../../../models/tarifModel");
jest.mock("../../../models/tipeAsetModel");
jest.mock("../../../validators/tarifValidator");
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
}));

describe("Unit Test — Service — Tarif", () => {
  const mockTenantID = "tenant_1";

  const mockAset = { _id: "aset_1", namaTipeAset: "Ruangan" };
  const mockDoc = {
    _id: "tarif_1",
    tenantID: mockTenantID,
    namaTarif: "Tarif Reguler",
    basisPerhitungan: "per jam",
    harga: 50000,
    durasiMinimum: 1,
    isActive: true,
    hariAktif: [1, 2, 3],
    jamMulai: "08:00",
    jamSelesai: "22:00",
    prioritas: 1,
    tipeAsetID: [mockAset], // Tersimulasi sudah di-populate
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Helper untuk memalsukan Mongoose chaining (populate, sort, lean, dll)
  const mockChain = (value) => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Internal Method: clearCache", () => {
    test("Sukses membersihkan cache list dan spesifik ID menggunakan pola SCAN", async () => {
      // Mock redis scan: kembalikan cursor 0 dan array berisi key
      redis.scan.mockResolvedValueOnce([
        "0",
        ["tarif:list:tenant_1:{}", 'tarif:list:tenant_1:{"isActive":true}'],
      ]);

      await tarifService.clearCache(mockTenantID, "tarif_1");

      expect(redis.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        `tarif:list:${mockTenantID}:*`,
        "COUNT",
        100,
      );
      expect(redis.del).toHaveBeenCalledWith(
        "tarif:list:tenant_1:{}",
        'tarif:list:tenant_1:{"isActive":true}',
        "tarif:detail:tarif_1",
      );
    });

    test("Tidak memanggil redis.del jika tidak ada cache yang cocok (array keys kosong) dan id tidak dikirim", async () => {
      redis.scan.mockResolvedValueOnce(["0", []]);

      await tarifService.clearCache(mockTenantID);

      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe("Internal Method: verifyAssetOwnership", () => {
    test("Langsung return (pass) jika array assetIds kosong atau undefined", async () => {
      await expect(
        tarifService.verifyAssetOwnership([], mockTenantID),
      ).resolves.toBeUndefined();
      expect(TipeAset.find).not.toHaveBeenCalled();
    });

    test("Gagal (Throw 403) jika jumlah aset valid yang ditemukan DB lebih sedikit dari assetIds (Indikasi Aset milik tenant lain/Tidak Valid)", async () => {
      // Karena service memanggil .select("_id") TANPA .lean(), kita mock select agar langsung me-resolve promise
      TipeAset.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: "aset_1" }]),
      });

      await expect(
        tarifService.verifyAssetOwnership(
          ["aset_1", "aset_hacker"],
          mockTenantID,
        ),
      ).rejects.toThrow(
        /Security Violation: Satu atau lebih Tipe Aset tidak ditemukan/i,
      );
    });

    test("Sukses (pass) jika semua tipe aset valid dan terbukti milik tenant tersebut", async () => {
      TipeAset.find.mockReturnValue({
        select: jest
          .fn()
          .mockResolvedValue([{ _id: "aset_1" }, { _id: "aset_2" }]),
      });

      await expect(
        tarifService.verifyAssetOwnership(["aset_1", "aset_2"], mockTenantID),
      ).resolves.toBeUndefined();
    });
  });

  describe("Method: _formatOutput", () => {
    test("Sukses memformat dokumen tunggal dan mengubah array tipeAsetID menjadi objek dataAset", () => {
      const formatted = tarifService._formatOutput(mockDoc);
      expect(formatted.namaTarif).toBe("Tarif Reguler");
      expect(formatted.dataAset).toHaveLength(1);
      expect(formatted.dataAset[0].namaTipeAset).toBe("Ruangan");
      expect(formatted.tipeAsetID).toBeUndefined(); // field asli tidak boleh diekspos langsung (sudah dipindah ke dataAset)
    });

    test("Sukses menangani format jika tipeAsetID kosong atau undefined", () => {
      const docTanpaAset = { ...mockDoc, tipeAsetID: null };
      const formatted = tarifService._formatOutput(docTanpaAset);
      expect(formatted.dataAset).toEqual([]);
    });
  });

  describe("Method: getAll", () => {
    test("Gagal (Throw 400) jika tenantID tidak dikirim", async () => {
      await expect(tarifService.getAll()).rejects.toThrow(/tenantID required/i);
    });

    test("Sukses mengambil data dari Cache dan parsing JSON", async () => {
      redis.get.mockResolvedValue(JSON.stringify([mockDoc]));
      const result = await tarifService.getAll(mockTenantID, {
        isActive: "true",
      });

      const expectedFilterKey = JSON.stringify({
        tenantID: mockTenantID,
        isActive: true,
      }); // String "true" harus jadi boolean
      expect(redis.get).toHaveBeenCalledWith(
        `tarif:list:${mockTenantID}:${expectedFilterKey}`,
      );
      expect(result).toHaveLength(1);
      expect(Tarif.find).not.toHaveBeenCalled();
    });

    test("Sukses (Cache Miss) mengambil data dari DB, menerapkan filter, dan menyimpan ke Cache", async () => {
      redis.get.mockResolvedValue(null);
      Tarif.find.mockReturnValue(mockChain([mockDoc]));

      const query = { basisPerhitungan: "per jam", isActive: "false" }; // Test konversi string ke bool
      await tarifService.getAll(mockTenantID, query);

      expect(Tarif.find).toHaveBeenCalledWith({
        tenantID: mockTenantID,
        basisPerhitungan: "per jam",
        isActive: false, // Bukti sudah dikonversi
      });
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe("Method: getById", () => {
    test("Sukses (Cache Hit) mengembalikan data jika tenantID cocok", async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockDoc));
      const result = await tarifService.getById("tarif_1", mockTenantID);
      expect(result._id).toBe("tarif_1");
    });

    test("Gagal (Return null) dari cache jika tenantID tidak cocok (Tenant Isolation)", async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockDoc));
      const result = await tarifService.getById("tarif_1", "tenant_hacker");
      expect(result).toBeNull();
    });

    test("Sukses (Cache Miss) mengambil data dari DB dan menyimpan ke Cache", async () => {
      redis.get.mockResolvedValue(null);
      Tarif.findOne.mockReturnValue(mockChain(mockDoc));

      const result = await tarifService.getById("tarif_1", mockTenantID);

      expect(Tarif.findOne).toHaveBeenCalledWith({
        _id: "tarif_1",
        tenantID: mockTenantID,
      });
      expect(redis.set).toHaveBeenCalled();
      expect(result._id).toBe("tarif_1");
    });
  });

  describe("Method: create", () => {
    const validPayload = {
      tenantID: mockTenantID,
      namaTarif: "Tarif Reguler",
      basisPerhitungan: "per jam",
      harga: 50000,
      durasiMinimum: 1,
      tipeAsetID: "aset_1", // String, akan diubah service ke array
    };

    beforeEach(() => {
      validateTarifPayload.mockReturnValue({ valid: true });
      jest.spyOn(tarifService, "verifyAssetOwnership").mockResolvedValue();
      jest.spyOn(tarifService, "clearCache").mockResolvedValue();
    });

    test("Gagal jika validasi payload tidak lolos", async () => {
      validateTarifPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid"],
      });
      const result = await tarifService.create(validPayload);
      expect(result.error).toEqual(["Invalid"]);
    });

    test("Sukses memastikan tipeAsetID menjadi array, verifikasi aset, create ke DB, dan clear cache", async () => {
      Tarif.create.mockResolvedValue({ _id: "tarif_new" });
      Tarif.findById.mockReturnValue(
        mockChain({ ...mockDoc, _id: "tarif_new" }),
      );

      const result = await tarifService.create(validPayload);

      expect(validPayload.tipeAsetID).toEqual(["aset_1"]); // Terbukti diubah jadi array
      expect(tarifService.verifyAssetOwnership).toHaveBeenCalledWith(
        ["aset_1"],
        mockTenantID,
      );
      expect(Tarif.create).toHaveBeenCalledWith(validPayload);
      expect(tarifService.clearCache).toHaveBeenCalledWith(mockTenantID);
      expect(result._id).toBe("tarif_new");
    });

    test("Menangkap dan melempar (Throw 400) jika error duplicate namaTarif (11000)", async () => {
      const mongoError = new Error("Duplicate");
      mongoError.code = 11000;
      Tarif.create.mockRejectedValue(mongoError);

      await expect(tarifService.create(validPayload)).rejects.toThrow(
        /Nama tarif sudah digunakan/i,
      );
    });
  });

  describe("Method: update", () => {
    const updatePayload = {
      namaTarif: "Tarif Berubah",
      tipeAsetID: ["aset_2"],
    };

    beforeEach(() => {
      validateTarifPayload.mockReturnValue({ valid: true });
      jest.spyOn(tarifService, "verifyAssetOwnership").mockResolvedValue();
      jest.spyOn(tarifService, "clearCache").mockResolvedValue();
    });

    test("Gagal jika payload update tidak valid", async () => {
      validateTarifPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid Update"],
      });
      const result = await tarifService.update(
        "tarif_1",
        mockTenantID,
        updatePayload,
      );
      expect(result.error).toEqual(["Invalid Update"]);
    });

    test("Sukses memodifikasi payload menjadi $addToSet untuk tipeAsetID dan membersihkan cache", async () => {
      Tarif.findOneAndUpdate.mockReturnValue(mockChain(mockDoc));

      const result = await tarifService.update("tarif_1", mockTenantID, {
        ...updatePayload,
        tenantID: "hacker",
      });

      expect(tarifService.verifyAssetOwnership).toHaveBeenCalledWith(
        ["aset_2"],
        mockTenantID,
      );

      // Memastikan tenantID dihapus dan tipeAsetID diubah jadi $addToSet (mencegah overwrite tipeAsetID lama jika tidak perlu)
      expect(Tarif.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "tarif_1", tenantID: mockTenantID },
        expect.objectContaining({
          namaTarif: "Tarif Berubah",
          $addToSet: { tipeAsetID: { $each: ["aset_2"] } },
        }),
        expect.any(Object),
      );

      expect(tarifService.clearCache).toHaveBeenCalledWith(
        mockTenantID,
        "tarif_1",
      );
      expect(result._id).toBe("tarif_1");
    });

    test("Mengembalikan null jika tarif tidak ditemukan saat diupdate", async () => {
      Tarif.findOneAndUpdate.mockReturnValue(mockChain(null));
      const result = await tarifService.update("tarif_invalid", mockTenantID, {
        harga: 1000,
      });
      expect(result).toBeNull();
    });

    test("Menangkap dan melempar (Throw 400) jika nama tarif update duplikat (11000)", async () => {
      const mongoError = new Error("Duplicate");
      mongoError.code = 11000;
      Tarif.findOneAndUpdate.mockImplementation(() => {
        throw mongoError;
      });

      await expect(
        tarifService.update("tarif_1", mockTenantID, {
          namaTarif: "Tarif Reguler",
        }),
      ).rejects.toThrow(/Nama tarif sudah digunakan/i);
    });
  });

  describe("Method: delete", () => {
    test("Mengembalikan null jika dokumen tidak ditemukan di DB (deletedCount 0)", async () => {
      Tarif.deleteOne.mockResolvedValue({ deletedCount: 0 });
      const result = await tarifService.delete("tarif_1", mockTenantID);
      expect(result).toBeNull();
    });

    test("Sukses menghapus data dari DB dan membersihkan cache", async () => {
      Tarif.deleteOne.mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(tarifService, "clearCache").mockResolvedValue();

      const result = await tarifService.delete("tarif_1", mockTenantID);

      expect(Tarif.deleteOne).toHaveBeenCalledWith({
        _id: "tarif_1",
        tenantID: mockTenantID,
      });
      expect(tarifService.clearCache).toHaveBeenCalledWith(
        mockTenantID,
        "tarif_1",
      );
      expect(result).toBe(true);
    });
  });
});
