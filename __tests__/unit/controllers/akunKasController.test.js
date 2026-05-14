const akunKasController = require("../../../controllers/akunKasController");
const akunKasService = require("../../../services/akunKasService");

// 🔥 MOCK REDIS & LOGGER AGAR JEST BISA EXIT (MENCEGAH OPEN HANDLE)
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

// Mock Service
jest.mock("../../../services/akunKasService");

describe("Unit Test — Controller — Akun Kas", () => {
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

  describe("Internal Method: _getRequesterTenantID", () => {
    test("Sukses mengembalikan tenantID jika objek pengguna tersedia", () => {
      expect(akunKasController._getRequesterTenantID(req)).toBe("tenant_1");
    });

    test("Mengembalikan null jika objek pengguna kosong atau tidak valid", () => {
      req.pengguna = null;
      expect(akunKasController._getRequesterTenantID(req)).toBeNull();
    });
  });

  describe("Method: getAll", () => {
    test("Sukses (200) mengambil data dari service", async () => {
      akunKasService.getAll.mockResolvedValue([{ _id: "kas_1" }]);

      await akunKasController.getAll(req, res, next);

      expect(akunKasService.getAll).toHaveBeenCalledWith("tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: [{ _id: "kas_1" }] });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia di req.pengguna", async () => {
      req.pengguna = null;
      await akunKasController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 403,
          message: "Akses ditolak. Tenant tidak valid.",
        }),
      );
      expect(akunKasService.getAll).not.toHaveBeenCalled();
    });

    test("Meneruskan error (Next) jika service mengalami kegagalan", async () => {
      const dbError = new Error("Database Crash");
      akunKasService.getAll.mockRejectedValue(dbError);

      await akunKasController.getAll(req, res, next);
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe("Method: getById", () => {
    test("Sukses (200) mengambil detail dari service", async () => {
      req.params.id = "kas_1";
      akunKasService.getById.mockResolvedValue({ _id: "kas_1" });

      await akunKasController.getById(req, res, next);

      expect(akunKasService.getById).toHaveBeenCalledWith("kas_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "kas_1" } });
    });

    test("Gagal (Next 404) jika data tidak ditemukan oleh service", async () => {
      req.params.id = "invalid_id";
      akunKasService.getById.mockResolvedValue(null);

      await akunKasController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika service gagal", async () => {
      const err = new Error("DB Error");
      akunKasService.getById.mockRejectedValue(err);

      await akunKasController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: create", () => {
    test("Sukses (201) membuat data baru, tenantID di-inject otomatis", async () => {
      req.body = { namaAkun: "Kas Baru" };
      akunKasService.create.mockResolvedValue({ _id: "kas_baru" });

      await akunKasController.create(req, res, next);

      expect(akunKasService.create).toHaveBeenCalledWith({
        namaAkun: "Kas Baru",
        tenantID: "tenant_1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        data: { _id: "kas_baru" },
        message: "Akun Kas berhasil dibuat",
      });
    });

    test("Gagal (400) jika ada error validasi bisnis dari service", async () => {
      akunKasService.create.mockResolvedValue({
        error: ["Nama Akun wajib diisi"],
      });

      await akunKasController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: ["Nama Akun wajib diisi"],
      });
    });

    test("Meneruskan error (Next) jika service mengalami crash", async () => {
      const err = new Error("System Error");
      akunKasService.create.mockRejectedValue(err);

      await akunKasController.create(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: update", () => {
    test("Sukses (200) memperbarui data, dan mencegah manipulasi tenantID dari body", async () => {
      req.params.id = "kas_1";
      // Mencoba menyelundupkan tenantID hacker
      req.body = { namaAkun: "Kas Update", tenantID: "tenant_hacker" };
      akunKasService.update.mockResolvedValue({ _id: "kas_1" });

      await akunKasController.update(req, res, next);

      expect(req.body.tenantID).toBeUndefined(); // Dipastikan telah dihapus oleh controller
      expect(akunKasService.update).toHaveBeenCalledWith(
        "kas_1",
        { namaAkun: "Kas Update" },
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({
        data: { _id: "kas_1" },
        message: "Akun Kas diperbarui",
      });
    });

    test("Gagal (400) jika ada error validasi bisnis saat update dari service", async () => {
      akunKasService.update.mockResolvedValue({
        error: ["Nomor Akun duplikat"],
      });

      await akunKasController.update(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: ["Nomor Akun duplikat"],
      });
    });

    test("Gagal (Next 404) jika data yang diupdate tidak ditemukan oleh service", async () => {
      akunKasService.update.mockResolvedValue(null);

      await akunKasController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika service gagal", async () => {
      const err = new Error("Update Error");
      akunKasService.update.mockRejectedValue(err);

      await akunKasController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: delete", () => {
    test("Sukses (200) menghapus data dari service", async () => {
      req.params.id = "kas_1";
      akunKasService.delete.mockResolvedValue(true);

      await akunKasController.delete(req, res, next);

      expect(akunKasService.delete).toHaveBeenCalledWith("kas_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({
        message: "Akun Kas berhasil dihapus",
      });
    });

    test("Gagal (Next 404) jika data yang akan dihapus tidak ditemukan", async () => {
      akunKasService.delete.mockResolvedValue(null);

      await akunKasController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika service gagal", async () => {
      const err = new Error("Delete Error");
      akunKasService.delete.mockRejectedValue(err);

      await akunKasController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
