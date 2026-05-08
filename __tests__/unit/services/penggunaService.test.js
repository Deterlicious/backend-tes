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
      nama: "test_user",
      // FIX: aksesType selalu array sesuai perubahan service
      aksesType: ["web"],
      tokenVersion: 1,
      device: [],
      deviceHistory: [],
      maxDevice: 5,
      markModified: jest.fn(),
      roleID: { _id: "role_1", namaRole: "Kasir", permissions: [] },
      comparePin: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
      toObject: jest.fn().mockImplementation(function () {
        return { ...this };
      }),
      deleteOne: jest.fn().mockResolvedValue(true),
      ...overrides,
    };

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
    jest.resetAllMocks();
  });

  // 1. TOKEN GENERATORS
  describe("Token Generators", () => {
    test("generateToken: Harus menyertakan deviceID dan loginType 'app' untuk sesi app", () => {
      jwt.sign.mockReturnValue("token_app_mock");
      const user = {
        _id: "u1",
        tenantID: "t1",
        roleID: "r1",
        aksesType: ["app", "web"],
      };
      const device = { deviceID: "DEV-1", tokenVersion: 2 };

      // FIX: loginType wajib dikirim sebagai argumen ketiga
      const token = penggunaService.generateToken(user, device, "app");

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceID: "DEV-1",
          version: 2,
          loginType: "app",
        }),
        expect.any(String),
        { expiresIn: "1d" },
      );
      expect(token).toBe("token_app_mock");
    });

    test("generateToken: Harus menyertakan tokenVersion pengguna dan loginType 'web' untuk sesi web", () => {
      jwt.sign.mockReturnValue("token_web_mock");
      const user = {
        _id: "u1",
        tenantID: "t1",
        roleID: "r1",
        aksesType: ["web"],
        tokenVersion: 5,
      };

      // FIX: loginType "web", device null
      const token = penggunaService.generateToken(user, null, "web");

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 5,
          loginType: "web",
        }),
        expect.any(String),
        { expiresIn: "1d" },
      );
      expect(token).toBe("token_web_mock");
    });

    test("generateRefreshToken: Harus menyertakan tokenVersion pengguna untuk sesi 'web'", () => {
      jwt.sign.mockReturnValue("refresh_web_mock");
      const user = {
        _id: "u1",
        tenantID: "t1",
        roleID: "r1",
        aksesType: ["web"],
        tokenVersion: 5,
      };

      // FIX: loginType wajib dikirim
      const token = penggunaService.generateRefreshToken(user, null, "web");

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 5,
          loginType: "web",
        }),
        expect.any(String),
        { expiresIn: "7d" },
      );
      expect(token).toBe("refresh_web_mock");
    });

    test("generateRefreshToken: Harus menyertakan deviceID dan loginType 'app' untuk sesi app", () => {
      jwt.sign.mockReturnValue("refresh_app_mock");
      const user = {
        _id: "u1",
        tenantID: "t1",
        aksesType: ["app"],
      };
      const device = { deviceID: "DEV-1", tokenVersion: 3 };

      const token = penggunaService.generateRefreshToken(user, device, "app");

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceID: "DEV-1",
          version: 3,
          loginType: "app",
        }),
        expect.any(String),
        { expiresIn: "7d" },
      );
      expect(token).toBe("refresh_app_mock");
    });
  });

  // 2. AUTHENTICATION LOGIC
  describe("Authentication Logic", () => {
    // --- LOGIN ---
    describe("login()", () => {
      test("Sukses untuk loginType 'web'", async () => {
        // FIX: aksesType array, mockUser punya ["web"]
        const mockUser = createMockUserDoc({ aksesType: ["web"] });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });
        jwt.sign
          .mockReturnValueOnce("access_token")
          .mockReturnValueOnce("refresh_token");

        // FIX: kirim loginType bukan aksesType
        const result = await penggunaService.login({
          nama: "test",
          pin: "password123",
          tenantID: "toko_123",
          loginType: "web",
        });

        expect(mockUser.comparePin).toHaveBeenCalledWith("password123");
        expect(result.accessToken).toBe("access_token");
        expect(result.refreshToken).toBe("refresh_token");
        expect(result.pengguna.role).toBe("Kasir");
      });

      test("Sukses untuk loginType 'app' dan mencatat device baru jika belum terdaftar", async () => {
        // FIX: aksesType array, maxDevice ada
        const mockUser = createMockUserDoc({
          aksesType: ["app"],
          device: [],
          maxDevice: 5,
        });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });
        jwt.sign.mockReturnValue("token_mock");

        // FIX: kirim loginType: "app"
        await penggunaService.login({
          nama: "test",
          pin: "pass",
          tenantID: "toko_123",
          deviceID: "DEV-NEW",
          deviceType: "HP Samsung",
          loginType: "app",
        });

        expect(mockUser.device).toHaveLength(1);
        expect(mockUser.device[0].deviceID).toBe("DEV-NEW");
        expect(mockUser.device[0].lastUsed).toBeDefined();
        expect(mockUser.save).toHaveBeenCalled();
      });

      test("Sukses untuk loginType 'app' dan update tokenVersion jika device sudah terdaftar", async () => {
        const existingDevice = {
          deviceID: "DEV-LAMA",
          tokenVersion: 1,
          lastUsed: new Date("2024-01-01"),
        };
        const mockUser = createMockUserDoc({
          aksesType: ["app"],
          device: [existingDevice],
          maxDevice: 5,
        });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        await penggunaService.login({
          nama: "test",
          pin: "pass",
          tenantID: "toko_123",
          deviceID: "DEV-LAMA",
          loginType: "app",
        });

        // Device tidak bertambah, hanya tokenVersion di-update
        expect(mockUser.device).toHaveLength(1);
        expect(mockUser.device[0].tokenVersion).not.toBe(1);
        expect(mockUser.save).toHaveBeenCalled();
      });

      test("Gagal jika PIN salah", async () => {
        // FIX: aksesType array
        const mockUser = createMockUserDoc({ aksesType: ["web"] });
        mockUser.comparePin.mockResolvedValue(false);
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        // FIX: tambah loginType
        await expect(
          penggunaService.login({
            nama: "test",
            pin: "salah",
            tenantID: "toko_123",
            loginType: "web",
          }),
        ).rejects.toThrow(/Nama atau PIN salah/i);
      });

      test("Gagal (401) jika nama tidak ditemukan di database", async () => {
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        });

        // FIX: gunakan signature baru { nama, pin, tenantID, loginType }
        await expect(
          penggunaService.login({
            nama: "hantu",
            pin: "123",
            tenantID: "toko_123",
            loginType: "web",
          }),
        ).rejects.toThrow(/Nama atau PIN salah/i);
      });

      test("Gagal jika loginType tidak valid (bukan 'app' atau 'web')", async () => {
        await expect(
          penggunaService.login({
            nama: "test",
            pin: "pass",
            tenantID: "toko_123",
            loginType: "invalid",
          }),
        ).rejects.toThrow(/loginType tidak valid/i);
      });

      test("Gagal jika loginType tidak disertakan sama sekali", async () => {
        await expect(
          penggunaService.login({
            nama: "test",
            pin: "pass",
            tenantID: "toko_123",
          }),
        ).rejects.toThrow(/loginType saat login harus satu/i);
      });

      test("Gagal (403) jika pengguna tidak punya kapabilitas loginType yang diminta", async () => {
        // User hanya punya ["web"] tapi coba login pakai "app"
        const mockUser = createMockUserDoc({ aksesType: ["web"] });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        await expect(
          penggunaService.login({
            nama: "test",
            pin: "pass",
            tenantID: "toko_123",
            loginType: "app",
          }),
        ).rejects.toThrow(/Akses tidak diizinkan/i);
      });

      test("Gagal (400) jika loginType 'app' tapi deviceID tidak disertakan", async () => {
        const mockUser = createMockUserDoc({ aksesType: ["app"] });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        await expect(
          penggunaService.login({
            nama: "test",
            pin: "pass",
            tenantID: "toko_123",
            loginType: "app",
            // deviceID tidak dikirim
          }),
        ).rejects.toThrow(/Device ID wajib/i);
      });

      test("Gagal (403) jika kuota device sudah penuh", async () => {
        const mockUser = createMockUserDoc({
          aksesType: ["app"],
          device: [{ deviceID: "DEV-1" }, { deviceID: "DEV-2" }],
          maxDevice: 2, // kuota = 2, sudah penuh
        });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        await expect(
          penggunaService.login({
            nama: "test",
            pin: "pass",
            tenantID: "toko_123",
            deviceID: "DEV-BARU",
            loginType: "app",
          }),
        ).rejects.toThrow(/Kuota perangkat penuh/i);
      });
    });

    // --- REFRESH TOKEN ---
    describe("refreshToken()", () => {
      test("Sukses untuk sesi 'web' — rotate tokenVersion pengguna", async () => {
        const oldVersion = 1;
        // FIX: decoded harus punya loginType
        jwt.verify.mockReturnValue({
          id: "user_123",
          version: oldVersion,
          loginType: "web",
        });
        const mockUser = createMockUserDoc({
          aksesType: ["web"],
          tokenVersion: oldVersion,
        });
        Pengguna.findById.mockResolvedValue(mockUser);
        jwt.sign.mockReturnValue("new_token");

        const result = await penggunaService.refreshToken("valid_token");

        expect(mockUser.tokenVersion).not.toBe(oldVersion);
        expect(mockUser.save).toHaveBeenCalled();
        expect(result.accessToken).toBeDefined();
        expect(result.newRefreshToken).toBeDefined();
      });

      test("Sukses untuk sesi 'app' — rotate tokenVersion device", async () => {
        // FIX: decoded harus punya loginType dan deviceID
        jwt.verify.mockReturnValue({
          id: "user_123",
          version: 1,
          loginType: "app",
          deviceID: "DEV-1",
        });
        const mockUser = createMockUserDoc({
          aksesType: ["app"],
          device: [
            { deviceID: "DEV-1", tokenVersion: 1, lastUsed: new Date() },
          ],
        });
        Pengguna.findById.mockResolvedValue(mockUser);
        jwt.sign.mockReturnValue("new_token");

        const result = await penggunaService.refreshToken("valid_token");

        expect(mockUser.device[0].tokenVersion).not.toBe(1);
        expect(mockUser.save).toHaveBeenCalled();
        expect(result.accessToken).toBeDefined();
      });

      test("Gagal jika sesi 'web' telah di-revoke (version mismatch)", async () => {
        // FIX: loginType ada di decoded
        jwt.verify.mockReturnValue({
          id: "user_123",
          version: 1,
          loginType: "web",
        });
        // DB sudah versi 2 — token lama tidak valid
        const mockUser = createMockUserDoc({
          aksesType: ["web"],
          tokenVersion: 2,
        });
        Pengguna.findById.mockResolvedValue(mockUser);

        await expect(
          penggunaService.refreshToken("token_usang"),
        ).rejects.toThrow(/Sesi tidak valid/i);
      });

      test("Gagal jika sesi 'app' device tidak dikenali", async () => {
        jwt.verify.mockReturnValue({
          id: "user_123",
          version: 1,
          loginType: "app",
          deviceID: "DEV-HANTU",
        });
        const mockUser = createMockUserDoc({
          aksesType: ["app"],
          device: [{ deviceID: "DEV-SAH", tokenVersion: 1 }],
        });
        Pengguna.findById.mockResolvedValue(mockUser);

        await expect(
          penggunaService.refreshToken("token_device_asing"),
        ).rejects.toThrow(/Sesi perangkat tidak valid/i);
      });

      test("Gagal jika token sudah kedaluwarsa (jwt expired)", async () => {
        jwt.verify.mockImplementation(() => {
          throw new Error("jwt expired");
        });

        await expect(
          penggunaService.refreshToken("token_rusak"),
        ).rejects.toThrow(/Refresh token tidak valid/i);
      });
    });

    // --- LOGOUT ---
    describe("logout()", () => {
      test("Sukses sesi 'web' — tokenVersion pengguna di-set ke 0", async () => {
        // FIX: loginType ada di decoded
        jwt.verify.mockReturnValue({
          id: "user_123",
          loginType: "web",
        });
        const mockUser = createMockUserDoc({
          aksesType: ["web"],
          tokenVersion: 99,
        });
        Pengguna.findById.mockResolvedValue(mockUser);

        await penggunaService.logout("valid_token");

        // FIX: harusnya 0, bukan 100 (bukan += 1 lagi)
        expect(mockUser.tokenVersion).toBe(0);
        expect(mockUser.save).toHaveBeenCalled();
        expect(redis.del).toHaveBeenCalled();
      });

      test("Sukses sesi 'app' — tokenVersion device di-set ke 0 dan markModified dipanggil", async () => {
        // FIX: loginType ada di decoded
        jwt.verify.mockReturnValue({
          id: "user_123",
          deviceID: "DEV-1",
          loginType: "app",
        });
        const mockUser = createMockUserDoc({
          aksesType: ["app"],
          device: [{ deviceID: "DEV-1", tokenVersion: 99 }],
        });
        Pengguna.findById.mockResolvedValue(mockUser);

        await penggunaService.logout("valid_token");

        // FIX: harusnya 0, bukan 100 (bukan += 1 lagi)
        expect(mockUser.device[0].tokenVersion).toBe(0);
        expect(mockUser.markModified).toHaveBeenCalledWith("device");
        expect(mockUser.save).toHaveBeenCalled();
        expect(redis.del).toHaveBeenCalled();
      });

      test("Harus diam-diam resolve (tidak crash) jika token valid tapi user sudah dihapus dari DB", async () => {
        jwt.verify.mockReturnValue({
          id: "user_hilang",
          loginType: "web",
        });
        Pengguna.findById.mockResolvedValue(null);

        await expect(penggunaService.logout("token")).resolves.toBeUndefined();
      });

      test("Harus diam-diam resolve (tidak crash) jika token tidak valid / rusak", async () => {
        jwt.verify.mockImplementation(() => {
          throw new Error("invalid token");
        });

        await expect(
          penggunaService.logout("token_rusak"),
        ).resolves.toBeUndefined();
      });

      test("logout: Sukses memasukkan access token ke blacklist Redis (Jika diterapkan)", async () => {
        // Mock verifikasi Refresh Token sukses
        jwt.verify.mockReturnValueOnce({ id: "user_1" });
        // Mock verifikasi Access Token sukses dan masih punya sisa waktu (exp)
        jwt.verify.mockReturnValueOnce({
          exp: Math.floor(Date.now() / 1000) + 3600,
        });

        const mockPengguna = {
          _id: "user_1",
          tokenVersion: 100,
          save: jest.fn().mockResolvedValue(true),
        };
        Pengguna.findById.mockResolvedValue(mockPengguna);

        // Asumsi fungsi logout menerima (refreshToken, accessToken)
        await penggunaService.logout("refresh_mock", "access_mock");

        // Pastikan Redis dipanggil untuk mem-blacklist access token
        expect(redis.set).toHaveBeenCalledWith(
          expect.stringContaining("bl_access_mock"), // Prefix blacklist
          "blacklisted",
          "EX",
          expect.any(Number),
        );
      });
    });
  });

  // 3. REGISTRATION & CREATION
  describe("Registration & Creation", () => {
    describe("registerOwner()", () => {
      test("Sukses mendaftarkan owner baru", async () => {
        Role.findOne.mockResolvedValue({
          _id: "role_owner",
          namaRole: "Owner",
        });
        Pengguna.findOne.mockResolvedValue(null);

        Pengguna.mockImplementation(function (data) {
          Object.assign(this, data);
          this._id = "new_owner_123";
          this.device = [];
          this.deviceHistory = [];
          this.markModified = jest.fn();
          this.populate = jest.fn().mockResolvedValue(this);
          this.save = jest.fn().mockResolvedValue(this);
          this.roleID = { _id: "role_owner", namaRole: "Owner" };
        });

        jwt.sign.mockReturnValue("token_mock");

        const result = await penggunaService.registerOwner(
          {
            nama: "Owner Baru",
            pin: "123456",
            aksesType: ["app", "web"],
            deviceID: "DEV-001",
            deviceType: "primary",
          },
          "toko_1",
        );

        // FIX: service return { pengguna: {...}, accessToken, refreshToken }
        expect(result.pengguna.nama).toBe("Owner Baru");
        expect(result.pengguna.aksesType).toContain("app");
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(redis.del).toHaveBeenCalled();
      });

      test("Gagal (400) jika deviceID tidak disertakan", async () => {
        // Guard baru: deviceID wajib di registerOwner
        await expect(
          penggunaService.registerOwner(
            {
              nama: "Owner Tanpa Device",
              pin: "123456",
              aksesType: ["app"],
              // deviceID tidak dikirim
            },
            "toko_1",
          ),
        ).rejects.toThrow(/Device ID wajib/i);
      });

      test("Gagal (404) jika Role Owner belum ada di sistem", async () => {
        Role.findOne.mockResolvedValue(null);

        await expect(
          penggunaService.registerOwner(
            { nama: "Owner", pin: "123456", deviceID: "DEV-1" },
            "toko_1",
          ),
        ).rejects.toThrow(/Role Owner tidak ditemukan/i);
      });

      test("Gagal (400) jika nama sudah digunakan di tenant ini", async () => {
        Role.findOne.mockResolvedValue({
          _id: "role_owner",
          namaRole: "Owner",
        });
        Pengguna.findOne.mockResolvedValue({ _id: "existing_owner" }); // nama sudah ada

        await expect(
          penggunaService.registerOwner(
            { nama: "Owner Duplikat", pin: "123456", deviceID: "DEV-1" },
            "toko_1",
          ),
        ).rejects.toThrow(/nama sudah digunakan/i);
      });

      test("Sukses — token yang digenerate selalu punya loginType 'app'", async () => {
        Role.findOne.mockResolvedValue({
          _id: "role_owner",
          namaRole: "Owner",
        });
        Pengguna.findOne.mockResolvedValue(null);

        Pengguna.mockImplementation(function (data) {
          Object.assign(this, data);
          this._id = "new_owner_123";
          this.device = [];
          this.deviceHistory = [];
          this.markModified = jest.fn();
          this.populate = jest.fn().mockResolvedValue(this);
          this.save = jest.fn().mockResolvedValue(this);
          this.roleID = { _id: "role_owner", namaRole: "Owner" };
        });

        jwt.sign.mockReturnValue("token_mock");

        await penggunaService.registerOwner(
          {
            nama: "Owner Baru",
            pin: "123456",
            aksesType: ["app", "web"],
            deviceID: "DEV-001",
          },
          "toko_1",
        );

        // jwt.sign dipanggil 2x — accessToken dan refreshToken
        // keduanya harus punya loginType: "app"
        expect(jwt.sign).toHaveBeenCalledTimes(2);
        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({ loginType: "app" }),
          expect.any(String),
          expect.any(Object),
        );
      });
    });

    describe("create()", () => {
      test("Gagal (400) jika nama karyawan sudah digunakan di tenant yang sama", async () => {
        validatePenggunaPayload.mockReturnValue(true);
        Role.findById.mockResolvedValue({ _id: "role_1", namaRole: "Kasir" });
        // Simulasi nama sudah ada
        Pengguna.findOne.mockResolvedValue({ _id: "user_lama" });

        await expect(
          penggunaService.create(
            // FIX: pakai nama bukan email
            { nama: "kasir_lama", roleID: "role_1" },
            "toko_1",
          ),
        ).rejects.toThrow(/nama sudah digunakan/i);
      });

      test("Gagal (400) jika mencoba membuat pengguna dengan role Owner yang sudah terisi", async () => {
        // Mock nama belum digunakan
        Pengguna.findOne.mockResolvedValueOnce(null);

        // FIX: Tambahkan properti tenantID: "toko_1" agar lolos dari Guard Cross-Tenant
        Role.findById.mockResolvedValue({
          _id: "role_1",
          namaRole: "Owner",
          tenantID: "toko_1",
        });

        // Mock ternyata sudah ada pengguna yang pakai role Owner ini
        Pengguna.findOne.mockResolvedValueOnce({ _id: "owner_lama" });

        await expect(
          penggunaService.create(
            {
              nama: "Karyawan Baru",
              roleID: "role_1",
              pin: "123456",
              aksesType: "app",
              deviceID: "dev_1",
            },
            "toko_1", // pastikan parameter ini sama dengan tenantID di atas
          ),
        ).rejects.toThrow(/Role Owner sudah digunakan oleh pengguna lain/i);
      });

      test("Gagal (404) jika roleID tidak ditemukan", async () => {
        validatePenggunaPayload.mockReturnValue(true);
        Pengguna.findOne.mockResolvedValue(null);
        Role.findById.mockResolvedValue(null);

        await expect(
          penggunaService.create(
            { nama: "kasir_baru", roleID: "role_tidak_ada" },
            "toko_1",
          ),
        ).rejects.toThrow(/Role tidak ditemukan/i);
      });
    });
  });

  // 4. CRUD & REDIS CACHE STRATEGY
  describe("CRUD & Caching", () => {
    test("getAll: [CACHE HIT] Mengembalikan data dari Redis tanpa hit DB", async () => {
      redis.get.mockResolvedValue(JSON.stringify([{ nama: "Budi" }]));

      const result = await penggunaService.getAll("toko_1");

      expect(result[0].nama).toBe("Budi");
      expect(Pengguna.find).not.toHaveBeenCalled(); // DB tidak disentuh mutlak
    });

    test("getAll: [CACHE MISS] Mengambil dari DB lalu simpan ke Redis", async () => {
      redis.get.mockResolvedValue(null);
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

    test("getById: [CACHE HIT] Mengembalikan data dari Redis tanpa hit DB", async () => {
      redis.get.mockResolvedValue(JSON.stringify({ _id: "u1", nama: "Budi" }));

      const result = await penggunaService.getById("u1", "toko_1");

      expect(result.nama).toBe("Budi");
      expect(Pengguna.findOne).not.toHaveBeenCalled();
    });

    test("getById: Gagal (404) jika ID tidak ditemukan baik di Cache maupun DB", async () => {
      redis.get.mockResolvedValue(null);
      Pengguna.findOne.mockReturnValue(mockMongooseChain(null));

      await expect(
        penggunaService.getById("id_palsu", "toko_1"),
      ).rejects.toThrow(/Pengguna tidak ditemukan/i);
    });

    test("update: Harus mereset cache dan memformat ulang objek response", async () => {
      const mockUser = createMockUserDoc();
      Pengguna.findOne.mockResolvedValue(mockUser);

      const result = await penggunaService.update(
        "u_1",
        { nama: "Baru" },
        "toko_1",
      );

      expect(mockUser.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
      expect(result.role).toBe("Kasir"); // field role ter-populate dengan benar
      expect(result.pin).toBeUndefined(); // pin tidak bocor ke response
    });

    test("update: Gagal (404) jika pengguna tidak ditemukan", async () => {
      Pengguna.findOne.mockResolvedValue(null);

      await expect(
        penggunaService.update("id_palsu", { nama: "Baru" }, "toko_1"),
      ).rejects.toThrow(/Pengguna tidak ditemukan/i);
    });

    test("update: Sukses update roleID ke role non-Owner tanpa pengecekan duplikat Owner", async () => {
      // role yang diupdate adalah Kasir, bukan Owner
      Role.findById.mockResolvedValue({ _id: "role_kasir", namaRole: "Kasir" });

      const mockUser = createMockUserDoc();
      Pengguna.findOne.mockResolvedValue(mockUser);

      mockUser.save = jest.fn().mockResolvedValue({
        populate: jest.fn().mockResolvedValue(undefined),
        roleID: { _id: "role_kasir", namaRole: "Kasir" },
        toObject: jest.fn().mockReturnValue({
          _id: "user_123",
          nama: "test_user",
          roleID: { _id: "role_kasir", namaRole: "Kasir" },
        }),
      });

      const result = await penggunaService.update(
        "user_123",
        { roleID: "role_kasir" },
        "toko_1",
      );

      expect(Role.findById).toHaveBeenCalledWith("role_kasir");
      // findOne untuk cek duplikat Owner tidak dipanggil karena role bukan Owner
      expect(Pengguna.findOne).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    test("delete: Gagal (403) jika mencoba menghapus pengguna dengan role Owner", async () => {
      const mockUser = createMockUserDoc({
        roleID: { namaRole: "Owner" },
      });
      Pengguna.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(penggunaService.delete("u_1", "toko_1")).rejects.toThrow(
        /Role Owner tidak dapat dihapus/i,
      );
    });

    test("update: Gagal (400) jika mencoba mengubah role pengguna lain menjadi Owner padahal sudah ada Owner", async () => {
      const mockUser = createMockUserDoc();
      Pengguna.findOne
        .mockResolvedValueOnce(mockUser) // findOne untuk ambil user yang diupdate
        .mockResolvedValueOnce({ _id: "owner_lama" }); // findOne untuk cek existing owner

      Role.findById.mockResolvedValue({ _id: "role_o", namaRole: "Owner" });

      await expect(
        penggunaService.update("u_1", { roleID: "role_o" }, "toko_1"),
      ).rejects.toThrow(/Role Owner sudah digunakan oleh pengguna lain/i);
    });

    test("delete: Sukses menghapus pengguna non-Owner", async () => {
      const mockUser = createMockUserDoc({
        roleID: { namaRole: "Kasir" },
      });
      Pengguna.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await penggunaService.delete("u_1", "toko_1");

      expect(mockUser.deleteOne).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test("checkOwnerExists: Mengembalikan false jika Role 'Owner' belum ada di sistem", async () => {
      Role.findOne.mockResolvedValue(null);

      const result = await penggunaService.checkOwnerExists("toko_1");
      expect(result).toBe(false);
    });

    test("checkOwnerExists: Mengembalikan false jika Role ada tapi belum ada pengguna Owner", async () => {
      Role.findOne.mockResolvedValue({ _id: "role_owner" });
      Pengguna.findOne.mockResolvedValue(null);

      const result = await penggunaService.checkOwnerExists("toko_1");
      expect(result).toBe(false);
    });

    test("checkOwnerExists: Mengembalikan true jika Owner sudah ada", async () => {
      Role.findOne.mockResolvedValue({ _id: "role_owner" });
      Pengguna.findOne.mockResolvedValue({ _id: "owner_ada" });

      const result = await penggunaService.checkOwnerExists("toko_1");
      expect(result).toBe(true);
    });

    test("create: Gagal (403/404) jika mencoba menggunakan roleID milik tenant lain", async () => {
      // Simulasi role ditemukan, tapi tenantID-nya BUKAN milik tenant yang sedang request
      Role.findById.mockResolvedValue({
        _id: "role_curian",
        tenantID: "tenant_penyusup",
      });

      await expect(
        // Asumsi parameter: create(tenantID, payload)
        penggunaService.create("tenant_asli", {
          nama: "Kasir Baru",
          roleID: "role_curian",
          pin: "123456",
        }),
      ).rejects.toThrow();
      // Catatan: Pastikan di penggunaService.js Anda melempar error jika role.tenantID !== tenantID

      expect(Pengguna.prototype.save).not.toHaveBeenCalled();
    });

    test("getById: Gagal (404) jika mencoba mengakses pengguna dari tenant lain", async () => {
      redis.get.mockResolvedValue(null);

      // FIX: Menambahkan .populate() pada rantai mock agar sesuai dengan service
      Pengguna.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(
        penggunaService.getById("user_toko_sebelah", "tenant_kita"),
      ).rejects.toThrow(/tidak ditemukan/i);
    });

    test("update: Gagal (404) jika mencoba mengubah data pengguna milik tenant lain", async () => {
      // Simulasi query update dengan filter tenantID spesifik mengembalikan null
      Pengguna.findOneAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        // Asumsi parameter: update(penggunaID, tenantID, payload)
        penggunaService.update("user_toko_sebelah", "tenant_kita", {
          nama: "Hacked",
        }),
      ).rejects.toThrow(/tidak ditemukan/i);
    });
  });

  // 5. DEVICE MANAGEMENT
  describe("Device Management", () => {
    test("addDevice: Berhasil menambahkan perangkat baru dengan tokenVersion 0 dan lastUsed null", async () => {
      const mockUser = createMockUserDoc({ device: [] });
      Pengguna.findOne.mockResolvedValue(mockUser);
      validateDeviceAction.mockReturnValue(true);

      await penggunaService.addDevice("u_1", "toko_1", { deviceID: "DEV-2" });

      expect(mockUser.device).toHaveLength(1);
      expect(mockUser.device[0].tokenVersion).toBe(0);
      // FIX: lastUsed bukan lastLogin
      expect(mockUser.device[0].lastUsed).toBeNull();
      expect(mockUser.device[0].lastLogin).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
    });

    test("addDevice: Gagal (400) jika deviceID sudah terdaftar", async () => {
      const mockUser = createMockUserDoc({
        device: [{ deviceID: "DEV-ADA" }],
      });
      Pengguna.findOne.mockResolvedValue(mockUser);
      validateDeviceAction.mockReturnValue(true);

      await expect(
        penggunaService.addDevice("u_1", "toko_1", { deviceID: "DEV-ADA" }),
      ).rejects.toThrow(/Perangkat sudah terdaftar/i);
    });

    test("promoteDevice: Mengubah device target menjadi primary dan semua lainnya menjadi secondary", async () => {
      const mockUser = createMockUserDoc({
        device: [
          { deviceID: "DEV-1", type: "secondary" },
          { deviceID: "DEV-2", type: "primary" },
        ],
      });
      Pengguna.findOne.mockResolvedValue(mockUser);

      await penggunaService.promoteDevice("u_1", "toko_1", "DEV-1");

      expect(mockUser.device[0].type).toBe("primary"); // DEV-1 naik pangkat
      expect(mockUser.device[1].type).toBe("secondary"); // DEV-2 turun pangkat
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("demoteDevice: Berhasil menurunkan device menjadi secondary", async () => {
      const mockUser = createMockUserDoc({
        device: [{ deviceID: "DEV-1", type: "primary" }],
      });
      Pengguna.findOne.mockResolvedValue(mockUser);

      await penggunaService.demoteDevice("u_1", "toko_1", "DEV-1");

      expect(mockUser.device[0].type).toBe("secondary");
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("demoteDevice: Gagal (404) jika deviceID tidak ditemukan", async () => {
      const mockUser = createMockUserDoc({
        device: [{ deviceID: "DEV-SAH" }],
      });
      Pengguna.findOne.mockResolvedValue(mockUser);

      await expect(
        penggunaService.demoteDevice("u_1", "toko_1", "DEV-HANTU"),
      ).rejects.toThrow(/Perangkat tidak ditemukan/i);
    });

    test("removeDevice: Menghapus device yang benar dari array", async () => {
      const mockUser = createMockUserDoc({
        device: [{ deviceID: "DEV-1" }, { deviceID: "DEV-2" }],
      });
      Pengguna.findOne.mockResolvedValue(mockUser);

      await penggunaService.removeDevice("u_1", "toko_1", "DEV-1");

      expect(mockUser.device).toHaveLength(1);
      expect(mockUser.device[0].deviceID).toBe("DEV-2");
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("getDeviceHistory: Mengembalikan array device pengguna", async () => {
      const mockUser = createMockUserDoc({
        device: [{ deviceID: "DEV-1" }, { deviceID: "DEV-2" }],
      });
      Pengguna.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await penggunaService.getDeviceHistory("u_1", "toko_1");

      expect(result).toHaveLength(2);
      expect(result[0].deviceID).toBe("DEV-1");
    });

    test("getDeviceHistory: Gagal (404) jika pengguna tidak ditemukan", async () => {
      Pengguna.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        penggunaService.getDeviceHistory("id_palsu", "toko_1"),
      ).rejects.toThrow(/Pengguna tidak ditemukan/i);
    });
  });

  // DISASTER RECOVERY (Simulasi Bencana Infrastruktur)
  describe("Simulasi Bencana Infrastruktur (Disaster Recovery)", () => {
    test("login: Harus melempar error sistem jika MongoDB mati mendadak (Crash)", async () => {
      // FIX: Error harus dilempar dari eksekusi akhir rantai query (.populate), bukan dari findOne
      Pengguna.findOne.mockReturnValue({
        populate: jest
          .fn()
          .mockRejectedValue(new Error("MongoNetworkError: connection closed")),
      });

      await expect(
        penggunaService.login(
          { nama: "Kasir", pin: "123456", loginType: "app" },
          "tenant_1",
        ),
      ).rejects.toThrow("MongoNetworkError");
    });

    test("getById: Harus melempar error sistem jika server Redis mati mendadak", async () => {
      redis.get.mockRejectedValue(
        new Error("Redis connection to 127.0.0.1:6379 failed"),
      );

      await expect(
        penggunaService.getById("user_1", "tenant_1"),
      ).rejects.toThrow("Redis connection");

      expect(Pengguna.findOne).not.toHaveBeenCalled(); // Pastikan DB aman jika cache layer rusak
    });

    test("refreshToken: Harus melempar error sistem jika MongoDB gagal menyimpan rotasi sesi", async () => {
      jwt.verify.mockReturnValue({ id: "user_1", version: 100 });

      const mockPengguna = {
        _id: "user_1",
        tokenVersion: 100,
        save: jest
          .fn()
          .mockRejectedValue(
            new Error("ValidationError: database write failed"),
          ),
      };
      Pengguna.findById.mockResolvedValue(mockPengguna);

      await expect(penggunaService.refreshToken("valid_token")).rejects.toThrow(
        "ValidationError",
      );
    });
  });

  // ============================================================
  // EDGE CASES & ANOMALI SEPELE (Micro-Bugs Prevention)
  // ============================================================
  describe("Edge Cases & Anomali Sepele (Micro-Bugs Prevention)", () => {
    test("update: Harus melempar error sistem jika gagal membersihkan Cache (Redis Crash pasca-Update DB)", async () => {
      // FIX MOCK: Service pakai findOne + save, bukan findOneAndUpdate
      const mockPengguna = {
        _id: "user_1",
        tenantID: "toko_1",
        roleID: { namaRole: "Kasir" },
        save: jest.fn().mockResolvedValue({
          populate: jest.fn().mockResolvedValue(undefined), // populate modifikasi in-place, return dibuang
          roleID: { _id: "role_1", namaRole: "Kasir" },
          toObject: jest.fn().mockReturnValue({
            _id: "user_1",
            nama: "Terupdate",
            roleID: { _id: "role_1", namaRole: "Kasir" },
          }),
        }),
      };
      Pengguna.findOne.mockResolvedValue(mockPengguna);
      redis.del.mockRejectedValue(
        new Error("Redis Timeout during Cache Invalidation"),
      );

      await expect(
        penggunaService.update("user_1", { nama: "Terupdate" }, "toko_1"),
      ).rejects.toThrow("Redis Timeout");
    });

    test("update: Harus melempar error (400) jika payload update benar-benar kosong {}", async () => {
      // Skenario: Mencegah query DB sia-sia jika request body kosong
      await expect(
        penggunaService.update("user_1", {}, "toko_1"),
      ).rejects.toThrow(/kosong/i);

      expect(Pengguna.findOne).not.toHaveBeenCalled(); // DB dipastikan aman
    });

    test("removeDevice: Harus melempar error (404) jika mencoba menghapus deviceID yang tidak pernah ada", async () => {
      // Skenario: Client mengirim instruksi hapus untuk device yang sudah dihapus atau tidak pernah ada
      const mockPengguna = {
        _id: "user_1",
        tenantID: "toko_1",
        device: [
          { deviceID: "dev_sah" }, // Device sah
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      Pengguna.findOne.mockResolvedValue(mockPengguna);

      await expect(
        penggunaService.removeDevice(
          "user_1",
          "toko_1",
          "dev_hantu_tidak_terdaftar",
        ),
      ).rejects.toThrow(/tidak ditemukan|tidak ada/i);

      // Pastikan sistem tidak mencoba melakukan save() array yang tidak berubah
      expect(mockPengguna.save).not.toHaveBeenCalled();
    });
  });
});
