const tenantController = require("../../../controllers/tenantController");
const tenantService = require("../../../services/tenantService");
const akunService = require("../../../services/akunService");

// membungkam log dan koneksi luar agar terminal bersih dan tidak menggantung
jest.mock("../../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

jest.mock("../../../services/tenantService");
jest.mock("../../../services/akunService", () => ({
  generateAuthTokens: jest.fn(),
}));

describe("Unit Test Tenant Controller", () => {
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

  describe("Fungsi Create", () => {
    test("harus sukses membuat tenant dan set cookie jika akunContext valid", async () => {
      req.akunContext = { id: "akun_123" };
      req.body = { namaToko: "Toko A" };

      tenantService.createWithOwner.mockResolvedValue({
        tenant: { _id: "t_1", namaToko: "Toko A" },
        akun: { _id: "akun_123", email: "a@a.com" },
      });
      akunService.generateAuthTokens.mockResolvedValue({
        accessToken: "access_token_mock",
        refreshToken: "refresh_token_mock",
      });

      await tenantController.create(req, res, next);

      expect(tenantService.createWithOwner).toHaveBeenCalledWith(req.body, "akun_123");
      expect(res.cookie).toHaveBeenCalledWith("refreshToken", "refresh_token_mock", expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/berhasil/i) })
      );
    });

    test("harus melempar error 401 jika akunContext tidak ditemukan", async () => {
      req.akunContext = null;

      await tenantController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });
  });

  describe("Fungsi Update", () => {
    test("harus sukses jika pemilik mengubah tokonya sendiri", async () => {
      req.akunContext = { tenantID: "toko_1" };
      req.params.id = "toko_1";
      req.body = { namaToko: "Toko B" };

      tenantService.update.mockResolvedValue({ _id: "toko_1", namaToko: "Toko B" });

      await tenantController.update(req, res, next);

      expect(tenantService.update).toHaveBeenCalledWith("toko_1", req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Object) }));
    });

    test("harus melempar error 403 jika pemilik mencoba mengubah toko orang lain", async () => {
      req.akunContext = { tenantID: "toko_1" };
      req.params.id = "toko_2"; 

      await tenantController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    test("harus melempar error 403 jika akses tidak memiliki tenantID sama sekali", async () => {
      req.akunContext = { id: "akun_tanpa_toko" };
      req.params.id = "toko_1";

      await tenantController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    test("harus melempar error 404 jika tenant tidak ditemukan di database", async () => {
      req.akunContext = { tenantID: "toko_1" };
      req.params.id = "toko_1";
      tenantService.update.mockResolvedValue(null); 

      await tenantController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });
  });

  describe("Fungsi Delete", () => {
    test("harus sukses menghapus permanen jika pemilik menghapus tokonya sendiri", async () => {
      req.akunContext = { tenantID: "toko_1" };
      req.params.id = "toko_1";

      await tenantController.delete(req, res, next);

      expect(tenantService.forceDelete).toHaveBeenCalledWith("toko_1");
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    test("harus melempar error 403 jika pemilik mencoba menghapus toko orang lain", async () => {
      req.akunContext = { tenantID: "toko_1" };
      req.params.id = "toko_2";

      await tenantController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    test("harus melempar error 403 jika akses tidak memiliki tenantID", async () => {
      req.akunContext = {};
      req.params.id = "toko_1";

      await tenantController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });
  });

  describe("Fungsi Read ReadAll", () => {
    test("getAll harus mengembalikan daftar semua tenant", async () => {
      tenantService.getAll.mockResolvedValue([{ _id: "1" }, { _id: "2" }]);

      await tenantController.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
    });

    test("getById harus sukses jika tenant ditemukan", async () => {
      req.params.id = "toko_1";
      tenantService.getById.mockResolvedValue({ _id: "toko_1", namaToko: "A" });

      await tenantController.getById(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Object) }));
    });

    test("getById harus melempar error 404 jika tenant tidak ada", async () => {
      req.params.id = "toko_1";
      tenantService.getById.mockResolvedValue(null);

      await tenantController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });
  });
});