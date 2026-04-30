const authAkun = require("../../../middleware/authAkun");
const jwt = require("jsonwebtoken");
const Akun = require("../../../models/akunModel");

jest.mock("jsonwebtoken");
jest.mock("../../../models/akunModel", () => {
  return {
    findById: jest.fn(),
  };
});

describe("Unit Test — authAkun Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {} };
    res = {};
    next = jest.fn();
  });

  test("Harus melempar error 401 jika header Authorization tidak ada", async () => {
    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("Harus melempar error 401 jika format token bukan Bearer", async () => {
    req.headers.authorization = "Basic token123";
    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("Harus melempar error 401 jika token kedaluwarsa (TokenExpiredError)", async () => {
    req.headers.authorization = "Bearer expired_token";
    const error = new Error("jwt expired");
    error.name = "TokenExpiredError";
    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Sesi berakhir/i),
      }),
    );
  });

  test("Harus melempar error 401 jika akun tidak ditemukan di database", async () => {
    req.headers.authorization = "Bearer valid_token";
    jwt.verify.mockReturnValue({ id: "123", version: 1 });

    // Rantai Mongoose: findById().select().lean() -> mengembalikan null
    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });

    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("Harus melempar error 401 jika tokenVersion tidak cocok (Sesi dibajak/dicabut)", async () => {
    req.headers.authorization = "Bearer valid_token";
    jwt.verify.mockReturnValue({ id: "123", version: 1 }); // Token bawa versi 1

    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "123", tokenVersion: 2 }), // DB versi 2
      }),
    });

    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("Harus melempar error 403 jika token dimanipulasi atau tidak valid secara umum", async () => {
    req.headers.authorization = "Bearer fake_hacked_token";
    const error = new Error("invalid signature");
    error.name = "JsonWebTokenError"; // Mensimulasikan error bawaan JWT
    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await authAkun(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 403,
        message: expect.stringMatching(/Token tidak valid/i),
      }),
    );
  });

  test("Harus melempar error 401 jika payload token tidak memiliki 'version' (Mencegah Bypass)", async () => {
    req.headers.authorization = "Bearer valid_token_but_no_version";

    // Skenario: Token sah dari segi kriptografi, tapi kehilangan payload version
    jwt.verify.mockReturnValue({ id: "123" }); // Tidak ada property 'version'

    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "123", tokenVersion: 1 }),
      }),
    });

    await authAkun(req, res, next);

    // Jika pengujian ini GAGAL, artinya Anda belum menerapkan perbaikan kode
    // (!decoded.version) di file authAkun.js yang saya sarankan sebelumnya.
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
      }),
    );
  });

  test("Harus mengoper error ke next() jika database MongoDB mengalami kegagalan", async () => {
    req.headers.authorization = "Bearer valid_token";
    jwt.verify.mockReturnValue({ id: "123", version: 1 });

    const dbError = new Error("MongoNetworkError: connection closed");

    // Rantai Mongoose melempar error saat query
    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockRejectedValue(dbError),
      }),
    });

    await authAkun(req, res, next);

    // Memastikan error sistem yang mentah dilempar ke errorHandler utama
    expect(next).toHaveBeenCalledWith(dbError);
  });

  test("Harus lolos (next tanpa error) dan menyuntikkan akunContext jika token & versi valid", async () => {
    req.headers.authorization = "Bearer valid_token";
    jwt.verify.mockReturnValue({ id: "123", version: 1, tenantID: "toko_1" });

    Akun.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "123",
          role: "admin",
          tenantID: "toko_1",
          tokenVersion: 1,
        }),
      }),
    });

    await authAkun(req, res, next);

    expect(next).toHaveBeenCalledWith(); // Dipanggil tanpa argumen error
    expect(req.akunContext).toEqual({
      akunID: "123",
      roleAkun: "admin",
      tenantID: "toko_1",
    });
  });

  describe("Sub-Middleware: requireTenant", () => {
    test("Harus melempar 403 jika akunContext tidak memiliki tenantID", () => {
      req.akunContext = { tenantID: null };
      authAkun.requireTenant(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Harus lolos jika tenantID tersedia", () => {
      req.akunContext = { tenantID: "toko_123" };
      authAkun.requireTenant(req, res, next);
      expect(next).toHaveBeenCalledWith(); // Tanpa error
    });
  });

  describe("Pengujian Ekstrem & Trivial (Kehampaan Data & Onboarding)", () => {
    test("Harus melempar error 401 secara aman jika req.headers tidak terdefinisi (Mencegah Crash)", async () => {
      // Skenario: Middleware sebelumnya secara tidak sengaja menghancurkan objek headers
      delete req.headers;

      await authAkun(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401 }),
      );
    });

    test("Harus melempar error jika header Authorization hanya berisi 'Bearer ' tanpa token", async () => {
      // Skenario: Spasi ada, tapi token string kosong
      req.headers = { authorization: "Bearer " };

      // jwt.verify akan menerima string kosong dan otomatis melempar JsonWebTokenError
      const error = new Error("jwt must be provided");
      error.name = "JsonWebTokenError";
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await authAkun(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 403,
          message: expect.stringMatching(/Token tidak valid/i),
        }),
      );
    });

    test("Harus lolos dan meng-set tenantID menjadi null jika akun valid namun belum membuat toko", async () => {
      // Skenario kritis untuk rute /create-tenant
      req.headers = { authorization: "Bearer valid_token" };
      jwt.verify.mockReturnValue({ id: "123", version: 1 }); // Tidak ada tenantID di token

      Akun.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: "123",
            role: "client",
            tenantID: null, // <-- Titik krusial: Akun baru
            tokenVersion: 1,
          }),
        }),
      });

      await authAkun(req, res, next);

      expect(next).toHaveBeenCalledWith(); // Tembus tanpa error
      expect(req.akunContext).toEqual({
        akunID: "123",
        roleAkun: "client",
        tenantID: null, // Sistem harus merespons dengan null secara eksplisit
      });
    });
  });
});
