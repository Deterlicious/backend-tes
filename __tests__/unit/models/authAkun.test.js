const authAkun = require("../../../middleware/authAkun");
const jwt = require("jsonwebtoken");
const Akun = require("../../../models/akunModel");

// MOCKING DEPENDENCIES
jest.mock("jsonwebtoken");
jest.mock("../../../models/akunModel");

describe("Unit Test Middleware — authAkun", () => {
  let req, res, next;

  // Sterilisasi mock sebelum setiap test berjalan
  beforeEach(() => {
    req = { headers: {} };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  // Skenario A: Penolakan header kosong
  test("Skenario A — return 401 jika tidak ada Authorization header", async () => {
    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  // Skenario B: Token ngawur
  test("Skenario B — return 403 jika token tidak valid", async () => {
    req.headers.authorization = "Bearer token_palsu";
    jwt.verify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  // Skenario C: Token sudah kedaluwarsa
  test("Skenario C — return 401 jika token expired", async () => {
    req.headers.authorization = "Bearer token_expired";
    const expiredError = new Error("jwt expired");
    expiredError.name = "TokenExpiredError";

    jwt.verify.mockImplementation(() => {
      throw expiredError;
    });

    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/expired/i),
      }),
    );
  });

  // Skenario D: Token valid, tapi Akun sudah dihapus dari DB
  test("Skenario D — return 401 jika akun tidak ditemukan di database", async () => {
    req.headers.authorization = "Bearer token_valid";
    jwt.verify.mockReturnValue({ id: "user_id", version: 1 });

    // Mocking Mongoose chain: findById().select().lean() -> mereturn null
    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    });

    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  // Skenario E: Celah keamanan tokenVersion (Global Logout)
  test("Skenario E — return 401 jika tokenVersion tidak cocok (Sesi di-revoke)", async () => {
    req.headers.authorization = "Bearer token_valid_old_version";

    // Versi token tertinggal (1)
    jwt.verify.mockReturnValue({ id: "user_id", version: 1 });

    // Versi di database sudah naik (2) karena user pernah ganti password/logout all
    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: "user_id",
        role: "owner",
        tokenVersion: 2,
      }),
    });

    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Sesi telah berakhir/i),
      }),
    );
  });

  // Skenario F: Skenario sukses yang sempurna
  test("Skenario F — lolos dan injeksi req.akunContext jika semuanya valid", async () => {
    req.headers.authorization = "Bearer token_valid_perfect";
    const decoded = { id: "user_id", version: 2, tenantID: "tenant_abc" };
    jwt.verify.mockReturnValue(decoded);

    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: "user_id",
        role: "admin",
        tokenVersion: 2,
      }),
    });

    await authAkun(req, res, next);

    // Memastikan middleware memanggil next() tanpa argumen error apa pun
    expect(next).toHaveBeenCalledWith();

    // Memastikan payload konteks tersuntik dengan benar
    expect(req.akunContext).toBeDefined();
    expect(req.akunContext.akunID).toBe("user_id");
    expect(req.akunContext.roleAkun).toBe("admin");
    expect(req.akunContext.tenantID).toBe("tenant_abc");
    expect(req.userDecoded).toBe(decoded);
  });

  // Skenario G: Format protokol salah (Bukan Bearer)
  test("Skenario G — return 401 jika header Authorization tidak menggunakan format Bearer", async () => {
    // Klien ceroboh mengirim Basic token atau format lain
    req.headers.authorization = "Basic token_rahasia";

    await authAkun(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Token akun tidak ditemukan/i),
      }),
    );
  });

  // Skenario H: Bencana Database (Simulasi Crash)
  test("Skenario H — meneruskan error ke next() jika terjadi kegagalan database", async () => {
    req.headers.authorization = "Bearer token_paling_valid";
    jwt.verify.mockReturnValue({ id: "user_id", version: 1 });

    const dbError = new Error("Koneksi MongoDB terputus!");

    // Mocking kegagalan fatal pada database
    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(dbError),
    });

    await authAkun(req, res, next);

    // Memastikan blok catch (err) { next(err) } berfungsi murni
    expect(next).toHaveBeenCalledWith(dbError);
  });

  // Skenario I: Backward Compatibility (Token tanpa tokenVersion)
  test("Skenario I — lolos validasi jika token lama tidak memiliki payload version", async () => {
    req.headers.authorization = "Bearer token_versi_lama";

    // JWT hasil decode tidak memiliki properti 'version'
    const decodedLama = { id: "user_id" };
    jwt.verify.mockReturnValue(decodedLama);

    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: "user_id",
        role: "admin",
        tokenVersion: 5, // DB punya versi, tapi token tidak punya
      }),
    });

    await authAkun(req, res, next);

    // Harus lolos (next dipanggil tanpa error) karena decoded.version undefined
    expect(next).toHaveBeenCalledWith();
    expect(req.akunContext.akunID).toBe("user_id");
  });

  // Skenario J: Akun baru yang belum memiliki Tenant (Toko)
  test("Skenario J — injeksi tenantID sebagai null jika tidak ada di payload JWT", async () => {
    req.headers.authorization = "Bearer token_tanpa_tenant";

    // JWT tidak memiliki tenantID
    const decodedBaru = { id: "user_id_baru", version: 1 };
    jwt.verify.mockReturnValue(decodedBaru);

    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: "user_id_baru",
        role: "client",
        tokenVersion: 1,
      }),
    });

    await authAkun(req, res, next);

    // Harus lolos dan tenantID di set menjadi null secara default
    expect(next).toHaveBeenCalledWith();
    expect(req.akunContext.tenantID).toBeNull();
  });
});
