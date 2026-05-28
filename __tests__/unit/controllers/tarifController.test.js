const tarifController = require("../../../controllers/tarifController");
const tarifService = require("../../../services/tarifService");

// 🔥 TAMBAHAN: Mock redis & logger agar tidak ada open handles & console log bocor
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

jest.mock("../../../services/tarifService");

describe("Unit Test — Controller — Tarif", () => {
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
    test("Sukses mengembalikan tenantID jika pengguna terautentikasi", () => {
      const result = tarifController._getRequesterTenantID(req);
      expect(result).toBe("tenant_1");
    });

    test("Mengembalikan null jika objek pengguna tidak ada (belum login)", () => {
      req.pengguna = null;
      const result = tarifController._getRequesterTenantID(req);
      expect(result).toBeNull();
    });
  });

  describe("Method: getAll", () => {
    test("Sukses mengambil data (200 OK) dan meneruskan req.query ke service", async () => {
      req.query = { basisPerhitungan: "per jam" };
      tarifService.getAll.mockResolvedValue([{ _id: "tarif_1" }]);

      await tarifController.getAll(req, res, next);

      expect(tarifService.getAll).toHaveBeenCalledWith("tenant_1", req.query);
      expect(res.json).toHaveBeenCalledWith({ data: [{ _id: "tarif_1" }] });
    });

    test("Gagal (Next 403) jika tenantID tidak valid / tidak ada", async () => {
      req.pengguna = null;
      
      await tarifController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(tarifService.getAll).not.toHaveBeenCalled();
    });

    test("Meneruskan error (Next) jika terjadi kegagalan dari service", async () => {
      const err = new Error("DB Error");
      tarifService.getAll.mockRejectedValue(err);

      await tarifController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: getById", () => {
    test("Sukses mengambil detail (200 OK)", async () => {
      req.params.id = "tarif_1";
      tarifService.getById.mockResolvedValue({ _id: "tarif_1" });

      await tarifController.getById(req, res, next);

      expect(tarifService.getById).toHaveBeenCalledWith("tarif_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "tarif_1" } });
    });

    test("Gagal (Next 403) jika tenantID tidak valid", async () => {
      req.pengguna = null;
      await tarifController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    test("Gagal (Next 404) jika data tarif tidak ditemukan", async () => {
      req.params.id = "tarif_1";
      tarifService.getById.mockResolvedValue(null);

      await tarifController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });
  });

  describe("Method: create", () => {
    test("Sukses meng-inject tenantID ke payload, membuat data (201 Created)", async () => {
      req.body = { namaTarif: "Tarif Baru" };
      tarifService.create.mockResolvedValue({ _id: "tarif_1" });

      await tarifController.create(req, res, next);

      expect(tarifService.create).toHaveBeenCalledWith({ namaTarif: "Tarif Baru", tenantID: "tenant_1" });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "tarif_1" } });
    });

    test("Gagal (Next 403) jika tenantID tidak valid", async () => {
      req.pengguna = null;
      await tarifController.create(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    test("Gagal (400) jika payload ditolak oleh validasi service", async () => {
      tarifService.create.mockResolvedValue({ error: ["Validation Failed"] });

      await tarifController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["Validation Failed"] });
    });

    test("Meneruskan error (Next) jika ada error dari service", async () => {
      const err = new Error("Create Error");
      tarifService.create.mockRejectedValue(err);

      await tarifController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: update", () => {
    test("Sukses memperbarui data (200 OK)", async () => {
      req.params.id = "tarif_1";
      req.body = { harga: 150000 };
      tarifService.update.mockResolvedValue({ _id: "tarif_1", harga: 150000 });

      await tarifController.update(req, res, next);

      // Sesuai parameter pada controller: req.params.id, tenantID, req.body
      expect(tarifService.update).toHaveBeenCalledWith("tarif_1", "tenant_1", req.body);
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "tarif_1", harga: 150000 } });
    });

    test("Gagal (Next 403) jika tenantID tidak valid", async () => {
      req.pengguna = null;
      await tarifController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    test("Gagal (400) jika payload update ditolak oleh validasi service", async () => {
      req.params.id = "tarif_1";
      tarifService.update.mockResolvedValue({ error: ["Invalid Payload"] });

      await tarifController.update(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["Invalid Payload"] });
    });

    test("Gagal (Next 404) jika data yang ingin diupdate tidak ditemukan", async () => {
      req.params.id = "tarif_1";
      tarifService.update.mockResolvedValue(null);

      await tarifController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });
  });

  describe("Method: delete", () => {
    test("Sukses menghapus data (200 OK)", async () => {
      req.params.id = "tarif_1";
      tarifService.delete.mockResolvedValue(true);

      await tarifController.delete(req, res, next);

      expect(tarifService.delete).toHaveBeenCalledWith("tarif_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: true });
    });

    test("Gagal (Next 403) jika tenantID tidak valid", async () => {
      req.pengguna = null;
      await tarifController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    test("Gagal (Next 404) jika data yang ingin dihapus tidak ditemukan", async () => {
      req.params.id = "tarif_1";
      tarifService.delete.mockResolvedValue(null);

      await tarifController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    test("Meneruskan error (Next) jika ada error dari service", async () => {
      const err = new Error("Delete Error");
      tarifService.delete.mockRejectedValue(err);

      await tarifController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});