const tenantService = require("../../../services/tenantService");
const Tenant = require("../../../models/tenantModel");
const Akun = require("../../../models/akunModel");
const Role = require("../../../models/roleModel");
const Permission = require("../../../models/permissionModel");
const redis = require("../../../config/redis");
const { validateTenantPayload } = require("../../../validators/tenantValidator");

// mocking semua dependensi agar isolasi murni
jest.mock("../../../models/tenantModel");
jest.mock("../../../models/akunModel");
jest.mock("../../../models/roleModel");
jest.mock("../../../models/penggunaModel");
jest.mock("../../../models/permissionModel");
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));
jest.mock("../../../validators/tenantValidator", () => ({
  validateTenantPayload: jest.fn(),
}));

describe("Unit Test Tenant Service", () => {
  
  // helper untuk meniru rantai kueri mongoose
  const mockMongooseChain = (val) => ({
    lean: jest.fn().mockResolvedValue(val),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Fungsi getAll dan getById (Caching)", () => {
    test("getAll: harus ambil dari redis jika cache tersedia", async () => {
      redis.get.mockResolvedValue(JSON.stringify([{ namaToko: "Toko Cache" }]));
      
      const result = await tenantService.getAll();
      
      expect(result[0].namaToko).toBe("Toko Cache");
      expect(Tenant.find).not.toHaveBeenCalled();
    });

    test("getById: harus simpan ke redis setelah miss di cache", async () => {
      redis.get.mockResolvedValue(null);
      Tenant.findById.mockReturnValue(mockMongooseChain({ _id: "t1", namaToko: "Toko DB" }));

      await tenantService.getById("t1");

      expect(redis.set).toHaveBeenCalled();
    });

    test("getAll: harus mengambil dari DB dan menyimpan ke redis jika cache kosong (Cache Miss)", async () => {
      redis.get.mockResolvedValue(null);
      Tenant.find.mockReturnValue(mockMongooseChain([{ _id: "t1", namaToko: "Toko DB" }]));

      const result = await tenantService.getAll();

      expect(Tenant.find).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith("tenants:all", expect.any(String), "EX", 60);
      expect(result[0].namaToko).toBe("Toko DB");
    });

    test("getById: harus mengembalikan null dengan aman jika tenant tidak ada di Cache maupun DB", async () => {
      redis.get.mockResolvedValue(null);
      Tenant.findById.mockReturnValue(mockMongooseChain(null));

      const result = await tenantService.getById("id_hantu");

      expect(result).toBeNull();
      expect(redis.set).not.toHaveBeenCalled(); // Jangan cache kehampaan
    });
  });

  describe("Fungsi createWithOwner (Atomic Operation & Rollback)", () => {
    test("harus sukses menjalankan setup awal (Tenant -> Role -> Update Akun)", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Akun.findById.mockResolvedValue({ _id: "akun_1" });
      Permission.find.mockResolvedValue([{ _id: "p1" }]);
      
      // mock constructor tenant dan role
      Tenant.prototype.save = jest.fn().mockResolvedValue({ _id: "t1" });
      Role.prototype.save = jest.fn().mockResolvedValue(true);
      Akun.findByIdAndUpdate.mockResolvedValue({ _id: "akun_1", tenantID: "t1" });

      const result = await tenantService.createWithOwner({ namaToko: "Baru" }, "akun_1");

      expect(result.tenant).toBeDefined();
      expect(Akun.findByIdAndUpdate).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith("tenants:all");
    });

    test("harus melakukan rollback (hapus tenant) jika pembuatan Role gagal", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Akun.findById.mockResolvedValue({ _id: "akun_1" });
      
      const mockTenant = { _id: "t1", save: jest.fn().mockResolvedValue(true) };
      Tenant.mockImplementation(() => mockTenant);
      
      // simulasi gagal di tahap cari permission
      Permission.find.mockRejectedValue(new Error("DB Error"));
      Tenant.deleteOne = jest.fn().mockResolvedValue(true);

      await expect(tenantService.createWithOwner({ n: "A" }, "akun_1")).rejects.toThrow();
      
      // pastikan tenant yang sempat dibuat langsung dihapus kembali
      expect(Tenant.deleteOne).toHaveBeenCalledWith({ _id: "t1" });
    });

    test("harus langsung melempar error 400 jika payload tidak lolos validasi", async () => {
      validateTenantPayload.mockReturnValue({ valid: false, errors: ["Nama toko wajib diisi"] });

      await expect(tenantService.createWithOwner({}, "akun_1")).rejects.toThrow(/Nama toko wajib diisi/i);
      expect(Akun.findById).not.toHaveBeenCalled(); // Eksekusi langsung berhenti
    });

    test("harus melempar error 404 jika ID Akun tidak ditemukan di database", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Akun.findById.mockResolvedValue(null);

      await expect(tenantService.createWithOwner({ namaToko: "X" }, "akun_hantu")).rejects.toThrow(/Akun tidak ditemukan/i);
    });

    test("harus melakukan rollback (hapus tenant dan role) jika update Akun gagal di tahap akhir", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Akun.findById.mockResolvedValue({ _id: "akun_1" });
      Permission.find.mockResolvedValue([{ _id: "p1" }]);
      
      const mockTenant = { _id: "t1", save: jest.fn().mockResolvedValue(true) };
      const mockRole = { _id: "r1", save: jest.fn().mockResolvedValue(true) };
      
      Tenant.mockImplementation(() => mockTenant);
      Role.mockImplementation(() => mockRole);
      
      // Simulasi update akun mengembalikan null (gagal)
      Akun.findByIdAndUpdate.mockResolvedValue(null);
      
      Tenant.deleteOne = jest.fn().mockResolvedValue(true);
      Role.deleteOne = jest.fn().mockResolvedValue(true);

      await expect(tenantService.createWithOwner({ namaToko: "A" }, "akun_1")).rejects.toThrow(/Gagal mengupdate akun/i);
      
      expect(Tenant.deleteOne).toHaveBeenCalledWith({ _id: "t1" });
      expect(Role.deleteOne).toHaveBeenCalledWith({ _id: "r1" });
    });
  });

  describe("Fungsi forceDelete", () => {
    test("harus hapus semua relasi dan reset tenantID di model Akun", async () => {
      const tenantID = "toko_mati";
      
      await tenantService.forceDelete(tenantID);

      expect(Tenant.findByIdAndDelete).toHaveBeenCalledWith(tenantID);
      // memastikan akun pemilik di-reset menjadi null agar tidak error saat login
      expect(Akun.updateMany).toHaveBeenCalledWith(
        { tenantID }, 
        { $set: { tenantID: null } }
      );
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe("Fungsi update", () => {
    test("harus sukses update dan bersihkan cache", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Tenant.findByIdAndUpdate.mockReturnValue(mockMongooseChain({ _id: "t1", namaToko: "Reborn" }));

      const result = await tenantService.update("t1", { namaToko: "Reborn" });

      expect(result.namaToko).toBe("Reborn");
      expect(redis.del).toHaveBeenCalledTimes(2); // hapus cache list dan cache detail
    });

    test("harus melempar error jika payload tidak valid", async () => {
      validateTenantPayload.mockReturnValue({ valid: false, errors: ["Nama toko wajib"] });

      await expect(tenantService.update("t1", {})).rejects.toThrow("Nama toko wajib");
    });

    test("harus mengembalikan null secara aman jika tenant yang ingin diupdate tidak ditemukan di DB", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Tenant.findByIdAndUpdate.mockReturnValue(mockMongooseChain(null));

      const result = await tenantService.update("toko_hilang", { namaToko: "Baru" });

      expect(result).toBeNull();
      expect(redis.del).not.toHaveBeenCalled(); // Tidak ada gunanya menghapus cache jika data tidak berubah
    });
  });
});