const tenantController = require("../../../controllers/tenantController");
const tenantService = require("../../../services/tenantService");
const akunService = require("../../../services/akunService");
const mongoose = require("mongoose");
jest.spyOn(mongoose.Types.ObjectId, "isValid").mockReturnValue(true);

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
  generateTokens: jest.fn(), // nama fungsi disesuaikan
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
      req.userDecoded = { id: "akun_123" };
      req.body = { namaToko: "Toko A" };

      tenantService.createWithOwner.mockResolvedValue({
        tenant: { _id: "t_1", namaToko: "Toko A" },
        akun: { _id: "akun_123", email: "a@a.com" },
      });
      akunService.generateTokens.mockReturnValue({
        accessToken: "access_token_mock",
        refreshToken: "refresh_token_mock",
      });

      await tenantController.createWithOwner(req, res, next);

      expect(tenantService.createWithOwner).toHaveBeenCalledWith(
        req.body,
        "akun_123",
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "refresh_token_mock",
        expect.any(Object),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/berhasil/i),
        }),
      );
    });

    test("harus melempar error 401 jika userDecoded tidak ditemukan", async () => {
      req.userDecoded = null;

      await tenantController.createWithOwner(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401 }),
      );
    });
  });

  describe("Fungsi Update", () => {
    test("harus sukses jika pemilik mengubah tokonya sendiri", async () => {
      req.userDecoded = { tenantID: "toko_1" };
      req.params.id = "toko_1";
      req.body = { namaToko: "Toko B" };

      tenantService.update.mockResolvedValue({
        _id: "toko_1",
        namaToko: "Toko B",
      });

      await tenantController.update(req, res, next);

      expect(tenantService.update).toHaveBeenCalledWith("toko_1", req.body);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.any(Object) }),
      );
    });

    test("harus melempar error 403 jika pemilik mencoba mengubah toko orang lain", async () => {
      req.userDecoded = { tenantID: "toko_1" };
      req.params.id = "toko_2";

      await tenantController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("harus melempar error 403 jika akses tidak memiliki tenantID sama sekali", async () => {
      req.userDecoded = { id: "akun_tanpa_toko" };
      req.params.id = "toko_1";

      await tenantController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("harus melempar error 404 jika tenant tidak ditemukan di database", async () => {
      req.userDecoded = { tenantID: "toko_1" };
      req.params.id = "toko_1";
      tenantService.update.mockResolvedValue(null);

      await tenantController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });
  });

  describe("Fungsi Delete", () => {
    test("harus sukses menghapus permanen jika pemilik menghapus tokonya sendiri", async () => {
      req.userDecoded = { tenantID: "toko_1" };
      req.params.id = "toko_1";

      await tenantController.delete(req, res, next);

      expect(tenantService.delete).toHaveBeenCalledWith("toko_1");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });

    test("harus melempar error 403 jika pemilik mencoba menghapus toko orang lain", async () => {
      req.userDecoded = { tenantID: "toko_1" };
      req.params.id = "toko_2";

      await tenantController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("harus melempar error 403 jika akses tidak memiliki tenantID", async () => {
      req.userDecoded = {};
      req.params.id = "toko_1";

      await tenantController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });
  });

  describe("Fungsi Read ReadAll", () => {
    test("getAll harus mengembalikan daftar semua tenant", async () => {
      tenantService.getAll.mockResolvedValue([{ _id: "1" }, { _id: "2" }]);

      await tenantController.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ total: 2 }),
      );
    });

    test("getById harus sukses jika tenant ditemukan", async () => {
      req.userDecoded = { tenantID: "toko_1" };
      req.params.id = "toko_1";
      tenantService.getById.mockResolvedValue({ _id: "toko_1", namaToko: "A" });

      await tenantController.getById(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.any(Object) }),
      );
    });

    test("getById harus melempar error 404 jika tenant tidak ada", async () => {
      req.userDecoded = { tenantID: "toko_1" };
      req.params.id = "toko_1";
      tenantService.getById.mockResolvedValue(null);

      await tenantController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("getById harus melempar error 400 jika format ID tidak valid (bukan ObjectId)", async () => {
      // Manipulasi spy khusus untuk tes ini agar mengembalikan false
      const mongoose = require("mongoose");
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);

      req.userDecoded = { tenantID: "id_acak_acakan" };
      req.params.id = "id_acak_acakan";

      await tenantController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400 }),
      );
    });

    test("getById harus melempar error 403 jika pengguna mencoba melihat detail tenant orang lain", async () => {
      req.userDecoded = { tenantID: "toko_kita" };
      req.params.id = "toko_orang_lain"; // ID berbeda

      await tenantController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
      expect(tenantService.getById).not.toHaveBeenCalled(); // Pastikan service tidak diintip
    });
  });

  describe("Keandalan Error Handling (Propagasi ke next)", () => {
    test("Semua fungsi harus meneruskan error sistem ke middleware next()", async () => {
      const errorSistem = new Error("Database Crash");
      req.userDecoded = { id: "akun_1", tenantID: "toko_1" };
      req.params.id = "toko_1";
      req.body = { namaToko: "A" };

      // Buat semua service error
      tenantService.getAll.mockRejectedValueOnce(errorSistem);
      tenantService.getById.mockRejectedValueOnce(errorSistem);
      tenantService.createWithOwner.mockRejectedValueOnce(errorSistem);
      tenantService.update.mockRejectedValueOnce(errorSistem);
      tenantService.delete.mockRejectedValueOnce(errorSistem);

      // Eksekusi semua fungsi controller
      await tenantController.getAll(req, res, next);
      await tenantController.getById(req, res, next);
      await tenantController.createWithOwner(req, res, next);
      await tenantController.update(req, res, next);
      await tenantController.delete(req, res, next);

      // Pastikan next dipanggil sebanyak 5 kali dengan error sistem tersebut
      expect(next).toHaveBeenCalledTimes(5);
      expect(next).toHaveBeenCalledWith(errorSistem);
    });
  });
});
