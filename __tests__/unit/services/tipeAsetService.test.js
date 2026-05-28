const tipeAsetService = require("../../../services/tipeAsetService");
const TipeAset = require("../../../models/tipeAsetModel");
const Tarif = require("../../../models/tarifModel");
const redis = require("../../../config/redis");
const {
  validateTipeAsetPayload,
} = require("../../../validators/tipeAsetValidator");

jest.mock("../../../models/tipeAsetModel");
jest.mock("../../../models/tarifModel");
jest.mock("../../../validators/tipeAsetValidator");
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
}));

describe("Unit Test — Service — Tipe Aset", () => {
  const mockTenantID = "tenant_1";

  const mockTarif = {
    _id: "tarif_1",
    namaTarif: "Tarif Pagi",
    harga: 50000,
    durasiMinimum: 1,
  };
  const mockDoc = {
    _id: "aset_1",
    tenantID: mockTenantID,
    namaTipeAset: "Ruangan VIP",
    deskripsi: "Ruangan Full AC",
    listTarif: [mockTarif], // Virtual field dari Mongoose
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Helper memalsukan Mongoose chaining (populate, sort, lean)
  const mockChain = (value) => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Internal Method: Cache Management (clearCache & _clearTarifCache)", () => {
    test("clearCache: Sukses membersihkan cache list dan detail menggunakan pola SCAN", async () => {
      redis.scan.mockResolvedValueOnce(["0", ["tipeAset:list:tenant_1:{}"]]);

      await tipeAsetService.clearCache(mockTenantID, "aset_1");

      expect(redis.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        `tipeAset:list:${mockTenantID}:*`,
        "COUNT",
        100,
      );
      expect(redis.del).toHaveBeenCalledWith(
        "tipeAset:list:tenant_1:{}",
        "tipeAset:detail:aset_1",
      );
    });

    test("_clearTarifCache: Sukses membersihkan cache tarif saat tipe aset diubah", async () => {
      redis.scan.mockResolvedValueOnce(["0", ["tarif:list:tenant_1:{}"]]);

      await tipeAsetService._clearTarifCache(mockTenantID);

      expect(redis.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        `tarif:list:${mockTenantID}:*`,
        "COUNT",
        100,
      );
      expect(redis.del).toHaveBeenCalledWith("tarif:list:tenant_1:{}");
    });

    test("Tidak memanggil redis.del jika scan tidak menemukan key", async () => {
      redis.scan.mockResolvedValueOnce(["0", []]);

      await tipeAsetService.clearCache(mockTenantID);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe("Method: _formatOutput", () => {
    test("Sukses memformat dokumen dan mengubah virtual field 'listTarif' menjadi 'dataTarif'", () => {
      const formatted = tipeAsetService._formatOutput(mockDoc);

      expect(formatted.namaTipeAset).toBe("Ruangan VIP");
      expect(formatted.listTarif).toBeUndefined(); // listTarif asli harus disembunyikan
      expect(formatted.dataTarif).toHaveLength(1);
      expect(formatted.dataTarif[0].namaTarif).toBe("Tarif Pagi");
    });

    test("Sukses menangani format jika listTarif kosong atau undefined", () => {
      const docTanpaTarif = { ...mockDoc, listTarif: null };
      const formatted = tipeAsetService._formatOutput(docTanpaTarif);

      expect(formatted.dataTarif).toEqual([]);
    });
  });

  describe("Method: getAll", () => {
    test("Gagal (Throw 400) jika tenantID tidak dikirim", async () => {
      await expect(tipeAsetService.getAll()).rejects.toThrow(
        /tenantID required/i,
      );
    });

    test("Sukses mengambil data dari Cache dan parsing JSON", async () => {
      redis.get.mockResolvedValue(JSON.stringify([mockDoc]));

      const query = { namaTipeAset: "VIP" };
      const expectedFilterKey = JSON.stringify({
        tenantID: mockTenantID,
        namaTipeAset: "VIP",
      });

      const result = await tipeAsetService.getAll(mockTenantID, query);

      expect(redis.get).toHaveBeenCalledWith(
        `tipeAset:list:${mockTenantID}:${expectedFilterKey}`,
      );
      expect(result).toHaveLength(1);
      expect(TipeAset.find).not.toHaveBeenCalled();
    });

    test("Sukses (Cache Miss) mengambil data dari DB, menerapkan filter regex, dan menyimpan ke Cache", async () => {
      redis.get.mockResolvedValue(null);
      TipeAset.find.mockReturnValue(mockChain([mockDoc]));

      await tipeAsetService.getAll(mockTenantID, { namaTipeAset: "Ruang" });

      // Verifikasi Regex terbentuk dengan benar
      expect(TipeAset.find).toHaveBeenCalledWith({
        tenantID: mockTenantID,
        namaTipeAset: { $regex: "Ruang", $options: "i" },
      });
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe("Method: getById", () => {
    test("Sukses (Cache Hit) mengembalikan data jika tenantID cocok", async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockDoc));
      const result = await tipeAsetService.getById("aset_1", mockTenantID);
      expect(result._id).toBe("aset_1");
    });

    test("Gagal (Return null) dari cache jika tenantID tidak cocok (Isolasi Tenant)", async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockDoc));
      const result = await tipeAsetService.getById("aset_1", "tenant_hacker");
      expect(result).toBeNull();
    });

    test("Sukses (Cache Miss) mengambil data dari DB dengan lean virtuals dan menyimpan ke Cache", async () => {
      redis.get.mockResolvedValue(null);

      // Mocking spesifik untuk chain .populate().lean()
      TipeAset.findOne.mockReturnValue(mockChain(mockDoc));

      const result = await tipeAsetService.getById("aset_1", mockTenantID);

      expect(TipeAset.findOne).toHaveBeenCalledWith({
        _id: "aset_1",
        tenantID: mockTenantID,
      });
      expect(redis.set).toHaveBeenCalled();
      expect(result._id).toBe("aset_1");
    });
  });

  describe("Method: create", () => {
    const validPayload = {
      tenantID: mockTenantID,
      namaTipeAset: "Ruangan VIP",
    };

    beforeEach(() => {
      validateTipeAsetPayload.mockReturnValue({ valid: true });
      jest.spyOn(tipeAsetService, "clearCache").mockResolvedValue();
    });

    test("Gagal jika validasi payload tidak lolos", async () => {
      validateTipeAsetPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid"],
      });
      const result = await tipeAsetService.create({});
      expect(result.error).toEqual(["Invalid"]);
    });

    test("Sukses membuat tipe aset ke DB, clear cache, dan mereturn data hasil populate", async () => {
      TipeAset.create.mockResolvedValue({ _id: "aset_new" });
      TipeAset.findById.mockReturnValue(
        mockChain({ ...mockDoc, _id: "aset_new" }),
      );

      const result = await tipeAsetService.create(validPayload);

      expect(TipeAset.create).toHaveBeenCalledWith(validPayload);
      expect(tipeAsetService.clearCache).toHaveBeenCalledWith(mockTenantID);
      expect(result._id).toBe("aset_new");
    });

    test("Menangkap dan melempar (Throw 400) jika error duplicate namaTipeAset (11000)", async () => {
      const mongoError = new Error("Duplicate");
      mongoError.code = 11000;
      TipeAset.create.mockRejectedValue(mongoError);

      await expect(tipeAsetService.create(validPayload)).rejects.toThrow(
        /Nama tipe aset sudah digunakan/i,
      );
    });
  });

  describe("Method: update", () => {
    const updatePayload = { namaTipeAset: "Ruangan VVIP" };

    beforeEach(() => {
      validateTipeAsetPayload.mockReturnValue({ valid: true });
      jest.spyOn(tipeAsetService, "clearCache").mockResolvedValue();
      jest.spyOn(tipeAsetService, "_clearTarifCache").mockResolvedValue();
    });

    test("Gagal jika payload update tidak valid", async () => {
      validateTipeAsetPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid"],
      });
      const result = await tipeAsetService.update(
        "aset_1",
        mockTenantID,
        updatePayload,
      );
      expect(result.error).toEqual(["Invalid"]);
    });

    test("Sukses memperbarui data, membersihkan cache tipeAset, dan MENSINKRONKAN cache tarif", async () => {
      TipeAset.findOneAndUpdate.mockReturnValue(mockChain(mockDoc));

      const result = await tipeAsetService.update(
        "aset_1",
        mockTenantID,
        updatePayload,
      );

      expect(TipeAset.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "aset_1", tenantID: mockTenantID },
        updatePayload,
        expect.any(Object),
      );

      // Verifikasi bahwa DUA jenis cache dibersihkan
      expect(tipeAsetService.clearCache).toHaveBeenCalledWith(
        mockTenantID,
        "aset_1",
      );
      expect(tipeAsetService._clearTarifCache).toHaveBeenCalledWith(
        mockTenantID,
      );
      expect(result._id).toBe("aset_1");
    });

    test("Mengembalikan null jika tipe aset tidak ditemukan saat diupdate", async () => {
      TipeAset.findOneAndUpdate.mockReturnValue(mockChain(null));
      const result = await tipeAsetService.update(
        "invalid_id",
        mockTenantID,
        updatePayload,
      );
      expect(result).toBeNull();
    });
  });

  describe("Method: delete", () => {
    beforeEach(() => {
      jest.spyOn(tipeAsetService, "clearCache").mockResolvedValue();
      jest.spyOn(tipeAsetService, "_clearTarifCache").mockResolvedValue();
    });

    test("Mengembalikan null jika dokumen tidak ditemukan di DB", async () => {
      TipeAset.deleteOne.mockResolvedValue({ deletedCount: 0 });
      const result = await tipeAsetService.delete("aset_1", mockTenantID);
      expect(result).toBeNull();
    });

    test("Sukses menghapus data, mencabut relasi tarif ($pull), dan membersihkan kedua cache", async () => {
      TipeAset.deleteOne.mockResolvedValue({ deletedCount: 1 });
      Tarif.updateMany.mockResolvedValue({ modifiedCount: 2 }); // Simulasi ada 2 tarif yang tercabut

      const result = await tipeAsetService.delete("aset_1", mockTenantID);

      // 1. Dihapus dari tabel Tipe Aset
      expect(TipeAset.deleteOne).toHaveBeenCalledWith({
        _id: "aset_1",
        tenantID: mockTenantID,
      });

      // 2. Dicabut dari tabel Tarif (Sinkronisasi Relasi)
      expect(Tarif.updateMany).toHaveBeenCalledWith(
        { tenantID: mockTenantID, tipeAsetID: "aset_1" },
        { $pull: { tipeAsetID: "aset_1" } },
      );

      // 3. Cache dibersihkan
      expect(tipeAsetService.clearCache).toHaveBeenCalledWith(
        mockTenantID,
        "aset_1",
      );
      expect(tipeAsetService._clearTarifCache).toHaveBeenCalledWith(
        mockTenantID,
      );

      expect(result).toBe(true);
    });
  });
});
