const metodePembayaranController = require("../../../controllers/metodePembayaranController");
const metodePembayaranService = require("../../../services/metodePembayaranService");

jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}));

jest.mock("../../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock("../../../services/metodePembayaranService");

describe("Unit Test — Controller — MetodePembayaran", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      params: {},
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
    test("Sukses mengembalikan tenantID jika objek pengguna ada", () => {
      const result = metodePembayaranController._getRequesterTenantID(req);
      expect(result).toBe("tenant_1");
    });

    test("Mengembalikan null jika objek pengguna kosong", () => {
      req.pengguna = null;
      const result = metodePembayaranController._getRequesterTenantID(req);
      expect(result).toBeNull();
    });
  });

  describe("Method: getAll", () => {
    test("Sukses memanggil service dan mengembalikan data (200 OK)", async () => {
      metodePembayaranService.getAll.mockResolvedValue([1, 2]);
      await metodePembayaranController.getAll(req, res, next);
      expect(metodePembayaranService.getAll).toHaveBeenCalledWith("tenant_1");
      expect(res.json).toHaveBeenCalledWith({
        data: [1, 2],
      });
    });

    test("Gagal (Next 403) jika tenantID kosong", async () => {
      req.pengguna = null;
      await metodePembayaranController.getAll(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 403,
        }),
      );
    });

    test("Meneruskan error (Next) jika service gagal ambil data", async () => {
      const err = new Error("DB Error");
      metodePembayaranService.getAll.mockRejectedValue(err);
      await metodePembayaranController.getAll(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: getById", () => {
    test("Sukses mengambil detail data berdasarkan ID (200 OK)", async () => {
      metodePembayaranService.getById.mockResolvedValue({
        _id: "id_1",
      });
      req.params.id = "id_1";
      await metodePembayaranController.getById(req, res, next);
      expect(metodePembayaranService.getById).toHaveBeenCalledWith(
        "id_1",
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({
        data: {
          _id: "id_1",
        },
      });
    });

    test("Gagal (Next 404) jika data tidak ditemukan", async () => {
      metodePembayaranService.getById.mockResolvedValue(null);
      await metodePembayaranController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
        }),
      );
    });

    test("Meneruskan error (Next) jika service gagal mencari data berdasarkan ID", async () => {
      const err = new Error("DB Error");
      metodePembayaranService.getById.mockRejectedValue(err);
      await metodePembayaranController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: create", () => {
    test("Sukses menyuntikkan tenantID dari pengguna ke dalam body", async () => {
      metodePembayaranService.create.mockResolvedValue({
        _id: "id_1",
      });
      await metodePembayaranController.create(req, res, next);
      expect(req.body.tenantID).toBe("tenant_1");
      expect(metodePembayaranService.create).toHaveBeenCalledWith(req.body);
    });

    test("Gagal (400) jika payload tidak lolos validasi service saat create", async () => {
      metodePembayaranService.create.mockResolvedValue({
        error: ["error"],
      });
      await metodePembayaranController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: ["error"],
      });
    });

    test("Sukses membuat data baru (201 Created)", async () => {
      metodePembayaranService.create.mockResolvedValue({
        _id: "id_1",
      });
      await metodePembayaranController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        data: {
          _id: "id_1",
        },
      });
    });

    test("Meneruskan error (Next) jika service gagal saat proses create", async () => {
      const err = new Error("Create Error");
      metodePembayaranService.create.mockRejectedValue(err);
      await metodePembayaranController.create(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });

    test("Mencegah manipulasi dengan menimpa tenantID di body meskipun sudah punya tenantID lain (Keamanan)", async () => {
      req.body.tenantID = "tenant_hacker";
      metodePembayaranService.create.mockResolvedValue({
        _id: "id_1",
      });
      await metodePembayaranController.create(req, res, next);
      expect(req.body.tenantID).toBe("tenant_1");
    });
  });

  describe("Method: update", () => {
    test("Sukses menghapus tenantID dari body untuk mencegah modifikasi (Keamanan)", async () => {
      req.body.tenantID = "hacker";
      metodePembayaranService.update.mockResolvedValue({
        _id: "id_1",
      });
      await metodePembayaranController.update(req, res, next);
      expect(req.body.tenantID).toBeUndefined();
    });

    test("Gagal (400) jika payload tidak lolos validasi service saat update", async () => {
      metodePembayaranService.update.mockResolvedValue({
        error: ["error"],
      });
      await metodePembayaranController.update(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: ["error"],
      });
    });

    test("Gagal (Next 404) jika data tidak ditemukan untuk diupdate", async () => {
      metodePembayaranService.update.mockResolvedValue(null);
      await metodePembayaranController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
        }),
      );
    });

    test("Sukses memperbarui data (200 OK)", async () => {
      req.params.id = "id_1";
      metodePembayaranService.update.mockResolvedValue({
        _id: "id_1",
      });
      await metodePembayaranController.update(req, res, next);
      expect(metodePembayaranService.update).toHaveBeenCalledWith(
        "id_1",
        req.body,
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({
        data: {
          _id: "id_1",
        },
      });
    });

    test("Meneruskan error (Next) jika service gagal saat proses update", async () => {
      const err = new Error("Update Error");
      metodePembayaranService.update.mockRejectedValue(err);
      await metodePembayaranController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: delete", () => {
    test("Sukses menghapus data (200 OK)", async () => {
      metodePembayaranService.delete.mockResolvedValue(true);
      await metodePembayaranController.delete(req, res, next);
      expect(res.json).toHaveBeenCalledWith({
        data: true,
      });
    });

    test("Gagal (Next 404) jika data tidak ditemukan untuk dihapus", async () => {
      metodePembayaranService.delete.mockResolvedValue(null);
      await metodePembayaranController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
        }),
      );
    });

    test("Meneruskan error (Next) jika service gagal saat proses delete", async () => {
      const err = new Error("Delete Error");
      metodePembayaranService.delete.mockRejectedValue(err);
      await metodePembayaranController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
