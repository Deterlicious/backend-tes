const metodePembayaranService = require("../../../services/metodePembayaranService");
const MetodePembayaran = require("../../../models/metodePembayaranModel");
const AkunKas = require("../../../models/akunKasModel");
const redis = require("../../../config/redis");

const {
  validateMetodePembayaranPayload,
} = require("../../../validators/metodePembayaranValidator");

jest.mock("../../../models/metodePembayaranModel");
jest.mock("../../../models/akunKasModel");

jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

jest.mock("../../../validators/metodePembayaranValidator", () => ({
  validateMetodePembayaranPayload: jest.fn(),
}));

describe("Unit Test — Service — MetodePembayaran", () => {
  const mockDoc = {
    _id: "metode_1",
    tenantID: "tenant_1",
    namaPembayaran: "QRIS",
    kategori: "non-tunai",
    isAutomated: true,
    xenditChannelCode: "QRIS",
    isActive: true,
    akunKasID: {
      _id: "kas_1",
      namaAkun: "BCA",
      nomorAkun: "123",
    },
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

  describe("Method: _formatOutput", () => {
    test("Sukses memformat dokumen tunggal", () => {
      const result = metodePembayaranService._formatOutput(mockDoc);
      expect(result.namaPembayaran).toBe("QRIS");
      expect(result.dataAkunKas.namaAkun).toBe("BCA");
    });

    test("Sukses memformat array dokumen", () => {
      const result = metodePembayaranService._formatOutput([mockDoc]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    test("Mengembalikan null jika dokumen kosong", () => {
      const result = metodePembayaranService._formatOutput(null);
      expect(result).toBeNull();
    });

    test("Mengembalikan array kosong jika input array kosong", () => {
      const result = metodePembayaranService._formatOutput([]);
      expect(result).toEqual([]);
    });

    test("dataAkunKas bernilai null jika akunKasID hanya berupa string", () => {
      const result = metodePembayaranService._formatOutput({
        ...mockDoc,
        akunKasID: "id_only",
      });
      expect(result.dataAkunKas).toBeNull();
    });

    test("dataAkunKas bernilai null jika akunKasID undefined", () => {
      const result = metodePembayaranService._formatOutput({
        ...mockDoc,
        akunKasID: undefined,
      });
      expect(result.dataAkunKas).toBeNull();
    });

    test("dataAkunKas bernilai null jika akunKasID bernilai null dari DB (Edge Case)", () => {
      const result = metodePembayaranService._formatOutput({
        ...mockDoc,
        akunKasID: null,
      });
      expect(result.dataAkunKas).toBeNull();
    });

    test("xenditChannelCode fallback ke null jika undefined", () => {
      const result = metodePembayaranService._formatOutput({
        ...mockDoc,
        xenditChannelCode: undefined,
      });
      expect(result.xenditChannelCode).toBeNull();
    });
  });

  describe("Method: getAll", () => {
    test("Gagal (Throw 400) jika tenantID tidak dikirim", async () => {
      await expect(metodePembayaranService.getAll()).rejects.toThrow(
        /tenantID is required/i,
      );
    });

    test("Sukses (Cache Hit) mengembalikan data dari Redis", async () => {
      redis.get.mockResolvedValue(JSON.stringify([mockDoc]));
      const result = await metodePembayaranService.getAll("tenant_1");
      expect(result[0]._id).toBe("metode_1");
      expect(MetodePembayaran.find).not.toHaveBeenCalled();
    });

    test("Sukses (Cache Miss) mengambil data dari DB lalu cache", async () => {
      redis.get.mockResolvedValue(null);
      MetodePembayaran.find.mockReturnValue(mockChain([mockDoc]));
      const result = await metodePembayaranService.getAll("tenant_1");

      expect(MetodePembayaran.find).toHaveBeenCalledWith({
        tenantID: "tenant_1",
      });
      expect(redis.set).toHaveBeenCalledWith(
        "metodePembayaran:list:tenant_1",
        expect.any(String),
        "EX",
        300,
      );
      expect(result).toHaveLength(1);
    });

    test("Tidak melakukan cache jika data DB kosong", async () => {
      redis.get.mockResolvedValue(null);
      MetodePembayaran.find.mockReturnValue(mockChain([]));
      await metodePembayaranService.getAll("tenant_1");
      expect(redis.set).not.toHaveBeenCalled();
    });

    test("Mengembalikan array kosong jika DB kosong", async () => {
      redis.get.mockResolvedValue(null);
      MetodePembayaran.find.mockReturnValue(mockChain([]));
      const result = await metodePembayaranService.getAll("tenant_1");
      expect(result).toEqual([]);
    });

    test("Meneruskan throw error jika koneksi Redis gagal", async () => {
      redis.get.mockRejectedValue(new Error("Redis down"));
      await expect(metodePembayaranService.getAll("tenant_1")).rejects.toThrow(
        "Redis down",
      );
    });
  });

  describe("Method: getById", () => {
    test("Sukses (Cache Hit) mengembalikan data jika tenantID cocok", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({
          ...mockDoc,
          tenantID: "tenant_1",
        }),
      );
      const result = await metodePembayaranService.getById("id_1", "tenant_1");
      expect(result._id).toBe("metode_1");
    });

    test("Mengembalikan null (Cache Hit) jika tenantID berbeda", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({
          ...mockDoc,
          tenantID: "tenant_lain",
        }),
      );
      const result = await metodePembayaranService.getById("id_1", "tenant_1");
      expect(result).toBeNull();
    });

    test("Sukses (Cache Miss) mengambil data dari DB", async () => {
      redis.get.mockResolvedValue(null);
      MetodePembayaran.findOne.mockReturnValue(mockChain(mockDoc));
      const result = await metodePembayaranService.getById("id_1", "tenant_1");

      expect(MetodePembayaran.findOne).toHaveBeenCalledWith({
        _id: "id_1",
        tenantID: "tenant_1",
      });
      expect(redis.set).toHaveBeenCalled();
      expect(result._id).toBe("metode_1");
    });

    test("Mengembalikan null (Cache Miss) jika data DB kosong", async () => {
      redis.get.mockResolvedValue(null);
      MetodePembayaran.findOne.mockReturnValue(mockChain(null));
      const result = await metodePembayaranService.getById("id_1", "tenant_1");
      expect(result).toBeNull();
    });

    test("Tidak melakukan cache jika data tidak ditemukan di DB", async () => {
      redis.get.mockResolvedValue(null);
      MetodePembayaran.findOne.mockReturnValue(mockChain(null));
      await metodePembayaranService.getById("id_1", "tenant_1");
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe("Method: create", () => {
    const payload = {
      tenantID: "tenant_1",
      akunKasID: "kas_1",
      namaPembayaran: "QRIS",
      kategori: "non-tunai",
    };

    test("Gagal jika validasi payload gagal", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: false,
        errors: ["error"],
      });
      const result = await metodePembayaranService.create(payload);

      expect(result.error).toEqual(["error"]);
      expect(AkunKas.findOne).not.toHaveBeenCalled();
    });

    test("Gagal jika akunKas tidak ditemukan atau akses ditolak", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      AkunKas.findOne.mockResolvedValue(null);
      const result = await metodePembayaranService.create(payload);

      expect(result.error).toEqual([
        "ID Akun Kas tidak ditemukan atau akses ditolak.",
      ]);
    });

    test("Sukses membuat data baru dan membersihkan cache list", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      AkunKas.findOne.mockResolvedValue({
        _id: "kas_1",
      });
      MetodePembayaran.create.mockResolvedValue({
        _id: "metode_1",
      });
      MetodePembayaran.findOne.mockReturnValue(mockChain(mockDoc));

      const result = await metodePembayaranService.create(payload);

      expect(redis.del).toHaveBeenCalledWith("metodePembayaran:list:tenant_1");
      expect(redis.set).toHaveBeenCalled();
      expect(result.namaPembayaran).toBe("QRIS");
    });

    test("Memaksa xenditChannelCode menjadi null jika isAutomated dikirim sebagai false", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      AkunKas.findOne.mockResolvedValue(true);
      MetodePembayaran.create.mockResolvedValue({
        _id: "metode_1",
      });
      MetodePembayaran.findOne.mockReturnValue(mockChain(mockDoc));

      const payload2 = {
        ...payload,
        isAutomated: false,
        xenditChannelCode: "QRIS",
      };

      await metodePembayaranService.create(payload2);
      expect(payload2.xenditChannelCode).toBeNull();
    });

    test("Meneruskan throw error jika terjadi kegagalan DB saat create", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      AkunKas.findOne.mockResolvedValue(true);
      MetodePembayaran.create.mockRejectedValue(new Error("Database error"));

      await expect(metodePembayaranService.create(payload)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("Method: update", () => {
    test("Gagal jika validasi payload gagal saat update", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: false,
        errors: ["error update"],
      });
      const result = await metodePembayaranService.update(
        "id_1",
        {},
        "tenant_1",
      );

      expect(result.error).toEqual(["error update"]);
    });

    test("Gagal jika update menyertakan akunKas invalid", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      AkunKas.findOne.mockResolvedValue(null);
      const result = await metodePembayaranService.update(
        "id_1",
        {
          akunKasID: "invalid",
        },
        "tenant_1",
      );

      expect(result.error).toEqual(["ID Akun Kas tidak ditemukan."]);
    });

    test("Mengembalikan null jika data yang ingin diupdate tidak ditemukan", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      MetodePembayaran.findOneAndUpdate.mockReturnValue(mockChain(null));
      const result = await metodePembayaranService.update(
        "id_1",
        {},
        "tenant_1",
      );

      expect(result).toBeNull();
    });

    test("Sukses memperbarui data dan membersihkan cache", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      MetodePembayaran.findOneAndUpdate.mockReturnValue(mockChain(mockDoc));
      const result = await metodePembayaranService.update(
        "id_1",
        {
          namaPembayaran: "Baru",
        },
        "tenant_1",
      );

      expect(redis.del).toHaveBeenCalledTimes(2);
      expect(redis.set).toHaveBeenCalled();
      expect(result.namaPembayaran).toBe("QRIS");
    });

    test("Memaksa xenditChannelCode menjadi null jika isAutomated diupdate menjadi false", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      MetodePembayaran.findOneAndUpdate.mockReturnValue(mockChain(mockDoc));

      const payload = {
        isAutomated: false,
        xenditChannelCode: "QRIS",
      };

      await metodePembayaranService.update("id_1", payload, "tenant_1");
      expect(payload.xenditChannelCode).toBeNull();
    });

    test("TIDAK me-null-kan xenditChannelCode jika payload update tidak menyertakan isAutomated (Partial Update)", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      MetodePembayaran.findOneAndUpdate.mockReturnValue(mockChain(mockDoc));

      const payload = {
        namaPembayaran: "Ganti Nama Saja",
      };

      await metodePembayaranService.update("id_1", payload, "tenant_1");
      expect(payload.xenditChannelCode).toBeUndefined();
    });

    test("Mencegah perubahan tenantID melalui payload update", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      MetodePembayaran.findOneAndUpdate.mockReturnValue(mockChain(mockDoc));

      const payload = {
        tenantID: "tenant_hacker",
      };

      await metodePembayaranService.update("id_1", payload, "tenant_1");
      expect(payload.tenantID).toBeUndefined();
    });

    test("Melewati pengecekan DB AkunKas jika payload tidak memperbarui akunKasID", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      MetodePembayaran.findOneAndUpdate.mockReturnValue(mockChain(mockDoc));
      await metodePembayaranService.update(
        "id_1",
        {
          namaPembayaran: "Update Nama",
        },
        "tenant_1",
      );

      expect(AkunKas.findOne).not.toHaveBeenCalled();
    });

    test("Memastikan parameter EX 300 digunakan saat set Redis detail di fungsi update", async () => {
      validateMetodePembayaranPayload.mockReturnValue({ valid: true });
      MetodePembayaran.findOneAndUpdate.mockReturnValue(mockChain(mockDoc));

      await metodePembayaranService.update(
        "id_1",
        { namaPembayaran: "Baru" },
        "tenant_1",
      );

      expect(redis.set).toHaveBeenCalledWith(
        "metodePembayaran:detail:id_1",
        expect.any(String),
        "EX",
        300,
      );
    });

    test("Meneruskan throw error jika terjadi kegagalan DB saat update", async () => {
      validateMetodePembayaranPayload.mockReturnValue({
        valid: true,
      });
      MetodePembayaran.findOneAndUpdate.mockImplementation(() => {
        throw new Error("DB update error");
      });

      await expect(
        metodePembayaranService.update("id_1", {}, "tenant_1"),
      ).rejects.toThrow("DB update error");
    });
  });

  describe("Method: delete", () => {
    test("Sukses menghapus data dan membersihkan cache", async () => {
      MetodePembayaran.deleteOne.mockResolvedValue({
        deletedCount: 1,
      });
      const result = await metodePembayaranService.delete("id_1", "tenant_1");

      expect(redis.del).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });

    test("Mengembalikan null jika penghapusan gagal karena data tidak ada", async () => {
      MetodePembayaran.deleteOne.mockResolvedValue({
        deletedCount: 0,
      });
      const result = await metodePembayaranService.delete("id_1", "tenant_1");

      expect(result).toBeNull();
    });

    test("Meneruskan throw error jika terjadi kegagalan DB saat delete", async () => {
      MetodePembayaran.deleteOne.mockRejectedValue(
        new Error("Delete DB error"),
      );

      await expect(
        metodePembayaranService.delete("id_1", "tenant_1"),
      ).rejects.toThrow("Delete DB error");
    });
  });
});
