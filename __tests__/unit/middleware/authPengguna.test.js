const authPengguna = require("../../../middleware/authPengguna");
const jwt = require("jsonwebtoken");
const Pengguna = require("../../../models/penggunaModel");

// Mocking dependencies
jest.mock("jsonwebtoken");
jest.mock("../../../models/penggunaModel");

describe("Unit Test Middleware — authPengguna", () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  // Helper untuk memanipulasi rantai Mongoose (findById -> select -> populate -> lean)
  const mockPenggunaChain = (resolvedValue) => {
    Pengguna.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(resolvedValue),
    });
  };

  // ==========================================
  // VALIDASI DASAR JWT & ENTITAS
  // ==========================================

  test("Skenario 1 — Menolak akses jika tidak ada header Authorization", async () => {
    await authPengguna(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("Skenario 2 — Menolak akses jika token tidak valid atau dimanipulasi", async () => {
    req.headers.authorization = "Bearer token_palsu";
    jwt.verify.mockImplementation(() => {
      throw new Error("Invalid");
    });

    await authPengguna(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  test("Skenario 3 — Menolak akses jika data pengguna sudah dihapus dari DB", async () => {
    req.headers.authorization = "Bearer token_valid";
    jwt.verify.mockReturnValue({ id: "user_123" });
    mockPenggunaChain(null); // Simulasi DB kosong

    await authPengguna(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  // ==========================================
  // PENGUJIAN ANTI-BYPASS UNTUK APLIKASI KASIR
  // ==========================================

  test("Skenario 4 [CRITICAL] — Memblokir bypass jika pengguna App tidak mengirimkan deviceID", async () => {
    req.headers.authorization = "Bearer token_app_tanpa_device";

    // Payload dari token sengaja tidak memuat deviceID
    jwt.verify.mockReturnValue({ id: "user_123", version: 1 });

    mockPenggunaChain({
      _id: "user_123",
      roleID: { namaRole: "Owner", permissions: [] }, // Meskipun dia Owner!
      aksesType: "app", // Tipe akses adalah aplikasi
      device: [{ deviceID: "DEV-SAH-01", tokenVersion: 1 }],
    });

    await authPengguna(req, res, next);

    // Sistem HARUS menolak dengan status 401
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Device ID tidak ditemukan/i),
      }),
    );
  });

  test("Skenario 5 [CRITICAL] — Memblokir bypass jika pengguna App menggunakan device yang tidak dikenali", async () => {
    req.headers.authorization = "Bearer token_app_device_hantu";

    // Payload memuat deviceID, tapi deviceID ini tidak ada di database
    jwt.verify.mockReturnValue({
      id: "user_123",
      deviceID: "DEV-HANTU-99",
      version: 1,
    });

    mockPenggunaChain({
      _id: "user_123",
      roleID: { namaRole: "Kasir", permissions: [] },
      aksesType: "app",
      device: [{ deviceID: "DEV-SAH-01", tokenVersion: 1 }], // DEV-HANTU-99 tidak ada di sini
    });

    await authPengguna(req, res, next);

    // Sistem HARUS menolak
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Perangkat tidak dikenali/i),
      }),
    );
  });

  test("Skenario 6 — Memblokir akses App jika tokenVersion perangkat kedaluwarsa (di-revoke)", async () => {
    req.headers.authorization = "Bearer token_app_kadaluwarsa";

    // Token masih membawa versi 1
    jwt.verify.mockReturnValue({
      id: "user_123",
      deviceID: "DEV-SAH-01",
      version: 1,
    });

    mockPenggunaChain({
      _id: "user_123",
      roleID: { namaRole: "Kasir", permissions: [] },
      aksesType: "app",
      device: [{ deviceID: "DEV-SAH-01", tokenVersion: 2 }], // DB sudah naik ke versi 2 (di-reset oleh manajer)
    });

    await authPengguna(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  // ==========================================
  // PENGUJIAN AKSES WEB & SKENARIO SUKSES
  // ==========================================

  test("Skenario 7 — Memblokir akses Web jika tokenVersion root kedaluwarsa", async () => {
    req.headers.authorization = "Bearer token_web_kadaluwarsa";

    // Token web membawa versi 1
    jwt.verify.mockReturnValue({ id: "user_web", version: 1 });

    mockPenggunaChain({
      _id: "user_web",
      roleID: { namaRole: "Manager", permissions: [] },
      aksesType: "web",
      tokenVersion: 2, // DB sudah naik ke versi 2
    });

    await authPengguna(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("Skenario 8 — Lolos validasi sempurna untuk pengguna Web", async () => {
    req.headers.authorization = "Bearer token_web_valid";
    jwt.verify.mockReturnValue({ id: "user_web", version: 2 });

    mockPenggunaChain({
      _id: "user_web",
      roleID: { namaRole: "Manager", permissions: [{ nama: "read-laporan" }] },
      aksesType: "web",
      tokenVersion: 2,
    });

    await authPengguna(req, res, next);

    // Next dipanggil tanpa error
    expect(next).toHaveBeenCalledWith();
    expect(req.pengguna.aksesType).toBe("web");
    expect(req.pengguna.permissions).toContain("read-laporan");
  });

  test("Skenario 9 — Lolos validasi sempurna untuk pengguna App dengan device valid", async () => {
    req.headers.authorization = "Bearer token_app_valid";
    jwt.verify.mockReturnValue({
      id: "user_app",
      deviceID: "DEV-SAH-01",
      version: 3,
    });

    mockPenggunaChain({
      _id: "user_app",
      roleID: { namaRole: "Kasir", permissions: [{ nama: "akses-pos" }] },
      aksesType: "app",
      device: [{ deviceID: "DEV-SAH-01", type: "primary", tokenVersion: 3 }],
    });

    await authPengguna(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.pengguna.aksesType).toBe("app");
    expect(req.pengguna.permissions).toContain("akses-pos");
  });

  test("Skenario 10 — Menolak akses dengan status 401 khusus jika token expired", async () => {
    req.headers.authorization = "Bearer token_kadaluwarsa_jwt";

    // Memanipulasi error agar terdeteksi sebagai TokenExpiredError bawaan jsonwebtoken
    const expiredError = new Error("jwt expired");
    expiredError.name = "TokenExpiredError";

    jwt.verify.mockImplementation(() => {
      throw expiredError;
    });

    await authPengguna(req, res, next);

    // Harus 401, bukan 403
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Sesi telah berakhir/i),
      }),
    );
  });

  test("Skenario 11 — Menolak akses (403) jika role pengguna telah dihapus dari database", async () => {
    req.headers.authorization = "Bearer token_web_valid";
    jwt.verify.mockReturnValue({ id: "user_yatim_role", version: 1 });

    mockPenggunaChain({
      _id: "user_yatim_role",
      roleID: null, // Simulasi ekstrim: Jabatan dihapus dari DB, jadi referensinya null
      aksesType: "web",
      tokenVersion: 1,
    });

    await authPengguna(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 403,
        message: expect.stringMatching(
          /Role pengguna tidak valid atau telah dihapus/i,
        ),
      }),
    );
  });

  test("Skenario 12 — Menolak akses jika format Authorization bukan Bearer", async () => {
    // Klien ceroboh mengirim Basic token atau sekadar string tanpa spasi
    req.headers.authorization = "Basic token_rahasia_app";

    await authPengguna(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Token pengguna tidak ditemukan/i),
      }),
    );
  });

  test("Skenario 13 — Meneruskan error ke next() jika terjadi kegagalan fatal pada database", async () => {
    req.headers.authorization = "Bearer token_valid_tapi_db_mati";
    jwt.verify.mockReturnValue({ id: "user_123", version: 1 });

    const dbError = new Error("Koneksi MongoDB terputus total!");

    // Mocking kegagalan query
    Pengguna.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(dbError),
    });

    await authPengguna(req, res, next);

    // Sistem tidak boleh mati (silent crash), harus melempar error ke error handler
    expect(next).toHaveBeenCalledWith(dbError);
  });
});
