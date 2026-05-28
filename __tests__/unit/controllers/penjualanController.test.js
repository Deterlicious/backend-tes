const penjualanController = require("../../../controllers/penjualanController");
const penjualanService = require("../../../services/penjualanService");

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

// Mock Service Penjualan
jest.mock("../../../services/penjualanService");

describe("Unit Test — Controller — Penjualan", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      params: {},
      query: {},
      pengguna: {
        tenantID: "tenant_1",
        _id: "user_1",
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  describe("Internal Methods: _getRequesterTenantID & _getRequesterPenggunaID", () => {
    test("Sukses mengembalikan tenantID jika objek pengguna dan tenantID tersedia", () => {
      expect(penjualanController._getRequesterTenantID(req)).toBe("tenant_1");
    });

    test("Sukses mengembalikan _id pengguna jika tersedia", () => {
      expect(penjualanController._getRequesterPenggunaID(req)).toBe("user_1");
    });

    test("Sukses mengembalikan id pengguna (fallback) jika _id tidak ada tetapi id ada", () => {
      req.pengguna = { tenantID: "tenant_1", id: "user_2_fallback" };
      expect(penjualanController._getRequesterPenggunaID(req)).toBe(
        "user_2_fallback",
      );
    });

    test("Mengembalikan null jika objek pengguna kosong atau data tidak lengkap", () => {
      req.pengguna = null;
      expect(penjualanController._getRequesterTenantID(req)).toBeNull();
      expect(penjualanController._getRequesterPenggunaID(req)).toBeNull();
    });
  });

  describe("Method: getAll", () => {
    test("Sukses mengambil data dengan mengirimkan semua parameter query (200 OK)", async () => {
      req.query = {
        statusBayar: "PAID",
        statusPenjualan: "FINAL",
        jenisTransaksi: "POS",
        jenisPenjualan: "dine-in",
        pelangganID: "pel_1",
        startDate: "2026-05-01",
        endDate: "2026-05-31",
        noReferensi: "INV-001",
      };

      penjualanService.getAll.mockResolvedValue([{ _id: "p_1" }]);

      await penjualanController.getAll(req, res, next);

      // Pastikan semua filter di-mapping dan dikirim ke service dengan benar
      expect(penjualanService.getAll).toHaveBeenCalledWith(
        "tenant_1",
        req.query,
      );
      expect(res.json).toHaveBeenCalledWith({ data: [{ _id: "p_1" }] });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await penjualanController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 403,
          message: "Tenant tidak valid.",
        }),
      );
      expect(penjualanService.getAll).not.toHaveBeenCalled();
    });

    test("Meneruskan error (Next) jika terjadi kegagalan pada service", async () => {
      const err = new Error("DB Error");
      penjualanService.getAll.mockRejectedValue(err);

      await penjualanController.getAll(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: getById", () => {
    test("Sukses mengambil detail penjualan (200 OK)", async () => {
      req.params.id = "p_1";
      penjualanService.getById.mockResolvedValue({ _id: "p_1" });

      await penjualanController.getById(req, res, next);

      expect(penjualanService.getById).toHaveBeenCalledWith("p_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "p_1" } });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await penjualanController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (Next 404) jika data tidak ditemukan oleh service", async () => {
      req.params.id = "invalid_id";
      penjualanService.getById.mockResolvedValue(null);

      await penjualanController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
          message: "Penjualan tidak ditemukan",
        }),
      );
    });
  });

  describe("Method: create", () => {
    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = { _id: "user_1" }; // tenantID hilang
      await penjualanController.create(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (Next 401) jika penggunaID tidak tersedia di req.pengguna", async () => {
      req.pengguna = { tenantID: "tenant_1" }; // _id hilang
      await penjualanController.create(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 401,
          message: "Pengguna tidak valid.",
        }),
      );
    });

    test("Sukses menginjeksi tenantID dan penggunaID ke payload lalu memanggil service (201 Created)", async () => {
      req.body = { jenisTransaksi: "POS" };
      penjualanService.create.mockResolvedValue({ _id: "p_new" });

      await penjualanController.create(req, res, next);

      expect(penjualanService.create).toHaveBeenCalledWith({
        jenisTransaksi: "POS",
        tenantID: "tenant_1",
        penggunaID: "user_1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "p_new" } });
    });

    test("Gagal (400) jika ada error validasi bisnis dari service", async () => {
      penjualanService.create.mockResolvedValue({
        error: ["Status VOID tidak diizinkan"],
      });

      await penjualanController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: ["Status VOID tidak diizinkan"],
      });
    });

    test("Meneruskan error (Next) jika terjadi kegagalan sistem saat create", async () => {
      const err = new Error("System Crash");
      penjualanService.create.mockRejectedValue(err);

      await penjualanController.create(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: update", () => {
    test("Sukses memperbarui penjualan (200 OK)", async () => {
      req.params.id = "p_1";
      req.body = { statusPenjualan: "FINAL" };
      penjualanService.update.mockResolvedValue({
        _id: "p_1",
        statusPenjualan: "FINAL",
      });

      await penjualanController.update(req, res, next);

      expect(penjualanService.update).toHaveBeenCalledWith(
        "p_1",
        req.body,
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({
        data: { _id: "p_1", statusPenjualan: "FINAL" },
      });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await penjualanController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (400) jika ada error validasi bisnis saat update dari service", async () => {
      req.params.id = "p_1";
      penjualanService.update.mockResolvedValue({
        error: ["Penjualan sudah FINAL"],
      });

      await penjualanController.update(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: ["Penjualan sudah FINAL"],
      });
    });

    test("Gagal (Next 404) jika data yang diupdate tidak ditemukan oleh service", async () => {
      penjualanService.update.mockResolvedValue(null);

      await penjualanController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });
  });

  describe("Method: delete", () => {
    test("Sukses menghapus data penjualan (200 OK)", async () => {
      req.params.id = "p_1";
      penjualanService.delete.mockResolvedValue(true);

      await penjualanController.delete(req, res, next);

      expect(penjualanService.delete).toHaveBeenCalledWith("p_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: true });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await penjualanController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (Next 404) jika data yang akan dihapus tidak ditemukan oleh service", async () => {
      penjualanService.delete.mockResolvedValue(false); // Service mengembalikan false/null

      await penjualanController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika terjadi kegagalan sistem saat menghapus", async () => {
      const err = new Error("Delete Error");
      penjualanService.delete.mockRejectedValue(err);

      await penjualanController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
