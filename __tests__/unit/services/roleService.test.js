const roleService = require("../../../services/roleService");
const Role = require("../../../models/roleModel");
const Permission = require("../../../models/permissionModel");
const redis = require("../../../config/redis");
const { validateRolePayload } = require("../../../validators/roleValidator");
const mongoose = require("mongoose");
const Pengguna = require("../../../models/penggunaModel");

jest.mock("../../../models/penggunaModel");
jest.mock("../../../models/roleModel");
jest.mock("../../../models/permissionModel");
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));
jest.mock("../../../validators/roleValidator");

describe("Unit Test Service — RoleService", () => {
  const mockTenantID = new mongoose.Types.ObjectId().toString();
  const mockRoleID = new mongoose.Types.ObjectId().toString();
  const mockPermissionID1 = new mongoose.Types.ObjectId().toString();
  const mockPermissionID2 = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Method: _processPermissions", () => {
    test("Skenario 1 — Gagal jika permissions bukan array", async () => {
      await expect(
        roleService._processPermissions("bukan_array"),
      ).rejects.toMatchObject({
        status: 400,
        message: "Field 'permissions' harus berupa array",
      });
    });

    test("Skenario 2 — Gagal jika permissions array kosong", async () => {
      await expect(roleService._processPermissions([])).rejects.toMatchObject({
        status: 400,
        message: "Field 'permissions' tidak boleh kosong",
      });
    });

    test("Skenario 3 — Gagal jika format permission tidak valid", async () => {
      // Fallback mock untuk mencegah TypeError jika Mongoose lolos mengevaluasi input
      Permission.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      // Gunakan tipe data boolean dan array kosong yang mutlak ditolak oleh ObjectId.isValid
      await expect(
        roleService._processPermissions([true, []]),
      ).rejects.toMatchObject({
        status: 400,
        message: "Format permission tidak valid",
      });
    });

    test("Skenario 4 — Gagal jika ObjectId permission tidak ditemukan di database", async () => {
      Permission.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      await expect(
        roleService._processPermissions([mockPermissionID1]),
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("Permission ID tidak ditemukan"),
      });
    });

    test("Skenario 5 — Gagal jika Slug/Nama permission tidak ditemukan di database", async () => {
      Permission.find.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            { _id: mockPermissionID1, nama: "baca_laporan" },
          ]),
      });
      await expect(
        roleService._processPermissions(["baca_laporan", "hapus_data"]),
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining(
          "Permission tidak ditemukan: hapus_data",
        ),
      });
    });

    test("Skenario 6 — Berhasil memproses campuran ObjectId dan Slug menjadi array ObjectId unik", async () => {
      Permission.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: mockPermissionID1 }),
      });
      Permission.find.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            { _id: mockPermissionID2, nama: "tulis_laporan" },
          ]),
      });

      const result = await roleService._processPermissions([
        mockPermissionID1,
        "tulis_laporan",
        mockPermissionID1,
      ]);

      expect(result).toHaveLength(2);
      expect(result).toContain(mockPermissionID1);
      expect(result).toContain(mockPermissionID2);
    });
  });

  describe("Method: getAll", () => {
    test("Skenario 7 — Gagal jika tenantID tidak diberikan", async () => {
      await expect(roleService.getAll(null)).rejects.toMatchObject({
        status: 400,
      });
    });

    test("Skenario 8 — Berhasil mengembalikan data dari cache Redis", async () => {
      const cachedData = [{ namaRole: "Admin" }];
      redis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await roleService.getAll(mockTenantID);
      expect(result).toEqual(cachedData);
      expect(Role.find).not.toHaveBeenCalled();
    });

    test("Skenario 9 — Berhasil mengambil dari database, set cache, dan return", async () => {
      redis.get.mockResolvedValue(null);
      const dbRoles = [{ namaRole: "Admin" }];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(dbRoles),
      };
      Role.find.mockReturnValue(mockQuery);

      const result = await roleService.getAll(mockTenantID);
      expect(result).toEqual(dbRoles);
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe("Method: getById", () => {
    test("Skenario 10 — Gagal (403) jika cache ditemukan tetapi tenantID berbeda (Akses Lintas Tenant)", async () => {
      const cachedRole = { _id: mockRoleID, tenantID: "tenant_lain" };
      redis.get.mockResolvedValue(JSON.stringify(cachedRole));

      await expect(
        roleService.getById(mockRoleID, mockTenantID),
      ).rejects.toMatchObject({
        status: 403,
        message: "Akses lintas tenant ditolak",
      });
    });

    test("Skenario 11 — Berhasil dari cache jika tenantID cocok", async () => {
      const cachedRole = { _id: mockRoleID, tenantID: mockTenantID };
      redis.get.mockResolvedValue(JSON.stringify(cachedRole));

      const result = await roleService.getById(mockRoleID, mockTenantID);
      expect(result).toEqual(cachedRole);
      expect(Role.findOne).not.toHaveBeenCalled();
    });

    test("Skenario 12 — Gagal (404) jika role tidak ditemukan di database", async () => {
      redis.get.mockResolvedValue(null);
      Role.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        roleService.getById(mockRoleID, mockTenantID),
      ).rejects.toMatchObject({ status: 404 });
    });

    test("Skenario 13 — Berhasil ambil dari database dan set cache", async () => {
      redis.get.mockResolvedValue(null);
      const dbRole = { _id: mockRoleID, tenantID: mockTenantID };
      Role.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(dbRole),
      });

      const result = await roleService.getById(mockRoleID, mockTenantID);
      expect(result).toEqual(dbRole);
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe("Method: create", () => {
    test("Skenario 14 — Gagal jika validasi Joi payload gagal", async () => {
      validateRolePayload.mockReturnValue({
        valid: false,
        errors: ["Validasi gagal"],
      });
      await expect(roleService.create({}, mockTenantID)).rejects.toMatchObject({
        status: 400,
      });
    });

    test("Skenario 15 — Gagal jika array permissions tidak ada atau kosong di tahapan awal", async () => {
      validateRolePayload.mockReturnValue({ valid: true });
      await expect(
        roleService.create({ namaRole: "Staff" }, mockTenantID),
      ).rejects.toMatchObject({ status: 400 });
    });

    test("Skenario 16 — Berhasil membuat role dan menghapus cache", async () => {
      validateRolePayload.mockReturnValue({ valid: true });
      jest
        .spyOn(roleService, "_processPermissions")
        .mockResolvedValue([mockPermissionID1]);

      const payload = { namaRole: "Kasir", permissions: ["baca_laporan"] };
      const createdRole = {
        _id: mockRoleID,
        ...payload,
        permissions: [mockPermissionID1],
      };
      Role.create.mockResolvedValue(createdRole);

      const result = await roleService.create(payload, mockTenantID);

      expect(result).toEqual(createdRole);
      expect(redis.del).toHaveBeenCalledWith(`role:list:${mockTenantID}`);
    });

    test("Skenario 27 [SECURITY] — Gagal (403) jika mencoba membuat role baru dengan nama 'Owner' (Case Insensitive)", async () => {
      validateRolePayload.mockReturnValue({ valid: true });

      await expect(
        roleService.create(
          { namaRole: " oWnEr ", permissions: [mockPermissionID1] },
          mockTenantID,
        ),
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/dilindungi oleh sistem/i),
      });
    });
  });

  describe("Method: createOwnerRole", () => {
    test("Skenario 17 — Gagal (500) jika tidak ada sistem permission sama sekali di DB", async () => {
      // MOCK BARU: Pastikan idempotensi dilewati (seolah role belum ada)
      Role.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });

      Permission.find.mockReturnValue({ 
        select: jest.fn().mockReturnThis(), 
        lean: jest.fn().mockResolvedValue([]) 
      });
      
      await expect(roleService.createOwnerRole(mockTenantID)).rejects.toMatchObject({ status: 500 });
    });

    test("Skenario 18 — Berhasil membuat role Owner dan menghapus cache", async () => {
      // MOCK BARU: Pastikan idempotensi dilewati (seolah role belum ada)
      Role.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });

      Permission.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: mockPermissionID1 }])
      });
      
      Role.create.mockResolvedValue({ namaRole: "Owner", permissions: [mockPermissionID1] });

      const result = await roleService.createOwnerRole(mockTenantID);
      expect(result.namaRole).toBe("Owner");
      expect(redis.del).toHaveBeenCalledWith(`role:list:${mockTenantID}`);
    });

    test("Skenario 31 [ARCHITECTURE] — Mengembalikan role Owner yang sudah ada jika dipanggil berulang (Idempotent Onboarding)", async () => {
      const existingOwnerRole = {
        _id: mockRoleID,
        namaRole: "Owner",
        tenantID: mockTenantID,
      };

      // Simulasi role Owner sudah pernah dibuat sebelumnya
      Role.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(existingOwnerRole),
      });

      const result = await roleService.createOwnerRole(mockTenantID);

      // Verifikasi: Sistem langsung mengembalikan role lama
      expect(result).toEqual(existingOwnerRole);
      // Verifikasi: Sistem TIDAK membuang resource untuk query Permission atau Create Role baru
      expect(Permission.find).not.toHaveBeenCalled();
      expect(Role.create).not.toHaveBeenCalled();
    });
  });

  describe("Method: update", () => {
    test("Skenario 19 — Gagal jika payload invalid", async () => {
      validateRolePayload.mockReturnValue({
        valid: false,
        errors: ["Invalid"],
      });
      await expect(
        roleService.update(mockRoleID, {}, mockTenantID),
      ).rejects.toMatchObject({ status: 400 });
    });

    test("Skenario 20 — Gagal (404) jika role tidak ditemukan saat update", async () => {
      validateRolePayload.mockReturnValue({ valid: true });
      Role.findOne.mockResolvedValue(null);
      await expect(
        roleService.update(mockRoleID, { namaRole: "Admin" }, mockTenantID),
      ).rejects.toMatchObject({ status: 404 });
    });

    test("Skenario 21 — Gagal (403) jika mencoba mengubah nama role Owner", async () => {
      validateRolePayload.mockReturnValue({ valid: true });
      Role.findOne.mockResolvedValue({ namaRole: "Owner" });
      await expect(
        roleService.update(mockRoleID, { namaRole: "Boss" }, mockTenantID),
      ).rejects.toMatchObject({ status: 403 });
    });

    test("Skenario 22 — Gagal (403) jika mencoba mengubah permissions role Owner", async () => {
      validateRolePayload.mockReturnValue({ valid: true });
      Role.findOne.mockResolvedValue({ namaRole: "Owner" });
      await expect(
        roleService.update(mockRoleID, { permissions: [] }, mockTenantID),
      ).rejects.toMatchObject({ status: 403 });
    });

    test("Skenario 23 — Berhasil mengupdate role, save, populate, dan invalidate cache", async () => {
      validateRolePayload.mockReturnValue({ valid: true });

      const mockRoleDoc = {
        namaRole: "Admin",
        save: jest.fn().mockReturnThis(),
        populate: jest
          .fn()
          .mockResolvedValue({ _id: mockRoleID, namaRole: "Manager" }),
      };

      Role.findOne.mockResolvedValue(mockRoleDoc);
      jest
        .spyOn(roleService, "_processPermissions")
        .mockResolvedValue([mockPermissionID1]);

      // MOCK BARU: Mencegah TypeError saat service mengeksekusi Pengguna.find().select().lean()
      Pengguna.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await roleService.update(
        mockRoleID,
        { namaRole: "Manager", permissions: ["test"] },
        mockTenantID,
      );

      expect(mockRoleDoc.namaRole).toBe("Manager");
      expect(mockRoleDoc.save).toHaveBeenCalled();
      expect(mockRoleDoc.populate).toHaveBeenCalled();
      // redis.del dipanggil 2 kali: untuk KEY_LIST dan KEY_DETAIL (karena array pengguna kosong, blok cache pengguna tidak dieksekusi)
      expect(redis.del).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    test("Skenario 28 [SECURITY] — Gagal (403) jika mencoba mengubah nama role biasa menjadi 'Owner' (Hijacking)", async () => {
      validateRolePayload.mockReturnValue({ valid: true });

      // Role aslinya adalah Kasir
      Role.findOne.mockResolvedValue({ namaRole: "Kasir" });

      // Mencoba meretas dengan mengubah namanya menjadi Owner
      await expect(
        roleService.update(
          mockRoleID,
          { namaRole: "Owner", permissions: ["test"] },
          mockTenantID,
        ),
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/dilindungi oleh sistem/i),
      });
    });

    test("Skenario 30 [ARCHITECTURE] — Berhasil mengupdate role dan membersihkan cache sesi pengguna terkait (Mencegah Stale Authorization)", async () => {
      validateRolePayload.mockReturnValue({ valid: true });

      const mockRoleDoc = {
        namaRole: "Manajer",
        save: jest.fn().mockReturnThis(),
        populate: jest
          .fn()
          .mockResolvedValue({ _id: mockRoleID, namaRole: "Manajer" }),
      };
      Role.findOne.mockResolvedValue(mockRoleDoc);
      jest
        .spyOn(roleService, "_processPermissions")
        .mockResolvedValue([mockPermissionID1]);

      // Simulasi ada 2 pengguna yang memakai role Manajer ini
      Pengguna.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest
          .fn()
          .mockResolvedValue([{ _id: "user_1" }, { _id: "user_2" }]),
      });

      await roleService.update(
        mockRoleID,
        { permissions: ["izin_baru"] },
        mockTenantID,
      );

      // Verifikasi bahwa redis.del dipanggil untuk KEY_LIST, KEY_DETAIL, dan 2 sesi pengguna
      expect(redis.del).toHaveBeenCalledWith("auth:pengguna:user_1");
      expect(redis.del).toHaveBeenCalledWith("auth:pengguna:user_2");
    });
  });

  describe("Method: delete", () => {
    test("Skenario 24 — Gagal (404) jika role tidak ditemukan", async () => {
      Role.findOne.mockResolvedValue(null);
      await expect(
        roleService.delete(mockRoleID, mockTenantID),
      ).rejects.toMatchObject({ status: 404 });
    });

    test("Skenario 25 — Gagal (403) jika mencoba menghapus role Owner", async () => {
      Role.findOne.mockResolvedValue({ namaRole: "Owner" });
      await expect(
        roleService.delete(mockRoleID, mockTenantID),
      ).rejects.toMatchObject({ status: 403 });
    });

    test("Skenario 26 — Berhasil menghapus role dan invalidate cache", async () => {
      const mockRoleDoc = {
        namaRole: "Admin",
        deleteOne: jest.fn().mockResolvedValue(true),
      };
      Role.findOne.mockResolvedValue(mockRoleDoc);

      const result = await roleService.delete(mockRoleID, mockTenantID);

      expect(mockRoleDoc.deleteOne).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });

    test("Skenario 29 [BUSINESS] — Gagal (409) menghapus role jika masih digunakan oleh pengguna (Referential Integrity)", async () => {
      Role.findOne.mockResolvedValue({ namaRole: "Kasir" });

      // Simulasi bahwa query exists() menemukan pengguna yang masih memakai role ini
      Pengguna.exists.mockResolvedValue({ _id: "user123" });

      await expect(
        roleService.delete(mockRoleID, mockTenantID),
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringMatching(/terikat pada pengguna aktif/i),
      });
    });
  });
});
