const penggunaService = require("../../../services/penggunaService");
const Pengguna = require("../../../models/penggunaModel");
const Role = require("../../../models/roleModel");
const jwt = require("jsonwebtoken");
const redis = require("../../../config/redis");
const {
  validatePenggunaPayload,
  validateDeviceAction,
} = require("../../../validators/penggunaValidator");

// MOCKING DEPENDENCIES MUTLAK
jest.mock("../../../models/penggunaModel");
jest.mock("../../../models/roleModel");
jest.mock("jsonwebtoken");
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));
jest.mock("../../../validators/penggunaValidator", () => ({
  validatePenggunaPayload: jest.fn(),
  validateDeviceAction: jest.fn(),
}));

describe("Unit Test — Pengguna Service", () => {
  // Helper: Membuat objek Mongoose Document tiruan (Mock Doc)
  const createMockUserDoc = (overrides = {}) => {
    const doc = {
      _id: "user_123",
      tenantID: "toko_123",
      email: "test@toko.com",
      aksesType: "web",
      tokenVersion: 1,
      device: [],
      deviceHistory: [],
      markModified: jest.fn(),
      roleID: { _id: "role_1", namaRole: "Kasir", permissions: [] },
      comparePin: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockReturnThis(),
      toObject: jest.fn().mockImplementation(function () {
        return { ...this }; // Simple toObject mock
      }),
      deleteOne: jest.fn().mockResolvedValue(true),
      ...overrides,
    };

    // fix: save() harus mengembalikan dokumen itu sendiri, bukan boolean 'true'
    doc.save = jest.fn().mockResolvedValue(doc);

    return doc;
  };

  // Helper: Memalsukan rantai query Mongoose (find -> populate -> select -> lean)
  const mockMongooseChain = (resolvedValue) => ({
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resolvedValue),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // generate token
  describe("Token Generators", () => {
    test("generateToken: Harus menyertakan deviceID untuk akses 'app'", () => {
      jwt.sign.mockReturnValue("token_app_mock");
      const user = {
        _id: "u1",
        tenantID: "t1",
        roleID: "r1",
        aksesType: "app",
      };
      const device = { deviceID: "DEV-1", tokenVersion: 2 };

      const token = penggunaService.generateToken(user, device);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ deviceID: "DEV-1", version: 2 }),
        expect.any(String),
        { expiresIn: "1d" },
      );
      expect(token).toBe("token_app_mock");
    });

    test("generateRefreshToken: Harus menyertakan tokenVersion pengguna untuk akses 'web'", () => {
      jwt.sign.mockReturnValue("refresh_web_mock");
      const user = {
        _id: "u1",
        tenantID: "t1",
        roleID: "r1",
        aksesType: "web",
        tokenVersion: 5,
      };

      const token = penggunaService.generateRefreshToken(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ version: 5 }),
        expect.any(String),
        { expiresIn: "7d" },
      );
      expect(token).toBe("refresh_web_mock");
    });
  });

  // logika autentikasi
  describe("Authentication Logic", () => {
    test("login: Sukses untuk akses 'web'", async () => {
      const mockUser = createMockUserDoc({ aksesType: "web" });
      Pengguna.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
      });
      jwt.sign
        .mockReturnValueOnce("access_token")
        .mockReturnValueOnce("refresh_token");

      const result = await penggunaService.login({
        nama: "test",
        pin: "password123",
        tenantID: "toko_123",
      });

      expect(mockUser.comparePin).toHaveBeenCalledWith("password123");
      expect(result.accessToken).toBe("access_token");
      expect(result.pengguna.role).toBe("Kasir"); // Memastikan mapping toObject berhasil
    });

    test("login: Sukses untuk akses 'app' dan mencatat device baru jika belum ada", async () => {
      const mockUser = createMockUserDoc({ aksesType: "app", device: [] });
      Pengguna.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
      });

      await penggunaService.login({
        nama: "test",
        pin: "pass",
        tenantID: "toko_123",
        deviceID: "DEV-NEW",
        deviceType: "HP Samsung",
      });

      expect(mockUser.device).toHaveLength(1);
      expect(mockUser.device[0].deviceID).toBe("DEV-NEW");
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("login: Gagal jika password salah", async () => {
      const mockUser = createMockUserDoc();
      mockUser.comparePin.mockResolvedValue(false); // Password salah
      Pengguna.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        penggunaService.login({
          nama: "test",
          pin: "password123",
          tenantID: "toko_123",
        }),
      ).rejects.toThrow(/Nama atau Pin salah/i);
    });

    test("refreshToken: Gagal jika sesi web telah di-revoke (version mismatch)", async () => {
      jwt.verify.mockReturnValue({ id: "user_123", version: 1 }); // Token bawa versi 1
      const mockUser = createMockUserDoc({ aksesType: "web", tokenVersion: 2 }); // DB sudah versi 2
      Pengguna.findById.mockResolvedValue(mockUser);

      await expect(penggunaService.refreshToken("token_usang")).rejects.toThrow(
        /Refresh token tidak valid/i,
      );
    });

    test("logout: Harus menaikkan tokenVersion pada device spesifik untuk akses 'app'", async () => {
      jwt.verify.mockReturnValue({ id: "u1", deviceID: "DEV-1" });
      const mockUser = createMockUserDoc({
        aksesType: "app",
        device: [{ deviceID: "DEV-1", tokenVersion: 1 }],
      });
      Pengguna.findById.mockResolvedValue(mockUser);

      await penggunaService.logout("valid_token");

      expect(mockUser.device[0].tokenVersion).toBe(2); // Naik 1
      expect(mockUser.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled(); // Cache dihapus
    });

    test("login: Gagal (401) jika email tidak ditemukan di database (User Null)", async () => {
      // Simulasi user tidak ditemukan sama sekali
      Pengguna.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(
        penggunaService.login("hantu@toko.com", "123"),
      ).rejects.toThrow(/Nama atau Pin salah/i);
    });

    test("refreshToken: Gagal (401) jika token sudah kedaluwarsa (TokenExpiredError)", async () => {
      // Simulasi error bawaan library jsonwebtoken
      jwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      await expect(penggunaService.refreshToken("token_rusak")).rejects.toThrow(
        /Refresh token tidak valid/i,
      );
    });

    test("logout: Harus return diam-diam (tidak crash) jika token valid tapi user sudah dihapus dari DB", async () => {
      jwt.verify.mockReturnValue({ id: "user_hilang", deviceID: "DEV-1" });
      Pengguna.findById.mockResolvedValue(null); // User yatim piatu

      // Harus resolve tanpa error, mengeksekusi blok 'if (!user) return;'
      await expect(penggunaService.logout("token")).resolves.toBeUndefined();
    });
  });

  // register owner dan create pengguna
  describe("Registration & Creation", () => {
    test("registerOwner: Sukses mendaftarkan owner baru", async () => {
      Role.findOne.mockResolvedValue({ _id: "role_owner", namaRole: "Owner" });
      Pengguna.findOne.mockResolvedValue(null); // Belum ada owner

      // fix Mengajarkan tiruan constructor Mongoose cara menampung data
      Pengguna.mockImplementation(function (data) {
        Object.assign(this, data);
        this._id = "new_owner_123";
        this.device = [];
        this.deviceHistory = [];
        this.markModified = jest.fn();
        this.save = jest.fn().mockResolvedValue(this);
      });

      const result = await penggunaService.registerOwner(
        {
          nama: "Owner Baru",
          pin: "123456",
          aksesType: "app",
          deviceID: "DEV-001",
        },
        "toko_1",
      );

      expect(result.nama).toBe("Owner Baru");
      expect(result.aksesType).toBe("app");
      expect(redis.del).toHaveBeenCalled(); // Memastikan clearCache dipanggil
    });

    test("create: Gagal jika mencoba membuat 2 Owner di 1 Tenant", async () => {
      Role.findById.mockResolvedValue({ _id: "role_o", namaRole: "Owner" });
      Pengguna.findOne
        .mockResolvedValueOnce(null) // Cek email (aman)
        .mockResolvedValueOnce({ _id: "owner_lama" }); // Cek existing owner (sudah ada)

      await expect(
        penggunaService.create(
          { email: "a@b.com", roleID: "role_o" },
          "toko_1",
        ),
      ).rejects.toThrow(/Tenant ini sudah memiliki Owner/i);
    });

    test("create: Gagal (400) jika email karyawan sudah digunakan di tenant tersebut", async () => {
      validatePenggunaPayload.mockReturnValue(true);
      // Simulasi email sudah ada
      Pengguna.findOne.mockResolvedValue({
        _id: "user_lama",
        email: "kasir@b.com",
      });

      await expect(
        penggunaService.create(
          { email: "kasir@b.com", roleID: "role_1" },
          "toko_1",
        ),
      ).rejects.toThrow(/Email sudah digunakan/i);
    });
  });

  // 4. CRUD & REDIS CACHE STRATEGY
  describe("CRUD & Caching", () => {
    test("getAll: [CACHE HIT] Mengembalikan data dari Redis tanpa hit DB", async () => {
      redis.get.mockResolvedValue(JSON.stringify([{ nama: "Budi" }])); // Data ada di Redis

      const result = await penggunaService.getAll("toko_1");

      expect(result[0].nama).toBe("Budi");
      expect(Pengguna.find).not.toHaveBeenCalled(); // DB tidak disentuh mutlak
    });

    test("getAll: [CACHE MISS] Mengambil dari DB lalu simpan ke Redis", async () => {
      redis.get.mockResolvedValue(null); // Redis kosong
      const dbUsers = [{ _id: "1", roleID: { namaRole: "Admin" } }];
      Pengguna.find.mockReturnValue(mockMongooseChain(dbUsers));

      await penggunaService.getAll("toko_1");

      expect(Pengguna.find).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        "EX",
        3600,
      );
    });

    test("update: Harus mereset cache dan memformat ulang objek", async () => {
      const mockUser = createMockUserDoc();
      Pengguna.findOne.mockResolvedValue(mockUser);

      const result = await penggunaService.update(
        "u_1",
        { nama: "Baru" },
        "toko_1",
      );

      expect(mockUser.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled(); // Clear cache mutlak dipanggil
      expect(result.role).toBe("Kasir"); // Bukti format objek berjalan baik
    });

    test("delete: Gagal jika mencoba menghapus akun dengan role Owner", async () => {
      const mockUser = createMockUserDoc({ roleID: { namaRole: "Owner" } });
      Pengguna.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(penggunaService.delete("u_1", "toko_1")).rejects.toThrow(
        /Role Owner tidak dapat dihapus/i,
      );
    });

    test("getById: Gagal (404) jika ID tidak ditemukan baik di Cache maupun DB", async () => {
      redis.get.mockResolvedValue(null); // Cache miss
      Pengguna.findOne.mockReturnValue(mockMongooseChain(null)); // DB kosong

      await expect(
        penggunaService.getById("id_palsu", "toko_1"),
      ).rejects.toThrow(/Pengguna tidak ditemukan/i);
    });

    test("checkOwnerExists: Mengembalikan false secara aman jika entitas Role 'Owner' belum ada di sistem", async () => {
      // Skenario Sistem baru di-deploy dan koleksi Role masih kosong melompong
      Role.findOne.mockResolvedValue(null);

      const result = await penggunaService.checkOwnerExists("toko_1");
      expect(result).toBe(false);
    });
  });

  // 5. device management
  describe("Device Management", () => {
    test("addDevice: Menambahkan perangkat baru", async () => {
      const mockUser = createMockUserDoc({ device: [] });
      Pengguna.findOne.mockResolvedValue(mockUser);

      await penggunaService.addDevice("u_1", "toko_1", { deviceID: "DEV-2" });

      expect(mockUser.device).toHaveLength(1);
      expect(mockUser.device[0].tokenVersion).toBe(0);
      expect(mockUser.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled(); // Sinkronisasi cache berjalan
    });

    test("promoteDevice: Mengubah status perangkat menjadi primary", async () => {
      const mockUser = createMockUserDoc({
        device: [
          { deviceID: "DEV-1", type: "secondary" },
          { deviceID: "DEV-2", type: "primary" },
        ],
      });
      Pengguna.findOne.mockResolvedValue(mockUser);

      await penggunaService.promoteDevice("u_1", "toko_1", "DEV-1");

      expect(mockUser.device[0].type).toBe("primary"); // DEV-1 naik pangkat
      expect(mockUser.device[1].type).toBe("secondary"); // DEV-2 turun pangkat (Hanya boleh 1 primary)
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("removeDevice: Menghapus perangkat dari array", async () => {
      const mockUser = createMockUserDoc({
        device: [{ deviceID: "DEV-1" }, { deviceID: "DEV-2" }],
      });
      Pengguna.findOne.mockResolvedValue(mockUser);

      await penggunaService.removeDevice("u_1", "toko_1", "DEV-1");

      expect(mockUser.device).toHaveLength(1);
      expect(mockUser.device[0].deviceID).toBe("DEV-2");
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("demoteDevice: Gagal (404) jika deviceID tidak ditemukan dalam array device pengguna", async () => {
      const mockUser = createMockUserDoc({ device: [{ deviceID: "DEV-SAH" }] });
      Pengguna.findOne.mockResolvedValue(mockUser);

      // Mencoba menurunkan perangkat yang tidak pernah login
      await expect(
        penggunaService.demoteDevice("u_1", "toko_1", "DEV-HANTU"),
      ).rejects.toThrow(/Perangkat tidak ditemukan/i);
    });
  });
});
