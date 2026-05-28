const tipeAsetController = require("../../../controllers/tipeAsetController");
const tipeAsetService = require("../../../services/tipeAsetService");

// 🔥 Mock redis & logger untuk mencegah open handles dan console log bocor
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  quit: jest.fn(),
}));

jest.mock("../../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock("../../../services/tipeAsetService");

describe("Unit Test — Controller — Tipe Aset", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      params: {},
      query: {},
      pengguna: {
        tenantID: "tenant_1",
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  describe("Method: _getRequesterTenantID", () => {
    test("Sukses mengembalikan tenantID jika objek pengguna tersedia", () => {
      const result = tipeAsetController._getRequesterTenantID(req);
      expect(result).toBe("tenant_1");
    });

    test("Mengembalikan null jika objek pengguna kosong atau undefined", () => {
      req.pengguna = null;
      const result = tipeAsetController._getRequesterTenantID(req);
      expect(result).toBeNull();
    });
  });

  describe("Method: getAll", () => {
    test("Sukses mengambil daftar tipe aset berdasarkan tenantID dan query (200 OK)", async () => {
      req.query = { namaTipeAset: "VIP" };
      tipeAsetService.getAll.mockResolvedValue([
        { _id: "aset_1" },
        { _id: "aset_2" },
      ]);

      await tipeAsetController.getAll(req, res, next);

      expect(tipeAsetService.getAll).toHaveBeenCalledWith(
        "tenant_1",
        req.query,
      );
      expect(res.json).toHaveBeenCalledWith({
        data: [{ _id: "aset_1" }, { _id: "aset_2" }],
      });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;

      await tipeAsetController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
      expect(tipeAsetService.getAll).not.toHaveBeenCalled();
    });

    test("Meneruskan error (Next) jika service mengalami kegagalan", async () => {
      const err = new Error("Database Error");
      tipeAsetService.getAll.mockRejectedValue(err);

      await tipeAsetController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: getById", () => {
    test("Sukses mengambil detail tipe aset berdasarkan ID (200 OK)", async () => {
      req.params.id = "aset_1";
      tipeAsetService.getById.mockResolvedValue({
        _id: "aset_1",
        namaTipeAset: "VIP",
      });

      await tipeAsetController.getById(req, res, next);

      expect(tipeAsetService.getById).toHaveBeenCalledWith(
        "aset_1",
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({
        data: { _id: "aset_1", namaTipeAset: "VIP" },
      });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await tipeAsetController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (Next 404) jika tipe aset tidak ditemukan oleh service", async () => {
      req.params.id = "invalid_id";
      tipeAsetService.getById.mockResolvedValue(null);

      await tipeAsetController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika service gagal memproses pencarian detail", async () => {
      const err = new Error("GetById Error");
      tipeAsetService.getById.mockRejectedValue(err);

      await tipeAsetController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: create", () => {
    test("Sukses menyuntikkan tenantID secara paksa ke dalam payload dan membuat data (201 Created)", async () => {
      req.body = { namaTipeAset: "Ruang Rapat" };
      tipeAsetService.create.mockResolvedValue({ _id: "aset_new" });

      await tipeAsetController.create(req, res, next);

      expect(tipeAsetService.create).toHaveBeenCalledWith({
        namaTipeAset: "Ruang Rapat",
        tenantID: "tenant_1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "aset_new" } });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await tipeAsetController.create(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (400) jika payload tidak lolos validasi dari service", async () => {
      tipeAsetService.create.mockResolvedValue({
        error: ["Validation Failed"],
      });

      await tipeAsetController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["Validation Failed"] });
    });

    test("Meneruskan error (Next) jika terjadi kegagalan sistemik dari service", async () => {
      const err = new Error("Create Failed");
      tipeAsetService.create.mockRejectedValue(err);

      await tipeAsetController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: update", () => {
    test("Sukses mengupdate data tipe aset (200 OK)", async () => {
      req.params.id = "aset_1";
      req.body = { namaTipeAset: "VVIP Room" };
      tipeAsetService.update.mockResolvedValue({
        _id: "aset_1",
        namaTipeAset: "VVIP Room",
      });

      await tipeAsetController.update(req, res, next);

      expect(tipeAsetService.update).toHaveBeenCalledWith(
        "aset_1",
        "tenant_1",
        req.body,
      );
      expect(res.json).toHaveBeenCalledWith({
        data: { _id: "aset_1", namaTipeAset: "VVIP Room" },
      });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await tipeAsetController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (400) jika payload update ditolak oleh validasi dari service", async () => {
      tipeAsetService.update.mockResolvedValue({
        error: ["Update Validation Failed"],
      });

      await tipeAsetController.update(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: ["Update Validation Failed"],
      });
    });

    test("Gagal (Next 404) jika tipe aset yang ingin diperbarui tidak ditemukan di service", async () => {
      tipeAsetService.update.mockResolvedValue(null);

      await tipeAsetController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika service gagal memproses pembaruan data", async () => {
      const err = new Error("Update Server Error");
      tipeAsetService.update.mockRejectedValue(err);

      await tipeAsetController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: delete", () => {
    test("Sukses memanggil service untuk menghapus data (200 OK)", async () => {
      req.params.id = "aset_1";
      tipeAsetService.delete.mockResolvedValue(true);

      await tipeAsetController.delete(req, res, next);

      expect(tipeAsetService.delete).toHaveBeenCalledWith("aset_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: true });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await tipeAsetController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (Next 404) jika tipe aset yang ingin dihapus tidak ditemukan oleh service", async () => {
      req.params.id = "aset_invalid";
      tipeAsetService.delete.mockResolvedValue(null);

      await tipeAsetController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika service gagal memproses penghapusan data", async () => {
      const err = new Error("Delete Server Error");
      tipeAsetService.delete.mockRejectedValue(err);

      await tipeAsetController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
