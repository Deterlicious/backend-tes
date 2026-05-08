const tenantService = require("../../../services/tenantService");
const Tenant = require("../../../models/tenantModel");
const Akun = require("../../../models/akunModel");
const Role = require("../../../models/roleModel");
const Permission = require("../../../models/permissionModel");
const redis = require("../../../config/redis");
const Pengguna = require("../../../models/penggunaModel");
const {
  validateTenantPayload,
} = require("../../../validators/tenantValidator");

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

  // GET ALL DAN GET BY ID
  describe("Fungsi getAll dan getById (Caching)", () => {
    test("getAll: harus ambil dari redis jika cache tersedia", async () => {
      redis.get.mockResolvedValue(JSON.stringify([{ namaToko: "Toko Cache" }]));

      const result = await tenantService.getAll();

      expect(result[0].namaToko).toBe("Toko Cache");
      expect(Tenant.find).not.toHaveBeenCalled();
    });

    test("getById: harus simpan ke redis setelah miss di cache", async () => {
      redis.get.mockResolvedValue(null);
      Tenant.findById.mockReturnValue(
        mockMongooseChain({ _id: "t1", namaToko: "Toko DB" }),
      );

      await tenantService.getById("t1");

      expect(redis.set).toHaveBeenCalled();
    });

    test("getAll: harus mengambil dari DB dan menyimpan ke redis jika cache kosong (Cache Miss)", async () => {
      redis.get.mockResolvedValue(null);
      Tenant.find.mockReturnValue(
        mockMongooseChain([{ _id: "t1", namaToko: "Toko DB" }]),
      );

      const result = await tenantService.getAll();

      expect(Tenant.find).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(
        "tenants:all",
        expect.any(String),
        "EX",
        60,
      );
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

  // CREATE WITH OWNER
  describe("Fungsi createWithOwner (Atomic Operation & Rollback)", () => {
    test("harus sukses menjalankan setup awal (Tenant -> Role -> Update Akun)", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Akun.findById.mockResolvedValue({ _id: "akun_1" });
      Permission.find.mockResolvedValue([{ _id: "p1" }]);

      Tenant.prototype.save = jest.fn().mockResolvedValue({ _id: "t1" });
      Role.prototype.save = jest.fn().mockResolvedValue(true);
      Akun.findByIdAndUpdate.mockResolvedValue({
        _id: "akun_1",
        tenantID: "t1",
      });

      const result = await tenantService.createWithOwner(
        { namaToko: "Baru" },
        "akun_1",
      );

      expect(result.tenant).toBeDefined();
      expect(Akun.findByIdAndUpdate).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith("tenants:all");
    });

    // FIX: Tambahan skenario untuk Guard Baru (Akun sudah memiliki tenant)
    test("Gagal (400) jika akun sudah terikat dengan tenant lain (Guard Baru)", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      // Simulasi akun yang object-nya sudah memiliki tenantID
      Akun.findById.mockResolvedValue({ _id: "akun_1", tenantID: "toko_lama" });

      await expect(
        tenantService.createWithOwner({ namaToko: "Baru" }, "akun_1"),
      ).rejects.toThrow("Akun sudah memiliki tenant.");

      expect(Tenant.prototype.save).not.toHaveBeenCalled(); // Pastikan DB aman
    });

    // FIX: Tambahan skenario untuk Guard Baru (System Permission Kosong)
    test("Gagal (500) jika system permission di database kosong (Guard Baru)", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Akun.findById.mockResolvedValue({ _id: "akun_1" });
      // Simulasi database permission belum di-seeding (kosong)
      Permission.find.mockResolvedValue([]);

      await expect(
        tenantService.createWithOwner({ namaToko: "Baru" }, "akun_1"),
      ).rejects.toThrow(
        "System permission kosong. Tambahkan permission terlebih dahulu.",
      );
    });

    test("harus melakukan rollback (hapus tenant) jika pembuatan Role gagal", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Akun.findById.mockResolvedValue({ _id: "akun_1" });

      // FIX 1: Biarkan pengecekan permission pertama berhasil agar sistem masuk ke blok try {...}
      Permission.find.mockResolvedValue([{ _id: "p1" }]);

      const mockTenant = { _id: "t1", save: jest.fn().mockResolvedValue(true) };
      Tenant.mockImplementation(() => mockTenant);

      // FIX 2: Buat ledakan (error) terjadi saat proses save Role, sesuai dengan judul skenario
      Role.prototype.save = jest
        .fn()
        .mockRejectedValue(new Error("Role DB Error"));

      Tenant.deleteOne = jest.fn().mockResolvedValue(true);

      await expect(
        tenantService.createWithOwner({ n: "A" }, "akun_1"),
      ).rejects.toThrow();

      // Pastikan tenant yang sempat dibuat langsung dihapus kembali
      expect(Tenant.deleteOne).toHaveBeenCalledWith({ _id: "t1" });
    });

    test("harus langsung melempar error 400 jika payload tidak lolos validasi", async () => {
      validateTenantPayload.mockReturnValue({
        valid: false,
        errors: ["Nama toko wajib diisi"],
      });

      await expect(tenantService.createWithOwner({}, "akun_1")).rejects.toThrow(
        /Nama toko wajib diisi/i,
      );
      expect(Akun.findById).not.toHaveBeenCalled();
    });

    test("harus melempar error 404 jika ID Akun tidak ditemukan di database", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Akun.findById.mockResolvedValue(null);

      await expect(
        tenantService.createWithOwner({ namaToko: "X" }, "akun_hantu"),
      ).rejects.toThrow(/Akun tidak ditemukan/i);
    });

    test("harus melakukan rollback (hapus tenant dan role) jika update Akun gagal di tahap akhir", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Akun.findById.mockResolvedValue({ _id: "akun_1" });
      Permission.find.mockResolvedValue([{ _id: "p1" }]);

      const mockTenant = { _id: "t1", save: jest.fn().mockResolvedValue(true) };
      const mockRole = { _id: "r1", save: jest.fn().mockResolvedValue(true) };

      Tenant.mockImplementation(() => mockTenant);
      Role.mockImplementation(() => mockRole);

      Akun.findByIdAndUpdate.mockResolvedValue(null);

      Tenant.deleteOne = jest.fn().mockResolvedValue(true);
      Role.deleteOne = jest.fn().mockResolvedValue(true);

      await expect(
        tenantService.createWithOwner({ namaToko: "A" }, "akun_1"),
      ).rejects.toThrow(/Gagal mengupdate akun/i);

      expect(Tenant.deleteOne).toHaveBeenCalledWith({ _id: "t1" });
      expect(Role.deleteOne).toHaveBeenCalledWith({ _id: "r1" });
    });

    test("harus memanggil redis.del setelah createWithOwner sukses", async () => {
      // setup mock sukses penuh
      Akun.findById.mockResolvedValue({ _id: "akun_123", tenantID: null });
      Permission.find.mockResolvedValue([{ _id: "perm_1" }, { _id: "perm_2" }]);

      const mockTenant = {
        _id: "tenant_123",
        save: jest.fn().mockResolvedValue(true),
      };
      const mockRole = {
        _id: "role_123",
        save: jest.fn().mockResolvedValue(true),
      };
      const mockUpdatedAkun = { _id: "akun_123", tenantID: "tenant_123" };

      Tenant.mockImplementation(() => mockTenant);
      Role.mockImplementation(() => mockRole);
      Akun.findByIdAndUpdate.mockResolvedValue(mockUpdatedAkun);
      redis.del.mockResolvedValue(true);

      await tenantService.createWithOwner(
        { namaToko: "Toko Baru" },
        "akun_123",
      );

      expect(redis.del).toHaveBeenCalledWith("tenants:all");
    });
  });

  // DELETE TENANT
  // FIX: Mengganti nama describe dan fungsi menjadi delete() sesuai service terbaru
  describe("Fungsi delete()", () => {
    test("harus hapus secara cascade (Role, Pengguna, Tenant) dan reset tenantID Akun", async () => {
      const tenantID = "toko_mati";

      await tenantService.delete(tenantID);

      // FIX: Memastikan seluruh metode pembersihan relasi (Cascade Delete) benar-benar terpanggil
      expect(Role.deleteMany).toHaveBeenCalledWith({ tenantID });
      expect(Pengguna.deleteMany).toHaveBeenCalledWith({ tenantID });
      expect(Tenant.findByIdAndDelete).toHaveBeenCalledWith(tenantID);

      expect(Akun.updateMany).toHaveBeenCalledWith(
        { tenantID },
        { $set: { tenantID: null } },
      );
      expect(redis.del).toHaveBeenCalled(); // Cache ALL
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining("tenants:toko_mati"),
      ); // Cache ID
    });

    test("harus memanggil Akun.updateMany dengan tenantID null untuk reset ghost data", async () => {
      Role.deleteMany.mockResolvedValue(true);
      Pengguna.deleteMany.mockResolvedValue(true);
      Tenant.findByIdAndDelete.mockResolvedValue(true);
      Akun.updateMany.mockResolvedValue(true);
      redis.del.mockResolvedValue(true);

      await tenantService.delete("tenant_123");

      // verifikasi perubahan baru dari laporan — reset tenantID di Akun
      expect(Akun.updateMany).toHaveBeenCalledWith(
        { tenantID: "tenant_123" },
        { $set: { tenantID: null } },
      );
    });

    test("harus tetap menyelesaikan cascade meski tidak ada Role atau Pengguna yang dihapus", async () => {
      Role.deleteMany.mockResolvedValue({ deletedCount: 0 });
      Pengguna.deleteMany.mockResolvedValue({ deletedCount: 0 });
      Tenant.findByIdAndDelete.mockResolvedValue(null); // tenant tidak ditemukan di DB
      Akun.updateMany.mockResolvedValue(true);
      redis.del.mockResolvedValue(true);

      // harus resolve tanpa crash meski tidak ada yang dihapus
      await expect(tenantService.delete("tenant_ghost")).resolves.not.toThrow();
      expect(redis.del).toHaveBeenCalled();
    });
  });

  // UPDATE TENANT
  describe("Fungsi update", () => {
    test("harus sukses update dan bersihkan cache", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Tenant.findByIdAndUpdate.mockReturnValue(
        mockMongooseChain({ _id: "t1", namaToko: "Reborn" }),
      );

      const result = await tenantService.update("t1", { namaToko: "Reborn" });

      expect(result.namaToko).toBe("Reborn");
      expect(redis.del).toHaveBeenCalledTimes(2); // hapus cache list dan cache detail
    });

    test("harus melempar error jika payload tidak valid", async () => {
      validateTenantPayload.mockReturnValue({
        valid: false,
        errors: ["Nama toko wajib"],
      });

      await expect(tenantService.update("t1", {})).rejects.toThrow(
        "Nama toko wajib",
      );
    });

    test("harus mengembalikan null secara aman jika tenant yang ingin diupdate tidak ditemukan di DB", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Tenant.findByIdAndUpdate.mockReturnValue(mockMongooseChain(null));

      const result = await tenantService.update("toko_hilang", {
        namaToko: "Baru",
      });

      expect(result).toBeNull();
      expect(redis.del).not.toHaveBeenCalled(); // Tidak ada gunanya menghapus cache jika data tidak berubah
    });

    test("harus melempar error sistem jika Redis crash setelah DB berhasil diupdate", async () => {
      Tenant.findByIdAndUpdate.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue({ _id: "tenant_123", namaToko: "Toko Baru" }),
      });
      redis.del.mockRejectedValue(
        new Error("Redis Timeout during Cache Invalidation"),
      );

      await expect(
        tenantService.update("tenant_123", { namaToko: "Toko Baru" }),
      ).rejects.toThrow("Redis Timeout");
    });
  });

  // DISASTER RECOVERY (Simulasi Bencana Infrastruktur)
  describe("Simulasi Bencana Infrastruktur (Disaster Recovery)", () => {
    test("getAll: Harus melempar error sistem jika Redis mati mendadak (Crash)", async () => {
      redis.get.mockRejectedValue(new Error("Redis connection timeout"));

      await expect(tenantService.getAll()).rejects.toThrow(
        "Redis connection timeout",
      );
      expect(Tenant.find).not.toHaveBeenCalled(); // DB tidak disentuh jika Redis error
    });

    test("getById: Harus melempar error sistem jika MongoDB mati mendadak", async () => {
      redis.get.mockResolvedValue(null);
      Tenant.findById.mockReturnValue({
        lean: jest
          .fn()
          .mockRejectedValue(new Error("MongoNetworkError: connection closed")),
      });

      await expect(tenantService.getById("t1")).rejects.toThrow(
        "MongoNetworkError",
      );
    });

    test("createWithOwner: Harus aman saat MongoDB crash tepat ketika menyimpan Tenant awal", async () => {
      validateTenantPayload.mockReturnValue({ valid: true });
      Akun.findById.mockResolvedValue({ _id: "akun_1" });
      Permission.find.mockResolvedValue([{ _id: "p1" }]);

      // FIX: Gunakan mockImplementation agar tidak terkontaminasi oleh mock dari test case sebelumnya
      const mockTenantBencana = {
        _id: "t1",
        save: jest.fn().mockRejectedValue(new Error("Database Write Error")),
      };
      Tenant.mockImplementation(() => mockTenantBencana);

      Tenant.deleteOne = jest.fn().mockResolvedValue(true);

      await expect(
        tenantService.createWithOwner({ namaToko: "Toko Bencana" }, "akun_1"),
      ).rejects.toThrow("Database Write Error");

      // Rollback tetap harus dipanggil untuk membersihkan sisa instansiasi
      expect(Tenant.deleteOne).toHaveBeenCalledWith({ _id: "t1" });
    });
  });
});
