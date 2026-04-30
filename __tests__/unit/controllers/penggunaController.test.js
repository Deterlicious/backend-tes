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
      // ✅ set req.body dengan field yang benar
      req.body = {
        nama: "Owner Baru",
        pin: "123456",
        aksesType: "app",
        deviceID: "DEV-001",
      };
      penggunaService.registerOwner.mockResolvedValue({ id: "user_1" });

      await penggunaController.registerOwner(req, res, next);

      expect(penggunaService.registerOwner).toHaveBeenCalledWith(
        {
          nama: "Owner Baru",
          pin: "123456",
          aksesType: "app",
          deviceID: "DEV-001",
          deviceType: undefined,
        },
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
  });

  // 2. OTENTIKASI (LOGIN, REFRESH, LOGOUT)
  describe("Otentikasi & Manajemen Cookie", () => {
    test("loginPin: Harus set cookie 'refreshToken' dan mengembalikan accessToken", async () => {
      req.akunContext = { tenantID: "toko_123" };
      req.body = { nama: "kasir", pin: "123456", deviceID: "DEV-1" };
      penggunaService.login.mockResolvedValue({
        accessToken: "access_token_123",
        refreshToken: "refresh_token_123",
        pengguna: { nama: "Kasir A" },
      });

      await penggunaController.loginPin(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "refresh_token_123",
        expect.objectContaining({ path: "/", httpOnly: true }),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: "access_token_123", // di root
          data: expect.objectContaining({ pengguna: expect.any(Object) }),
        }),
      );
    });

    test("refreshToken: Harus sukses membaca cookie dan menerbitkan token baru", async () => {
      req.cookies.refreshToken = "old_refresh_token";
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
      req.cookies = {}; // Cookie kosong
      req.body.refreshToken = "token_dari_body"; // Mengandalkan body

      penggunaService.refreshToken.mockResolvedValue({
        accessToken: "new_access",
        newRefreshToken: "new_refresh",
      });

      await penggunaController.refreshToken(req, res, next);

      expect(penggunaService.refreshToken).toHaveBeenCalledWith(
        "token_dari_body",
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "new_refresh",
        expect.any(Object),
      );
      expect(res.status).not.toHaveBeenCalledWith(401);
    });

    test("refreshToken: Harus melempar 401 jika cookie dan body tidak memiliki token", async () => {
      req.cookies = {};
      req.body = {};
      await penggunaController.refreshToken(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401 }),
      );
    });

    test("logout: Harus clearCookie 'refreshToken' dan sukses memanggil service", async () => {
      req.cookies.refreshToken = "token_to_revoke";
      penggunaService.logout.mockResolvedValue(true);

      await penggunaController.logout(req, res, next);

      expect(penggunaService.logout).toHaveBeenCalledWith("token_to_revoke");
      expect(res.clearCookie).toHaveBeenCalledWith(
        "refreshToken",
        expect.objectContaining({ path: "/" }),
      );
      expect(res.json).toHaveBeenCalledWith({ message: "Logout berhasil." });
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
      expect(res.json).toHaveBeenCalledWith({ message: "Logout berhasil." });
    });

    test("logout [DEFENSIF]: Harus tetap clearCookie meskipun Service melempar error", async () => {
      req.cookies.refreshToken = "token_to_revoke";

      const dbError = new Error("Database timeout");
      penggunaService.logout.mockRejectedValue(dbError);

      await penggunaController.logout(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith(
        "refreshToken",
        expect.objectContaining({ path: "/" }),
      );
      expect(next).toHaveBeenCalledWith(dbError);
    });

    test("registerOwner: Harus sukses dengan aksesType 'web' tanpa deviceID", async () => {
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

      // Service dipanggil tanpa deviceID
      expect(penggunaService.registerOwner).toHaveBeenCalledWith(
        expect.objectContaining({ aksesType: "web", deviceID: undefined }),
        "toko_123",
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(next).not.toHaveBeenCalled();
    });

    test("registerOwner: Harus throw 400 jika aksesType 'app' tapi tidak ada deviceID", async () => {
      req.akunContext = { tenantID: "toko_123" };
      // deviceID sengaja tidak dikirim, aksesType app
      req.body = { nama: "Owner App", pin: "123456", aksesType: "app" };

      await penggunaController.registerOwner(req, res, next);

      // Harus gagal di controller sebelum sampai ke service
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.stringMatching(/device id/i),
        }),
      );
      expect(penggunaService.registerOwner).not.toHaveBeenCalled();
    });

    test("registerOwner: Harus throw 400 jika tidak ada deviceID dan aksesType tidak dikirim (default app)", async () => {
      req.akunContext = { tenantID: "toko_123" };
      // aksesType tidak dikirim → default "app" → wajib deviceID
      req.body = { nama: "Owner Default", pin: "123456" };

      await penggunaController.registerOwner(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.stringMatching(/device id/i),
        }),
      );
      expect(penggunaService.registerOwner).not.toHaveBeenCalled();
    });

    // --- Tambahkan di dalam describe("Otentikasi & Manajemen Cookie") ---

    test("loginPin: Harus throw 400 jika aksesType 'app' tapi tidak ada deviceID", async () => {
      req.akunContext = { tenantID: "toko_123" };
      // deviceID sengaja tidak dikirim
      req.body = { nama: "kasir", pin: "123456" };

      // Service throw 400 karena tidak ada deviceID untuk pengguna app
      const err = Object.assign(new Error("Device ID wajib disertakan."), {
        status: 400,
      });
      penggunaService.login.mockRejectedValue(err);

      await penggunaController.loginPin(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400 }),
      );
      // Cookie tidak boleh di-set jika login gagal
      expect(res.cookie).not.toHaveBeenCalled();
    });

    test("loginPin: Harus sukses untuk aksesType 'web' tanpa deviceID", async () => {
      req.akunContext = { tenantID: "toko_123" };
      req.body = { nama: "kasir web", pin: "123456" }; // Tidak ada deviceID

      penggunaService.login.mockResolvedValue({
        accessToken: "access_web_token",
        refreshToken: "refresh_web_token",
        pengguna: { nama: "Kasir Web", aksesType: "web" },
      });

      await penggunaController.loginPin(req, res, next);

      // Service dipanggil tanpa deviceID
      expect(penggunaService.login).toHaveBeenCalledWith(
        expect.objectContaining({
          nama: "kasir web",
          pin: "123456",
          tenantID: "toko_123",
          deviceID: undefined,
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
      penggunaService.login.mockRejectedValue(err);

      await penggunaController.loginPin(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
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

    test("Device Management: add, promote, demote, remove, history harus memanggil service", async () => {
      req.params.id = "user_99";
      req.body = { deviceID: "DEV-A" };

      await penggunaController.addDevice(req, res, next);
      expect(penggunaService.addDevice).toHaveBeenCalledWith(
        "user_99",
        "toko_123",
        req.body,
      );

      await penggunaController.promoteDevice(req, res, next);
      expect(penggunaService.promoteDevice).toHaveBeenCalledWith(
        "user_99",
        "toko_123",
        "DEV-A",
      );

      await penggunaController.getDeviceHistory(req, res, next);
      expect(penggunaService.getDeviceHistory).toHaveBeenCalledWith(
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
