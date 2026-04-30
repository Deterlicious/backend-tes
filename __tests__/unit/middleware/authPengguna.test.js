const authPengguna = require("../../../middleware/authPengguna");
const jwt = require("jsonwebtoken");
const Pengguna = require("../../../models/penggunaModel");
const redis = require("../../../config/redis");

// Mocking dependencies
jest.mock("jsonwebtoken");
jest.mock("../../../models/penggunaModel");
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
})); // Membungkam Redis agar tidak error

describe("Unit Test Middleware — authPengguna", () => {
  let req, res, next;

  beforeEach(() => {
    // FIX: Menggunakan optional chaining secara implisit dengan req dasar
    req = { headers: {} };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();

    // DEFAULT BEHAVIOR: Simulasi Cache Miss (Data tidak ada di Redis)
    // Agar skenario lama yang bergantung pada Mongoose tetap berjalan mulus
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue("OK");
  });

  // Helper untuk memanipulasi rantai Mongoose (findById -> select -> populate -> lean)
  const mockPenggunaChain = (resolvedValue) => {
    Pengguna.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(resolvedValue),
    });
  };

  // validasi dasar jwt
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

  // pengujian anti bypass untuk aplikasi
  test("Skenario 4 [CRITICAL] — Memblokir bypass jika pengguna App tidak mengirimkan deviceID", async () => {
    req.headers.authorization = "Bearer token_app_tanpa_device";

    // Payload dari token sengaja tidak memuat deviceID
    jwt.verify.mockReturnValue({ id: "user_123", version: 1 });

    mockPenggunaChain({
      _id: "user_123",
      roleID: { namaRole: "Owner", permissions: [] },
      aksesType: "app",
      device: [{ deviceID: "DEV-SAH-01", tokenVersion: 1 }],
    });

    await authPengguna(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Device ID tidak ditemukan/i),
      }),
    );
  });

  test("Skenario 5 [CRITICAL] — Memblokir bypass jika pengguna App menggunakan device yang tidak dikenali", async () => {
    req.headers.authorization = "Bearer token_app_device_hantu";

    jwt.verify.mockReturnValue({
      id: "user_123",
      deviceID: "DEV-HANTU-99",
      version: 1,
    });

    mockPenggunaChain({
      _id: "user_123",
      roleID: { namaRole: "Kasir", permissions: [] },
      aksesType: "app",
      device: [{ deviceID: "DEV-SAH-01", tokenVersion: 1 }],
    });

    await authPengguna(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Perangkat tidak dikenali/i),
      }),
    );
  });

  test("Skenario 6 — Memblokir akses App jika tokenVersion perangkat kedaluwarsa (di-revoke)", async () => {
    req.headers.authorization = "Bearer token_app_kadaluwarsa";

    jwt.verify.mockReturnValue({
      id: "user_123",
      deviceID: "DEV-SAH-01",
      version: 1,
    });

    mockPenggunaChain({
      _id: "user_123",
      roleID: { namaRole: "Kasir", permissions: [] },
      aksesType: "app",
      device: [{ deviceID: "DEV-SAH-01", tokenVersion: 2 }],
    });

    await authPengguna(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  // pengujian akses web
  test("Skenario 7 — Memblokir akses Web jika tokenVersion root kedaluwarsa", async () => {
    req.headers.authorization = "Bearer token_web_kadaluwarsa";
    jwt.verify.mockReturnValue({ id: "user_web", version: 1 });

    mockPenggunaChain({
      _id: "user_web",
      roleID: { namaRole: "Manager", permissions: [] },
      aksesType: "web",
      tokenVersion: 2,
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

    expect(next).toHaveBeenCalledWith();
    expect(req.pengguna.aksesType).toBe("web");
    expect(req.pengguna.permissions).toContain("read-laporan");
    // Karena ini Cache Miss, pastikan sistem mencoba menyimpannya ke Redis
    expect(redis.set).toHaveBeenCalled();
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

  test("Skenario 10 — Menolak akses khusus jika token expired (TokenExpiredError)", async () => {
    req.headers.authorization = "Bearer token_kadaluwarsa_jwt";

    const expiredError = new Error("jwt expired");
    expiredError.name = "TokenExpiredError";
    jwt.verify.mockImplementation(() => {
      throw expiredError;
    });

    await authPengguna(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Sesi telah berakhir/i),
      }),
    );
  });

  test("Skenario 11 — Menolak akses (401) jika role pengguna telah dihapus dari database", async () => {
    req.headers.authorization = "Bearer token_web_valid";
    jwt.verify.mockReturnValue({ id: "user_yatim_role", version: 1 });

    mockPenggunaChain({
      _id: "user_yatim_role",
      roleID: null,
      aksesType: "web",
      tokenVersion: 1,
    });

    await authPengguna(req, res, next);

    // Di middleware baru, ketiadaan role dianggap sesi tidak valid (401)
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(
          /Sesi tidak valid atau role telah dihapus/i,
        ),
      }),
    );
  });

  test("Skenario 12 — Menolak akses jika format Authorization bukan Bearer", async () => {
    req.headers.authorization = "Basic token_rahasia_app";
    await authPengguna(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("Skenario 13 — Meneruskan error ke next() jika terjadi kegagalan fatal pada database", async () => {
    req.headers.authorization = "Bearer token_valid_tapi_db_mati";
    jwt.verify.mockReturnValue({ id: "user_123", version: 1 });

    const dbError = new Error("Koneksi MongoDB terputus total!");
    Pengguna.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(dbError),
    });

    await authPengguna(req, res, next);
    expect(next).toHaveBeenCalledWith(dbError);
  });

  // pengujian performa
  test("Skenario 14 [CRITICAL] — Lolos validasi CEPAT menggunakan Cache Redis (Tanpa menyentuh MongoDB)", async () => {
    req.headers.authorization = "Bearer token_app_valid";
    jwt.verify.mockReturnValue({
      id: "user_redis",
      deviceID: "DEV-01",
      version: 2,
    });

    // Simulasi: Data SUDAH ADA di dalam memori Redis (Cache Hit)
    const cachedSession = {
      _id: "user_redis",
      aksesType: "app",
      device: [{ deviceID: "DEV-01", tokenVersion: 2 }],
      permissions: ["SUPER_KASIR", "LIHAT_MENU"],
    };
    redis.get.mockResolvedValue(JSON.stringify(cachedSession));

    await authPengguna(req, res, next);

    // BUKTI MUTLAK BAHWA MONGODB TIDAK DISENTUH:
    expect(Pengguna.findById).not.toHaveBeenCalled();

    // Validasi lolos dengan sukses
    expect(next).toHaveBeenCalledWith();
    expect(req.pengguna.aksesType).toBe("app");
    expect(req.pengguna.permissions).toContain("SUPER_KASIR");
  });

  test("Skenario 15 [DEFENSIF] — Meneruskan error ke next() jika server Redis mati/crash mendadak", async () => {
    req.headers.authorization = "Bearer token_redis_mati";
    jwt.verify.mockReturnValue({ id: "user_123", version: 1 });

    const redisError = new Error("Redis connection to 127.0.0.1:6379 failed");
    redis.get.mockRejectedValue(redisError);

    await authPengguna(req, res, next);

    // Sistem tidak boleh hang, harus dilempar ke error handler global (Error 500)
    expect(next).toHaveBeenCalledWith(redisError);
  });

  test("Skenario 16 [DEFENSIF] — Mengamankan sistem dari data Cache Redis yang korup (JSON Parse Error)", async () => {
    req.headers.authorization = "Bearer token_redis_korup";
    jwt.verify.mockReturnValue({ id: "user_123", version: 1 });

    // Simulasi: Data di Redis terpotong atau tersisipi karakter ilegal sehingga bukan JSON valid
    redis.get.mockResolvedValue("{ data_rusak: tidak_bisa_di_parse");

    await authPengguna(req, res, next);

    // JSON.parse akan gagal dan melempar SyntaxError.
    // Middleware harus menangkapnya di blok catch dan mengopernya ke next()
    expect(next).toHaveBeenCalledWith(expect.any(SyntaxError));
  });

  test("Skenario 17 [DEFENSIF] — Melempar error 401 dengan aman jika req.headers tidak terdefinisi (Mencegah Crash)", async () => {
    // Simulasi: Middleware Express lain secara tidak sengaja menghancurkan objek headers
    delete req.headers;

    await authPengguna(req, res, next);

    // Harus tertahan oleh Optional Chaining (?.) yang baru kita pasang
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });
});
