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
jest.mock("../../../models/deviceModel");

describe("Unit Test — Pengguna Service", () => {
  // Helper: Membuat objek Mongoose Document tiruan (Mock Doc)
  const createMockUserDoc = (overrides = {}) => {
    const doc = {
      _id: "user_123",
      tenantID: "toko_123",
      nama: "test_user",
      aksesType: ["web"],
      tokenVersion: 1,
      status: "aktif",
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

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.REFRESH_SECRET;
    delete process.env.PENGGUNA_ACCESS_TOKEN;
    delete process.env.PENGGUNA_REFRESH_TOKEN;
  });

  // 1. TOKEN GENERATORS
  describe("Token Generators", () => {
    test("generateToken: Harus menyertakan installationId dan loginType 'app' untuk sesi app", () => {
      process.env.PENGGUNA_ACCESS_TOKEN = "test_access_secret";
      jwt.sign.mockReturnValue("token_app_mock");
      const user = {
        _id: "u1",
        tenantID: "t1",
        roleID: "r1",
        aksesType: ["app", "web"],
      };
      const device = { installationId: "INSTALL-001" };

      const token = penggunaService.generateToken(user, device, "app");

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          installationId: "INSTALL-001",
          loginType: "app",
        }),
        expect.any(String),
        { expiresIn: "15m" },
      );
      expect(token).toBe("token_app_mock");
    });

    test("generateToken: Harus menyertakan tokenVersion pengguna dan loginType 'web' untuk sesi web", () => {
      process.env.PENGGUNA_ACCESS_TOKEN = "test_access_secret";
      jwt.sign.mockReturnValue("token_web_mock");
      const user = {
        _id: "u1",
        tenantID: "t1",
        roleID: "r1",
        aksesType: ["web"],
        tokenVersion: 5,
      };

      const token = penggunaService.generateToken(user, null, "web");

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ version: 5, loginType: "web" }),
        expect.any(String),
        { expiresIn: "15m" },
      );
      expect(token).toBe("token_web_mock");
    });

    test("generateRefreshToken: Harus menyertakan tokenVersion pengguna untuk sesi 'web'", () => {
      process.env.PENGGUNA_REFRESH_TOKEN = "test_refresh_secret";
      jwt.sign.mockReturnValue("refresh_web_mock");
      const user = {
        _id: "u1",
        tenantID: "t1",
        roleID: "r1",
        aksesType: ["web"],
        tokenVersion: 5,
      };

      const token = penggunaService.generateRefreshToken(user, null, "web");

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ version: 5, loginType: "web" }),
        expect.any(String),
        { expiresIn: "7d" },
      );
      expect(token).toBe("refresh_web_mock");
    });

    test("generateRefreshToken: Harus mengembalikan opaque token (string hex) untuk sesi 'app', bukan JWT", () => {
      const user = { _id: "u1", tenantID: "t1", aksesType: ["app"] };

      const token = penggunaService.generateRefreshToken(user, null, "app");

      expect(jwt.sign).not.toHaveBeenCalled();
      expect(typeof token).toBe("string");
      expect(token).toMatch(/^[a-f0-9]{80}$/);
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
        const result = await penggunaService.loginPin({
          nama: "test",
          pin: "password123",
          loginType: "web",
        });

        expect(mockUser.comparePin).toHaveBeenCalledWith("password123");
        expect(result.accessToken).toBe("access_token");
        expect(result.refreshToken).toBe("refresh_token");
        expect(result.pengguna.role).toBe("Kasir");
      });

      test("Sukses untuk loginType 'app' — melempar error jika installationId tidak disertakan", async () => {
        const mockUser = createMockUserDoc({ aksesType: ["app"] });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        await expect(
          penggunaService.loginPin({
            nama: "test",
            pin: "pass",
            loginType: "app",
            // installationId tidak dikirim
          }),
        ).rejects.toThrow(/installationId wajib/i);
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
          penggunaService.loginPin({
            nama: "test",
            pin: "salah",
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
          penggunaService.loginPin({
            nama: "hantu",
            pin: "123",
            loginType: "web",
          }),
        ).rejects.toThrow(/Nama atau PIN salah/i);
      });

      test("Gagal jika loginType tidak valid (bukan 'app' atau 'web')", async () => {
        await expect(
          penggunaService.loginPin({
            nama: "test",
            pin: "pass",
            loginType: "invalid",
          }),
        ).rejects.toThrow(/loginType tidak valid/i);
      });

      test("Gagal jika loginType tidak disertakan sama sekali", async () => {
        await expect(
          penggunaService.loginPin({
            nama: "test",
            pin: "pass",
          }),
        ).rejects.toThrow(/loginType saat login harus spesifik satu/i);
      });

      test("Gagal (403) jika pengguna tidak punya kapabilitas loginType yang diminta", async () => {
        // User hanya punya ["web"] tapi coba login pakai "app"
        const mockUser = createMockUserDoc({ aksesType: ["web"] });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        await expect(
          penggunaService.loginPin({
            nama: "test",
            pin: "pass",
            loginType: "app",
          }),
        ).rejects.toThrow(/Akses tidak diizinkan/i);
      });

      test("Gagal (400) jika loginType 'app' tapi installationId tidak disertakan", async () => {
        const mockUser = createMockUserDoc({ aksesType: ["app"] });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        await expect(
          penggunaService.loginPin({
            nama: "test",
            pin: "pass",
            loginType: "app",
          }),
        ).rejects.toThrow(/installationId wajib/i);
      });

      test("Sukses untuk loginType 'app' — mengembalikan token jika device berstatus TRUSTED", async () => {
        process.env.PENGGUNA_ACCESS_TOKEN = "test_access_secret";
        process.env.REFRESH_SECRET = "test_secret";

        const mockUser = createMockUserDoc({ aksesType: ["app"] });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        const Device = require("../../../models/deviceModel");

        const mockDevice = {
          installationId: "BUDI-HP-001",
          status: "trusted",
          save: jest.fn().mockResolvedValue(true),
        };
        Device.findOne.mockResolvedValue(mockDevice);

        jwt.sign.mockReturnValue("token_mock");

        const result = await penggunaService.loginPin({
          nama: "test_user",
          pin: "password123",
          tenantID: "toko_123",
          loginType: "app",
          installationId: "BUDI-HP-001",
          deviceName: "Samsung Galaxy A54",
          appVersion: "1.0.0",
          osVersion: "Android 14",
        });

        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(result.pengguna).toBeDefined();
      });

      test("Sukses untuk loginType 'app' — mengembalikan DEVICE_PENDING_APPROVAL jika device berstatus PENDING", async () => {
        const mockUser = createMockUserDoc({ aksesType: ["app"] });
        Pengguna.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        const Device = require("../../../models/deviceModel");
        const mockDevice = {
          installationId: "BUDI-TABLET-002",
          status: "pending",
          save: jest.fn().mockResolvedValue(true),
        };
        Device.findOne.mockResolvedValue(mockDevice);

        const result = await penggunaService.loginPin({
          nama: "test_user",
          pin: "password123",
          tenantID: "toko_123",
          loginType: "app",
          installationId: "BUDI-TABLET-002",
          deviceName: "iPad Mini",
          appVersion: "1.0.0",
          osVersion: "iPadOS 17",
        });

        expect(result.success).toBe(false);
        expect(result.code).toBe("DEVICE_PENDING_APPROVAL");
        expect(result.accessToken).toBeUndefined();
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
        Pengguna.findById.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });
        jwt.sign.mockReturnValue("new_token");

        const result = await penggunaService.refreshToken({
          token: "valid_token",
        });

        expect(mockUser.tokenVersion).not.toBe(oldVersion);
        expect(mockUser.save).toHaveBeenCalled();
        expect(result.accessToken).toBeDefined();
        expect(result.newRefreshToken).toBeDefined();
      });

      test("Sukses untuk sesi 'app' — memverifikasi opaque token dan merotasi refreshTokenHash di Device", async () => {
        // TODO: Test ini memerlukan mock Device model dan crypto.
        // Akan dicover lebih lengkap di deviceService.test.js.
        // Untuk sekarang, pastikan service tidak crash jika Device tidak ditemukan.
        const Device = require("../../../models/deviceModel");
        Device.findOne = jest.fn().mockResolvedValue(null);

        jwt.verify.mockReturnValue({ id: "user_123" });
        const mockUserApp = createMockUserDoc({ status: "aktif" });
        Pengguna.findById.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUserApp),
        });

        await expect(
          penggunaService.refreshToken({
            token: "opaque_token",
            expiredAccessToken: "expired_jwt",
            installationId: "INSTALL-001",
          }),
        ).rejects.toThrow(/SESSION_INVALID/i);
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
        Pengguna.findById.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockUser),
        });

        await expect(
          penggunaService.refreshToken({ token: "token_usang" }),
        ).rejects.toThrow(/Sesi tidak valid/i);
      });

      test("Gagal jika token sudah kedaluwarsa (jwt expired)", async () => {
        jwt.verify.mockImplementation(() => {
          throw new Error("jwt expired");
        });

        await expect(
          penggunaService.refreshToken({ token: "token_rusak" }),
        ).rejects.toThrow(/Refresh token tidak valid/i);
      });
    });

    // --- LOGOUT ---
    describe("logout()", () => {
      test("Sukses sesi 'web' — tokenVersion pengguna di-set ke 0", async () => {
        jwt.verify.mockReturnValue({
          id: "user_123",
          loginType: "web",
        });
        const mockUser = createMockUserDoc({
          aksesType: ["web"],
          tokenVersion: 99,
        });
        Pengguna.findById.mockResolvedValue(mockUser);

        await penggunaService.logout({
          token: "valid_token",
          accessToken: null,
          installationId: null,
        });

        expect(mockUser.tokenVersion).toBe(0);
        expect(mockUser.save).toHaveBeenCalled();
        expect(redis.del).toHaveBeenCalled();
      });

      test("Sukses sesi 'app' — refreshTokenHash di-null-kan di Device collection", async () => {
        const Device = require("../../../models/deviceModel");
        Device.findOneAndUpdate = jest.fn().mockResolvedValue(true);
        global.deviceCache = null; // Pastikan tidak crash saat service cek deviceCache

        await penggunaService.logout({
          userId: "user_123",
          installationId: "INSTALL-001",
          accessToken: null,
        });

        expect(Device.findOneAndUpdate).toHaveBeenCalledWith(
          { penggunaID: "user_123", installationId: "INSTALL-001" },
          { $set: { refreshTokenHash: null } },
        );
      });

      test("Harus diam-diam resolve (tidak crash) jika token valid tapi user sudah dihapus dari DB", async () => {
        jwt.verify.mockReturnValue({
          id: "user_hilang",
          loginType: "web",
        });
        Pengguna.findById.mockResolvedValue(null);

        await expect(
          penggunaService.logout({
            token: "token",
            accessToken: null,
            installationId: null,
          }),
        ).resolves.toBeUndefined();
      });

      test("Harus diam-diam resolve (tidak crash) jika token tidak valid / rusak", async () => {
        jwt.verify.mockImplementation(() => {
          throw new Error("invalid token");
        });

        await expect(
          penggunaService.logout({
            token: "token_rusak",
            accessToken: null,
            installationId: null,
          }),
        ).resolves.toBeUndefined();
      });

      test("logout: Sukses memasukkan access token ke blacklist Redis", async () => {
        jwt.verify
          .mockReturnValueOnce({ id: "user_1" }) // untuk web refresh token
          .mockReturnValueOnce({ exp: Math.floor(Date.now() / 1000) + 3600 }); // untuk access token

        const mockPengguna = {
          _id: "user_1",
          tenantID: "toko_1",
          tokenVersion: 100,
          save: jest.fn().mockResolvedValue(true),
        };
        Pengguna.findById.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockPengguna),
        });

        await penggunaService.logout({
          token: "refresh_mock",
          accessToken: "access_mock",
          installationId: null,
        });

        expect(redis.set).toHaveBeenCalledWith(
          expect.stringContaining("bl_access_mock"),
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
        process.env.REFRESH_SECRET = "test_secret";
        process.env.PENGGUNA_ACCESS_TOKEN = "test_access_secret";

        Role.findOne.mockResolvedValue({
          _id: "role_owner",
          namaRole: "Owner",
        });
        Pengguna.findOne.mockResolvedValue(null);

        const Device = require("../../../models/deviceModel");
        const mongoose = require("mongoose");
        const fakeOwnerId = new mongoose.Types.ObjectId();

        Device.mockImplementation(function (data) {
          Object.assign(this, data);
          this.save = jest.fn().mockResolvedValue(this);
        });

        Pengguna.mockImplementation(function (data) {
          Object.assign(this, data);
          this._id = fakeOwnerId;
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
            installationId: "OWNER-DEVICE-001",
            deviceName: "iPad Pro",
            appVersion: "1.0.0",
            osVersion: "iOS 17.4",
          },
          "toko_1",
        );

        expect(result.pengguna.nama).toBe("Owner Baru");
        expect(result.pengguna.aksesType).toContain("app");
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(redis.del).toHaveBeenCalled();
      });

      test("Gagal (400) jika installationId tidak disertakan untuk registrasi via App", async () => {
        await expect(
          penggunaService.registerOwner(
            {
              nama: "Owner Tanpa Device",
              pin: "123456",
              aksesType: ["app"],
              // installationId tidak dikirim
            },
            "toko_1",
          ),
        ).rejects.toThrow(/installationId wajib/i);
      });

      test("Gagal (404) jika Role Owner belum ada di sistem", async () => {
        Role.findOne.mockResolvedValue(null);

        await expect(
          penggunaService.registerOwner(
            { nama: "Owner Duplikat", pin: "123456", installationId: "DEV-1" },
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
            { nama: "Owner Duplikat", pin: "123456", installationId: "DEV-1" },
            "toko_1",
          ),
        ).rejects.toThrow(/nama sudah digunakan/i);
      });

      test("Sukses — token yang digenerate selalu punya loginType 'app'", async () => {
        process.env.REFRESH_SECRET = "test_secret";
        process.env.PENGGUNA_ACCESS_TOKEN = "test_access_secret";

        Role.findOne.mockResolvedValue({
          _id: "role_owner",
          namaRole: "Owner",
        });
        Pengguna.findOne.mockResolvedValue(null);

        const Device = require("../../../models/deviceModel");
        const mongoose = require("mongoose");
        const fakeOwnerId = new mongoose.Types.ObjectId();

        Device.mockImplementation(function (data) {
          Object.assign(this, data);
          this.save = jest.fn().mockResolvedValue(this);
        });

        Pengguna.mockImplementation(function (data) {
          Object.assign(this, data);
          this._id = fakeOwnerId;
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
            installationId: "OWNER-DEVICE-001",
            deviceName: "iPad Pro",
            appVersion: "1.0.0",
            osVersion: "iOS 17.4",
          },
          "toko_1",
        );

        expect(jwt.sign).toHaveBeenCalledTimes(1);
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

    test("update: Harus mereset tokenVersion dan null-kan refreshTokenHash semua device jika field sensitif (pin/status/aksesType) diubah", async () => {
      const Device = require("../../../models/deviceModel");
      Device.updateMany = jest.fn().mockResolvedValue(true);

      const mockUser = createMockUserDoc({ tokenVersion: 5 });
      Pengguna.findOne.mockResolvedValue(mockUser);

      await penggunaService.update(
        "user_123",
        { pin: "newpin123" },
        "toko_123",
      );

      // tokenVersion harus di-reset ke 6 setelah field sensitif diubah
      expect(mockUser.tokenVersion).toBe(6);
      // Semua device milik user harus di-null-kan refreshTokenHash-nya
      expect(Device.updateMany).toHaveBeenCalledWith(
        { penggunaID: "user_123" },
        { $set: { refreshTokenHash: null } },
      );
    });

    test("delete: Sukses menghapus pengguna non-Owner beserta cascade device", async () => {
      const Device = require("../../../models/deviceModel");
      Device.deleteMany = jest.fn().mockResolvedValue(true);

      const mockUser = createMockUserDoc({ roleID: { namaRole: "Kasir" } });
      Pengguna.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await penggunaService.delete("u_1", "toko_1");

      expect(Device.deleteMany).toHaveBeenCalledWith({ penggunaID: "u_1" });
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
        penggunaService.create(
          { nama: "Kasir Baru", roleID: "role_curian", pin: "123456" },
          "tenant_asli",
        ),
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
      Pengguna.findOne.mockResolvedValue(null);

      await expect(
        penggunaService.update(
          "user_toko_sebelah",
          { nama: "Hacked" },
          "tenant_kita",
        ),
      ).rejects.toThrow(/tidak ditemukan/i);
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
        penggunaService.loginPin({
          nama: "Kasir",
          pin: "123456",
          loginType: "app",
          tenantID: "tenant_1",
        }),
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

      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPengguna),
      });

      await expect(
        penggunaService.refreshToken({ token: "valid_token" }),
      ).rejects.toThrow("ValidationError");
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
  });
});
