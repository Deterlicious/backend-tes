const asetController = require("../../../controllers/asetController");
const asetService = require("../../../services/asetService");

// 🔥 Mock redis & logger agar tidak ada open handles
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

jest.mock("../../../services/asetService");

describe("Unit Test — Controller — Aset", () => {
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
    test("Sukses mengembalikan tenantID jika tersedia di req.pengguna", () => {
      const result = asetController._getRequesterTenantID(req);
      expect(result).toBe("tenant_1");
    });

    test("Mengembalikan null jika objek pengguna tidak ada", () => {
      req.pengguna = null;
      const result = asetController._getRequesterTenantID(req);
      expect(result).toBeNull();
    });
  });

  describe("Method: getAll", () => {
    test("Sukses mengambil data (200 OK)", async () => {
      req.query = { status: "tersedia" };
      asetService.getAll.mockResolvedValue([{ _id: "aset_1" }]);

      await asetController.getAll(req, res, next);

      expect(asetService.getAll).toHaveBeenCalledWith("tenant_1", req.query);
      expect(res.json).toHaveBeenCalledWith({ data: [{ _id: "aset_1" }] });
    });

    test("Gagal (Next 403) jika tenantID tidak valid (pengecekan eksplisit di controller)", async () => {
      req.pengguna = null;
      await asetController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
      expect(asetService.getAll).not.toHaveBeenCalled();
    });

    test("Meneruskan error (Next) jika ada error dari service", async () => {
      const err = new Error("Service Error");
      asetService.getAll.mockRejectedValue(err);

      await asetController.getAll(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: getById", () => {
    test("Sukses mengambil detail aset (200 OK)", async () => {
      req.params.id = "aset_1";
      asetService.getById.mockResolvedValue({ _id: "aset_1" });

      await asetController.getById(req, res, next);

      expect(asetService.getById).toHaveBeenCalledWith("aset_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "aset_1" } });
    });

    test("Gagal (Next 404) jika data tidak ditemukan oleh service", async () => {
      req.params.id = "aset_1";
      asetService.getById.mockResolvedValue(null);

      await asetController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika ada error dari service", async () => {
      const err = new Error("DB Error");
      asetService.getById.mockRejectedValue(err);

      await asetController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: create", () => {
    test("Sukses menginjeksi tenantID dan membuat data (201 Created)", async () => {
      req.body = { namaAset: "Lapangan B" };
      asetService.create.mockResolvedValue({ _id: "aset_new" });

      await asetController.create(req, res, next);

      expect(asetService.create).toHaveBeenCalledWith({
        namaAset: "Lapangan B",
        tenantID: "tenant_1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "aset_new" } });
    });

    test("Gagal (400) jika ada error validasi dari service", async () => {
      asetService.create.mockResolvedValue({ error: ["Validation Failed"] });

      await asetController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["Validation Failed"] });
    });

    test("Meneruskan error (Next) jika ada error dari service", async () => {
      const err = new Error("Error Create");
      asetService.create.mockRejectedValue(err);

      await asetController.create(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: update", () => {
    test("Sukses memperbarui data (200 OK)", async () => {
      req.params.id = "aset_1";
      req.body = { namaAset: "Updated Aset" };
      asetService.update.mockResolvedValue({
        _id: "aset_1",
        namaAset: "Updated Aset",
      });

      await asetController.update(req, res, next);

      // Pastikan urutan argumen sesuai dengan kode di controller: id, payload, tenantID
      expect(asetService.update).toHaveBeenCalledWith(
        "aset_1",
        req.body,
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({
        data: { _id: "aset_1", namaAset: "Updated Aset" },
      });
    });

    test("Gagal (400) jika ada error validasi saat update dari service", async () => {
      asetService.update.mockResolvedValue({ error: ["Update Error"] });

      await asetController.update(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["Update Error"] });
    });

    test("Gagal (Next 404) jika data yang diupdate tidak ditemukan", async () => {
      asetService.update.mockResolvedValue(null);

      await asetController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });
  });

  describe("Method: delete", () => {
    test("Sukses menghapus data (200 OK)", async () => {
      req.params.id = "aset_1";
      asetService.delete.mockResolvedValue(true);

      await asetController.delete(req, res, next);

      expect(asetService.delete).toHaveBeenCalledWith("aset_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: true });
    });

    test("Gagal (Next 404) jika data yang dihapus tidak ditemukan", async () => {
      asetService.delete.mockResolvedValue(null);

      await asetController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika ada error dari service saat menghapus", async () => {
      const err = new Error("Delete Error");
      asetService.delete.mockRejectedValue(err);

      await asetController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
