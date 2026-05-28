const mongoose = require("mongoose");
const akunKasService = require("../../../services/akunKasService");

const AkunKas = require("../../../models/akunKasModel");
const redis = require("../../../config/redis");
const {
  validateAkunKasPayload,
} = require("../../../validators/akunKasValidator");

jest.mock("../../../models/akunKasModel");
jest.mock("../../../validators/akunKasValidator");
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

describe("Unit Test — Service — Akun Kas", () => {
  const mockTenantID = new mongoose.Types.ObjectId().toString();
  const mockID = new mongoose.Types.ObjectId().toString();

  // Helper untuk Mongoose Chaining (.sort, .lean)
  const mockChain = (value) => ({
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock validasi selalu sukses
    validateAkunKasPayload.mockReturnValue({ valid: true });
  });

  describe("Fungsi Cache: clearCache", () => {
    test("Hanya menghapus key list jika parameter ID tidak dikirim", async () => {
      await akunKasService.clearCache(mockTenantID);
      expect(redis.del).toHaveBeenCalledWith([`akunkas:list:${mockTenantID}`]);
    });

    test("Menghapus key list dan key detail jika parameter ID dikirim", async () => {
      await akunKasService.clearCache(mockTenantID, mockID);
      expect(redis.del).toHaveBeenCalledWith([
        `akunkas:list:${mockTenantID}`,
        `akunkas:detail:${mockID}`,
      ]);
    });
  });

  describe("Method: getAll", () => {
    test("Gagal (Throw Error 400) jika tenantID tidak disertakan", async () => {
      await expect(akunKasService.getAll(null)).rejects.toThrow(
        /Tenant ID required/i,
      );
    });

    test("Sukses (Cache Hit) mengembalikan data langsung dari Redis", async () => {
      const mockData = [{ _id: mockID, namaAkun: "Kas 1" }];
      redis.get.mockResolvedValue(JSON.stringify(mockData));

      const res = await akunKasService.getAll(mockTenantID);

      expect(res).toEqual(mockData);
      expect(AkunKas.find).not.toHaveBeenCalled();
    });

    test("Sukses (Cache Miss) mengambil dari DB dan menyimpan ke Redis jika data ada", async () => {
      redis.get.mockResolvedValue(null);
      const mockData = [{ _id: mockID, namaAkun: "Kas 1" }];
      AkunKas.find.mockReturnValue(mockChain(mockData));

      const res = await akunKasService.getAll(mockTenantID);

      expect(AkunKas.find).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(
        `akunkas:list:${mockTenantID}`,
        JSON.stringify(mockData),
        "EX",
        300,
      );
      expect(res).toEqual(mockData);
    });

    test("Sukses (Cache Miss) mengambil dari DB namun TIDAK simpan ke Redis jika data kosong", async () => {
      redis.get.mockResolvedValue(null);
      AkunKas.find.mockReturnValue(mockChain([]));

      const res = await akunKasService.getAll(mockTenantID);

      expect(redis.set).not.toHaveBeenCalled();
      expect(res).toEqual([]);
    });
  });

  describe("Method: getById", () => {
    test("Sukses (Cache Hit) jika tenantID pada cache cocok dengan requester", async () => {
      const mockData = {
        _id: mockID,
        tenantID: mockTenantID,
        namaAkun: "Kas 1",
      };
      redis.get.mockResolvedValue(JSON.stringify(mockData));

      const res = await akunKasService.getById(mockID, mockTenantID);
      expect(res._id).toBe(mockID);
    });

    test("Gagal (Cache Hit) mengembalikan null jika tenantID pada cache TIDAK cocok (Isolasi Tenant)", async () => {
      const mockData = { _id: mockID, tenantID: mockTenantID };
      redis.get.mockResolvedValue(JSON.stringify(mockData));

      const res = await akunKasService.getById(mockID, "tenant_palsu");
      expect(res).toBeNull();
    });

    test("Sukses (Cache Miss) mengambil dari DB dan menyimpan ke Redis", async () => {
      redis.get.mockResolvedValue(null);
      const mockData = { _id: mockID, tenantID: mockTenantID };
      AkunKas.findOne.mockReturnValue(mockChain(mockData));

      const res = await akunKasService.getById(mockID, mockTenantID);

      expect(AkunKas.findOne).toHaveBeenCalledWith({
        _id: mockID,
        tenantID: mockTenantID,
      });
      expect(redis.set).toHaveBeenCalled();
      expect(res).toEqual(mockData);
    });

    test("Gagal (Cache Miss) mengembalikan null jika data tidak ditemukan di DB", async () => {
      redis.get.mockResolvedValue(null);
      AkunKas.findOne.mockReturnValue(mockChain(null));

      const res = await akunKasService.getById(mockID, mockTenantID);
      expect(res).toBeNull();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe("Method: create", () => {
    const payload = {
      namaAkun: "Kas Baru",
      nomorAkun: "123",
      tenantID: mockTenantID,
    };

    test("Gagal jika payload tidak lolos validator", async () => {
      validateAkunKasPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid Field"],
      });
      const res = await akunKasService.create(payload);
      expect(res.error).toEqual(["Invalid Field"]);
    });

    test("Sukses membuat akun kas baru dan menghapus list cache", async () => {
      const mockCreated = { _id: mockID, ...payload };
      AkunKas.create.mockResolvedValue(mockCreated);
      jest.spyOn(akunKasService, "clearCache").mockResolvedValue();

      const res = await akunKasService.create(payload);

      expect(AkunKas.create).toHaveBeenCalledWith(payload);
      expect(akunKasService.clearCache).toHaveBeenCalledWith(mockTenantID);
      expect(res).toEqual(mockCreated);
    });

    test("Gagal (Throw Error 400) jika ada konflik Duplicate Key (error 11000 Mongoose)", async () => {
      const duplicateError = new Error("Duplicate");
      duplicateError.code = 11000;
      AkunKas.create.mockRejectedValue(duplicateError);

      await expect(akunKasService.create(payload)).rejects.toThrow(
        /Nomor Akun sudah digunakan/i,
      );
    });

    test("Meneruskan Error sistem selain dari error duplikat", async () => {
      const dbError = new Error("Database Crash");
      AkunKas.create.mockRejectedValue(dbError);

      await expect(akunKasService.create(payload)).rejects.toThrow(
        /Database Crash/i,
      );
    });
  });

  describe("Method: update", () => {
    const payload = { namaAkun: "Kas Update", tenantID: mockTenantID };

    test("Gagal jika payload tidak lolos validator update", async () => {
      validateAkunKasPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid Update"],
      });
      const res = await akunKasService.update(mockID, payload, mockTenantID);
      expect(res.error).toEqual(["Invalid Update"]);
    });

    test("Mengembalikan null jika data yang ingin diupdate tidak ditemukan", async () => {
      AkunKas.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }); // Chain .lean()

      const res = await akunKasService.update(mockID, payload, mockTenantID);
      expect(res).toBeNull();
    });

    test("Sukses update data, menghapus tenantID dari payload update, dan memanggil clearCache", async () => {
      const mockUpdated = { _id: mockID, namaAkun: "Kas Update" };
      AkunKas.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUpdated),
      });
      jest.spyOn(akunKasService, "clearCache").mockResolvedValue();

      const res = await akunKasService.update(mockID, payload, mockTenantID);

      expect(AkunKas.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockID, tenantID: mockTenantID },
        { namaAkun: "Kas Update" }, // tenantID dihapus di fungsi
        { new: true, runValidators: true },
      );
      expect(akunKasService.clearCache).toHaveBeenCalledWith(
        mockTenantID,
        mockID,
      );
      expect(res).toEqual(mockUpdated);
    });

    test("Gagal (Throw Error 400) jika update memicu konflik Duplicate Key (error 11000 Mongoose)", async () => {
      const duplicateError = new Error("Duplicate");
      duplicateError.code = 11000;
      AkunKas.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockRejectedValue(duplicateError),
      });

      await expect(
        akunKasService.update(mockID, payload, mockTenantID),
      ).rejects.toThrow(/Nomor Akun sudah digunakan/i);
    });

    test("Meneruskan Error sistem selain dari error duplikat saat update", async () => {
      const dbError = new Error("Database Crash");
      AkunKas.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockRejectedValue(dbError),
      });

      await expect(
        akunKasService.update(mockID, payload, mockTenantID),
      ).rejects.toThrow(/Database Crash/i);
    });
  });

  describe("Method: delete", () => {
    test("Mengembalikan null jika tidak ada data yang terhapus (deletedCount: 0)", async () => {
      AkunKas.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const res = await akunKasService.delete(mockID, mockTenantID);
      expect(res).toBeNull();
    });

    test("Sukses menghapus data dan memanggil clearCache (deletedCount > 0)", async () => {
      AkunKas.deleteOne.mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(akunKasService, "clearCache").mockResolvedValue();

      const res = await akunKasService.delete(mockID, mockTenantID);

      expect(AkunKas.deleteOne).toHaveBeenCalledWith({
        _id: mockID,
        tenantID: mockTenantID,
      });
      expect(akunKasService.clearCache).toHaveBeenCalledWith(
        mockTenantID,
        mockID,
      );
      expect(res).toBe(true);
    });
  });
});
