const diskonController = require("../../../controllers/diskonController");
const diskonService = require("../../../services/diskonService");

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

jest.mock("../../../services/diskonService");

describe("Unit Test — Controller — Diskon", () => {
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
      const result = diskonController._getRequesterTenantID(req);
      expect(result).toBe("tenant_1");
    });

    test("Mengembalikan null jika objek pengguna kosong atau undefined", () => {
      req.pengguna = null;
      const result = diskonController._getRequesterTenantID(req);
      expect(result).toBeNull();
    });
  });

  describe("Method: getAll", () => {
    test("Sukses mengambil daftar diskon berdasarkan tenantID dan query filter (200 OK)", async () => {
      req.query = { status: "Aktif" };
      diskonService.getAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await diskonController.getAll(req, res, next);

      expect(diskonService.getAll).toHaveBeenCalledWith("tenant_1", req.query);
      expect(res.json).toHaveBeenCalledWith({ data: [{ id: 1 }, { id: 2 }] });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia (tidak lolos otentikasi)", async () => {
      req.pengguna = null; // Menghilangkan tenantID

      await diskonController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
      expect(diskonService.getAll).not.toHaveBeenCalled();
    });

    test("Meneruskan error (Next) jika service mengalami kegagalan", async () => {
      const err = new Error("Database Error");
      diskonService.getAll.mockRejectedValue(err);

      await diskonController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: getById", () => {
    test("Sukses mengambil detail diskon berdasarkan ID (200 OK)", async () => {
      req.params.id = "diskon_1";
      diskonService.getById.mockResolvedValue({
        _id: "diskon_1",
        namaDiskon: "Promo",
      });

      await diskonController.getById(req, res, next);

      expect(diskonService.getById).toHaveBeenCalledWith(
        "diskon_1",
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({
        data: { _id: "diskon_1", namaDiskon: "Promo" },
      });
    });

    test("Gagal (Next 404) jika diskon tidak ditemukan oleh service", async () => {
      req.params.id = "invalid_id";
      diskonService.getById.mockResolvedValue(null);

      await diskonController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika service gagal memproses pencarian detail", async () => {
      const err = new Error("GetById Error");
      diskonService.getById.mockRejectedValue(err);

      await diskonController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: create", () => {
    test("Sukses menyuntikkan tenantID secara paksa ke dalam payload dan membuat data (201 Created)", async () => {
      req.body = { namaDiskon: "Promo Lebaran" };
      diskonService.create.mockResolvedValue({ _id: "diskon_new" });

      await diskonController.create(req, res, next);

      expect(diskonService.create).toHaveBeenCalledWith({
        namaDiskon: "Promo Lebaran",
        tenantID: "tenant_1", // Disuntikkan dari pengguna
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "diskon_new" } });
    });

    test("Gagal (400) jika payload tidak lolos validasi dari service", async () => {
      diskonService.create.mockResolvedValue({ error: ["Validation Failed"] });

      await diskonController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["Validation Failed"] });
    });

    test("Meneruskan error (Next) jika terjadi kegagalan sistemik dari service", async () => {
      const err = new Error("Create Failed");
      diskonService.create.mockRejectedValue(err);

      await diskonController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: update", () => {
    test("Sukses menghapus atribut tenantID dari body untuk keamanan dan mengupdate data (200 OK)", async () => {
      req.params.id = "diskon_1";
      req.body = { tenantID: "tenant_hacker", status: "Non-Aktif" };
      diskonService.update.mockResolvedValue({
        _id: "diskon_1",
        status: "Non-Aktif",
      });

      await diskonController.update(req, res, next);

      expect(req.body.tenantID).toBeUndefined(); // Atribut tenantID dihapus
      expect(diskonService.update).toHaveBeenCalledWith(
        "diskon_1",
        { status: "Non-Aktif" },
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({
        data: { _id: "diskon_1", status: "Non-Aktif" },
      });
    });

    test("Gagal (400) jika payload update ditolak oleh validasi dari service", async () => {
      diskonService.update.mockResolvedValue({
        error: ["Update Validation Failed"],
      });

      await diskonController.update(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: ["Update Validation Failed"],
      });
    });

    test("Gagal (Next 404) jika diskon yang ingin diperbarui tidak ditemukan di service", async () => {
      diskonService.update.mockResolvedValue(null);

      await diskonController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika service gagal memproses pembaruan data", async () => {
      const err = new Error("Update Server Error");
      diskonService.update.mockRejectedValue(err);

      await diskonController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: delete", () => {
    test("Sukses memanggil service untuk menghapus data (200 OK)", async () => {
      req.params.id = "diskon_1";
      diskonService.delete.mockResolvedValue(true);

      await diskonController.delete(req, res, next);

      expect(diskonService.delete).toHaveBeenCalledWith("diskon_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: true });
    });

    test("Gagal (Next 404) jika diskon yang ingin dihapus tidak ditemukan oleh service", async () => {
      req.params.id = "diskon_invalid";
      diskonService.delete.mockResolvedValue(null);

      await diskonController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika service gagal memproses penghapusan data", async () => {
      const err = new Error("Delete Server Error");
      diskonService.delete.mockRejectedValue(err);

      await diskonController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
