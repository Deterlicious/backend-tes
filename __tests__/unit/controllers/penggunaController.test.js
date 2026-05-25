const penggunaController = require("../../../controllers/penggunaController");
const penggunaService = require("../../../services/penggunaService");

// fix: OPEN HANDLES: Membungkam Logger dan Koneksi Eksternal
jest.mock("../../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

// Mocking Service mutlak agar kita murni menguji Controller
jest.mock("../../../services/penggunaService");

describe("Unit Test — Pengguna Controller", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      params: {},
      cookies: {},
      headers: {
        authorization: null,
      },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    next = jest.fn();
  });

  // 1. MANAJEMEN OWNER & CONTEXT
  describe("Register Owner & Context Checker", () => {
    test("registerOwner: Harus sukses jika context adalah AKUN (SaaS)", async () => {
      req.akunContext = { tenantID: "toko_123" };
      req.body = {
        nama: "Owner Baru",
        pin: "123456",
        aksesType: "app",
        installationId: "OWNER-DEVICE-001",
        deviceName: "iPad Pro",
        appVersion: "1.0.0",
        osVersion: "iOS 17.4",
      };
      penggunaService.registerOwner.mockResolvedValue({
        pengguna: { nama: "Owner Baru" },
        accessToken: "token_mock",
        refreshToken: "refresh_mock",
        device: null,
      });

      await penggunaController.registerOwner(req, res, next);

      expect(penggunaService.registerOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          nama: "Owner Baru",
          installationId: "OWNER-DEVICE-001",
        }),
        "toko_123",
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/Owner berhasil didaftarkan/i),
        }),
      );
    });

    test("registerOwner: Harus melempar 403 jika diakses menggunakan Token Pengguna (Karyawan)", async () => {
      req.pengguna = { tenantID: "toko_123" };
      await penggunaController.registerOwner(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("checkOwner: Harus sukses mengembalikan status owner jika menggunakan Token Akun", async () => {
      req.akunContext = { tenantID: "toko_123" };
      penggunaService.checkOwnerExists.mockResolvedValue(true);

      await penggunaController.checkOwner(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        message: expect.any(String),
        data: { hasOwner: true },
      });
    });

    test("checkOwner [SKENARIO BARU]: Harus melempar 403 jika diakses oleh Karyawan", async () => {
      req.pengguna = { tenantID: "toko_123" }; // Konteks karyawan

      await penggunaController.checkOwner(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 403,
          message: expect.stringMatching(/Akses ditolak/i),
        }),
      );
    });

    test("_ensureTenant [SKENARIO BARU]: Harus melempar 400 jika konteks otentikasi mutlak kosong", async () => {
      // Tidak ada req.akunContext dan req.pengguna
      await penggunaController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.stringMatching(/Tenant tidak ditemukan/i),
        }),
      );
    });

    test("_ensureTenant [EDGE CASE]: Harus melempar 400 jika Akun valid tapi belum memiliki tenantID (Akun baru belum buat toko)", async () => {
      req.akunContext = { id: "akun_tanpa_toko" }; // tenantID sengaja tidak ada
      await penggunaController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.stringMatching(/Tenant tidak ditemukan/i),
        }),
      );
    });
  });

  // 2. OTENTIKASI (LOGIN, REFRESH, LOGOUT)
  describe("Otentikasi & Manajemen Cookie", () => {
    test("loginPin: Harus set cookie 'refreshToken' dan mengembalikan accessToken", async () => {
      req.akunContext = { tenantID: "toko_123" };
      req.body = {
        nama: "kasir",
        pin: "123456",
        loginType: "app",
        installationId: "BUDI-HP-001",
        deviceName: "Samsung Galaxy A54",
        appVersion: "1.0.0",
        osVersion: "Android 14",
      };
      penggunaService.loginPin.mockResolvedValue({
        status: "trusted",
        accessToken: "access_token_123",
        refreshToken: "refresh_token_123",
        pengguna: { nama: "Kasir A" },
        device: { installationId: "BUDI-HP-001", status: "trusted" },
      });

      await penggunaController.loginPin(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "refresh_token_123",
        expect.objectContaining({ path: "/", httpOnly: true }),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: "access_token_123",
          success: true,
        }),
      );
    });

    test("refreshToken: Harus sukses membaca cookie dan menerbitkan token baru", async () => {
      req.cookies.refreshToken = "old_refresh_token";
      req.headers.authorization = null;
      penggunaService.refreshToken.mockResolvedValue({
        accessToken: "new_access",
        newRefreshToken: "new_refresh",
      });

      await penggunaController.refreshToken(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "new_refresh",
        expect.any(Object),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { accessToken: "new_access" },
        }),
      );
    });

    test("refreshToken [SKENARIO BARU]: Harus bisa membaca token dari req.body jika cookie kosong (Fallback)", async () => {
      req.cookies = {};
      req.body.refreshToken = "token_dari_body";
      req.headers.authorization = null;

      penggunaService.refreshToken.mockResolvedValue({
        accessToken: "new_access",
        newRefreshToken: "new_refresh",
      });

      await penggunaController.refreshToken(req, res, next);

      expect(penggunaService.refreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ token: "token_dari_body" }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "new_refresh",
        expect.any(Object),
      );
    });

    test("refreshToken: Harus melempar 401 jika cookie dan body tidak memiliki token", async () => {
      req.cookies = {};
      req.body = {};
      await penggunaController.refreshToken(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401 }),
      );
    });

    test("refreshToken [ALUR APP]: Harus memanggil refreshTokenApp dan return token baru via body jika installationId disertakan", async () => {
      req.body = {
        refreshToken: "opaque_token_lama",
        installationId: "BUDI-HP-001",
      };
      req.headers.authorization = "Bearer expired_access_token";

      penggunaService.refreshToken.mockResolvedValue({
        accessToken: "new_access_token",
        newRefreshToken: "new_opaque_token",
      });

      await penggunaController.refreshToken(req, res, next);

      expect(penggunaService.refreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "opaque_token_lama",
          installationId: "BUDI-HP-001",
          expiredAccessToken: "expired_access_token",
        }),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessToken: "new_access_token",
            refreshToken: "new_opaque_token",
          }),
        }),
      );
      // Cookie tidak di-set untuk alur app
      expect(res.cookie).not.toHaveBeenCalled();
    });

    test("logout: Harus clearCookie 'refreshToken' dan sukses memanggil service", async () => {
      req.cookies.refreshToken = "token_to_revoke";
      req.headers.authorization = "Bearer access_token_mock";
      req.body = {};
      penggunaService.logout.mockResolvedValue(true);

      await penggunaController.logout(req, res, next);

      expect(penggunaService.logout).toHaveBeenCalledWith(
        expect.objectContaining({ token: "token_to_revoke" }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        "refreshToken",
        expect.objectContaining({ path: "/" }),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: "Logout berhasil." }),
      );
    });

    test("logout [SKENARIO BARU]: Harus tetap clearCookie dan merespons 200 meskipun tidak ada token yang dikirim (Idempotent)", async () => {
      req.cookies = {};
      req.body = {}; // Request logout kosong melompong

      await penggunaController.logout(req, res, next);

      // Service tidak boleh dipanggil karena tidak ada token yang di-revoke
      expect(penggunaService.logout).not.toHaveBeenCalled();
      // Tapi cookie tetap harus disapu bersih
      expect(res.clearCookie).toHaveBeenCalledWith(
        "refreshToken",
        expect.any(Object),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: "Logout berhasil." }),
      );
    });

    test("logout [DEFENSIF]: Harus tetap clearCookie meskipun Service melempar error", async () => {
      req.cookies.refreshToken = "token_to_revoke";
      req.headers.authorization = "Bearer access_token_mock";
      req.body = {};

      const dbError = new Error("Database timeout");
      penggunaService.logout.mockRejectedValue(dbError);

      await penggunaController.logout(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith(
        "refreshToken",
        expect.objectContaining({ path: "/" }),
      );
      expect(next).toHaveBeenCalledWith(dbError);
    });

    test("logout [ALUR APP]: Harus memanggil service dengan userId dan installationId jika request dari mobile", async () => {
      req.body = { installationId: "BUDI-HP-001" };
      req.headers.authorization = "Bearer access_token_mock";
      req.cookies.refreshToken = "opaque_token";
      req.pengguna = { id: "user_123" };

      penggunaService.logout.mockResolvedValue(true);

      await penggunaController.logout(req, res, next);

      expect(penggunaService.logout).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_123",
          installationId: "BUDI-HP-001",
        }),
      );
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    test("registerOwner: Harus sukses dengan aksesType 'web' tanpa installationId", async () => {
      req.akunContext = { tenantID: "toko_123" };
      req.body = { nama: "Owner Web", pin: "123456", aksesType: "web" };

      penggunaService.registerOwner.mockResolvedValue({
        id: "user_1",
        nama: "Owner Web",
        aksesType: "web",
        accessToken: "token_abc",
        refreshToken: "refresh_abc",
      });

      await penggunaController.registerOwner(req, res, next);

      // Service dipanggil tanpa installationId
      expect(penggunaService.registerOwner).toHaveBeenCalledWith(
        expect.objectContaining({ aksesType: ["web"] }),
        "toko_123",
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(next).not.toHaveBeenCalled();
    });

    test("registerOwner: Harus throw 400 jika aksesType 'app' tapi tidak ada installationId", async () => {
      req.akunContext = { tenantID: "toko_123" };
      // installationId sengaja tidak dikirim, aksesType app
      req.body = { nama: "Owner App", pin: "123456", aksesType: "app" };

      await penggunaController.registerOwner(req, res, next);

      // Harus gagal di controller sebelum sampai ke service
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.stringMatching(/installationId wajib/i),
        }),
      );
      expect(penggunaService.registerOwner).not.toHaveBeenCalled();
    });

    test("registerOwner: Harus throw 400 jika tidak ada installationId dan aksesType tidak dikirim (default app)", async () => {
      req.akunContext = { tenantID: "toko_123" };
      // aksesType tidak dikirim → default "app" → wajib installationId
      req.body = { nama: "Owner Default", pin: "123456" };

      await penggunaController.registerOwner(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.stringMatching(/installationId wajib/i),
        }),
      );
      expect(penggunaService.registerOwner).not.toHaveBeenCalled();
    });

    test("loginPin: Harus throw 400 jika aksesType 'app' tapi tidak ada installationId", async () => {
      req.akunContext = { tenantID: "toko_123" };
      // installationId sengaja tidak dikirim
      req.body = { nama: "kasir", pin: "123456" };

      // Service throw 400 karena tidak ada installationId untuk pengguna app
      const err = Object.assign(new Error("Device ID wajib disertakan."), {
        status: 400,
      });
      penggunaService.loginPin.mockRejectedValue(err);

      await penggunaController.loginPin(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400 }),
      );
      // Cookie tidak boleh di-set jika login gagal
      expect(res.cookie).not.toHaveBeenCalled();
    });

    test("loginPin: Harus sukses untuk aksesType 'web' tanpa installationId", async () => {
      req.akunContext = { tenantID: "toko_123" };
      req.body = { nama: "kasir web", pin: "123456" }; // Tidak ada installationId

      penggunaService.loginPin.mockResolvedValue({
        accessToken: "access_web_token",
        refreshToken: "refresh_web_token",
        pengguna: { nama: "Kasir Web", aksesType: "web" },
      });

      await penggunaController.loginPin(req, res, next);

      // Service dipanggil tanpa installationId
      expect(penggunaService.loginPin).toHaveBeenCalledWith(
        expect.objectContaining({
          nama: "kasir web",
          pin: "123456",
          tenantID: "toko_123",
          installationId: undefined,
        }),
      );

      // Cookie tetap di-set
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "refresh_web_token",
        expect.objectContaining({ httpOnly: true }),
      );

      // accessToken di root response
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: "access_web_token" }),
      );

      expect(next).not.toHaveBeenCalled();
    });

    test("loginPin: Harus memanggil next(err) jika service throw error apapun", async () => {
      req.akunContext = { tenantID: "toko_123" };
      req.body = { nama: "kasir", pin: "salah" };

      const err = Object.assign(new Error("Nama atau PIN salah."), {
        status: 401,
      });
      penggunaService.loginPin.mockRejectedValue(err);

      await penggunaController.loginPin(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("loginPin: Harus return 200 dengan success false dan code DEVICE_PENDING_APPROVAL jika device masih pending", async () => {
      req.akunContext = { tenantID: "toko_123" };
      req.body = {
        nama: "kasir",
        pin: "123456",
        loginType: "app",
        installationId: "BUDI-TABLET-002",
        deviceName: "iPad Mini",
        appVersion: "1.0.0",
        osVersion: "iPadOS 17",
      };
      penggunaService.loginPin.mockResolvedValue({
        success: false,
        code: "DEVICE_PENDING_APPROVAL",
        status: "pending",
        pengguna: { nama: "kasir" },
        device: {
          installationId: "BUDI-TABLET-002",
          pendingExpiresAt: new Date("2026-05-26"),
        },
      });

      await penggunaController.loginPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "DEVICE_PENDING_APPROVAL",
          message: expect.stringMatching(/menunggu persetujuan/i),
        }),
      );
      expect(res.cookie).not.toHaveBeenCalled();
    });

    test("loginPin: Harus menyertakan device.installationId dan device.status di response jika device TRUSTED", async () => {
      req.akunContext = { tenantID: "toko_123" };
      req.body = {
        nama: "kasir",
        pin: "123456",
        loginType: "app",
        installationId: "BUDI-HP-001",
        deviceName: "Samsung Galaxy A54",
        appVersion: "1.0.0",
        osVersion: "Android 14",
      };
      penggunaService.loginPin.mockResolvedValue({
        status: "trusted",
        accessToken: "access_token_123",
        refreshToken: "refresh_token_123",
        pengguna: { nama: "kasir" },
        device: {
          installationId: "BUDI-HP-001",
          status: "trusted",
        },
      });

      await penggunaController.loginPin(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            device: expect.objectContaining({
              installationId: "BUDI-HP-001",
              status: "trusted",
            }),
          }),
        }),
      );
    });

    test("registerOwner [EDGE CASE]: Harus throw 400 jika aksesType berupa Array ['web', 'app'] dan tidak ada installationId", async () => {
      req.akunContext = { tenantID: "toko_123" };
      req.body = {
        nama: "Owner Multi",
        pin: "123456",
        aksesType: ["web", "app"],
      }; // Multi akses tanpa installationId

      await penggunaController.registerOwner(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.stringMatching(/installationId wajib/i),
        }),
      );
      expect(penggunaService.registerOwner).not.toHaveBeenCalled();
    });
  });

  // 3. CRUD & DEVICE MANAGEMENT
  describe("CRUD Pengguna & Device Management", () => {
    beforeEach(() => {
      req.pengguna = { tenantID: "toko_123" };
    });

    test("create: Harus meneruskan data ke service dan return 201", async () => {
      req.body = { nama: "Baru" };
      await penggunaController.create(req, res, next);
      expect(penggunaService.create).toHaveBeenCalledWith(req.body, "toko_123");
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("getAll: Harus sukses ambil data", async () => {
      penggunaService.getAll.mockResolvedValue([1, 2]);
      await penggunaController.getAll(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ total: 2 }),
      );
    });

    test("getById & update & delete: Harus meneruskan penggunaID", async () => {
      req.params.id = "user_99";

      await penggunaController.getById(req, res, next);
      expect(penggunaService.getById).toHaveBeenCalledWith(
        "user_99",
        "toko_123",
      );

      await penggunaController.update(req, res, next);
      expect(penggunaService.update).toHaveBeenCalledWith(
        "user_99",
        req.body,
        "toko_123",
      );

      await penggunaController.delete(req, res, next);
      expect(penggunaService.delete).toHaveBeenCalledWith(
        "user_99",
        "toko_123",
      );
    });

    test("Error Handling Umum: Jika Service gagal, harus over ke next(err)", async () => {
      const err = new Error("General error");
      penggunaService.getAll.mockRejectedValue(err);

      await penggunaController.getAll(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
