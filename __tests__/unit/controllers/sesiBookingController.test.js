const sesiBookingController = require("../../../controllers/sesiBookingController");
const sesiBookingService = require("../../../services/sesiBookingService");

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

jest.mock("../../../services/sesiBookingService");

describe("Unit Test — Controller — Sesi Booking", () => {
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

  describe("Method: _getRequesterTenantID & _getRequesterUserID", () => {
    test("Sukses mengembalikan tenantID dan userID jika objek pengguna tersedia", () => {
      expect(sesiBookingController._getRequesterTenantID(req)).toBe("tenant_1");
      expect(sesiBookingController._getRequesterUserID(req)).toBe("user_1");
    });

    test("Mengembalikan null jika objek pengguna kosong atau undefined", () => {
      req.pengguna = null;
      expect(sesiBookingController._getRequesterTenantID(req)).toBeNull();
      expect(sesiBookingController._getRequesterUserID(req)).toBeNull();
    });
  });

  describe("Method: getAll", () => {
    test("Sukses mengambil data dengan query tanggal (200 OK)", async () => {
      req.query = { tanggal: "2026-05-11" };
      sesiBookingService.getAll.mockResolvedValue([{ _id: "b_1" }]);

      await sesiBookingController.getAll(req, res, next);

      expect(sesiBookingService.getAll).toHaveBeenCalledWith(
        "tenant_1",
        "2026-05-11",
      );
      expect(res.json).toHaveBeenCalledWith({ data: [{ _id: "b_1" }] });
    });

    test("Sukses mengambil data tanpa query tanggal (mengirimkan null ke service)", async () => {
      sesiBookingService.getAll.mockResolvedValue([{ _id: "b_1" }]);

      await sesiBookingController.getAll(req, res, next);

      expect(sesiBookingService.getAll).toHaveBeenCalledWith("tenant_1", null);
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await sesiBookingController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
      expect(sesiBookingService.getAll).not.toHaveBeenCalled();
    });

    test("Meneruskan error (Next) jika service gagal", async () => {
      const err = new Error("DB Error");
      sesiBookingService.getAll.mockRejectedValue(err);

      await sesiBookingController.getAll(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: getById", () => {
    test("Sukses mengambil detail booking (200 OK)", async () => {
      req.params.id = "b_1";
      sesiBookingService.getById.mockResolvedValue({ _id: "b_1" });

      await sesiBookingController.getById(req, res, next);

      expect(sesiBookingService.getById).toHaveBeenCalledWith(
        "b_1",
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "b_1" } });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await sesiBookingController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (Next 404) jika data tidak ditemukan dari service", async () => {
      req.params.id = "invalid_id";
      sesiBookingService.getById.mockResolvedValue(null);

      await sesiBookingController.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });
  });

  describe("Method: create (Single & Batch Dinamis)", () => {
    test("Gagal (Next 403) jika tenantID atau userID tidak tersedia", async () => {
      req.pengguna = null; // Menghilangkan keduanya
      await sesiBookingController.create(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Sukses memanggil service.create() untuk SINGLE booking jika payload.items tidak ada (201 Created)", async () => {
      req.body = { dataAset: "aset_1" };
      sesiBookingService.create.mockResolvedValue({ _id: "b_new" });

      await sesiBookingController.create(req, res, next);

      expect(sesiBookingService.create).toHaveBeenCalledWith({
        dataAset: "aset_1",
        tenantID: "tenant_1",
        dataPengguna: "user_1",
      });
      expect(sesiBookingService.createBatch).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "b_new" } });
    });

    test("Sukses memanggil service.createBatch() untuk MULTIPLE booking jika payload.items adalah Array (201 Created)", async () => {
      req.body = { items: [{ dataAset: "aset_1" }] };
      sesiBookingService.createBatch.mockResolvedValue({ totalBookings: 1 });

      await sesiBookingController.create(req, res, next);

      expect(sesiBookingService.createBatch).toHaveBeenCalledWith({
        items: [{ dataAset: "aset_1" }],
        tenantID: "tenant_1",
        dataPengguna: "user_1",
      });
      expect(sesiBookingService.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { totalBookings: 1 } });
    });

    test("Gagal (400) jika ada error bisnis atau validasi dari service (baik Single maupun Batch)", async () => {
      req.body = { dataAset: "aset_1" };
      sesiBookingService.create.mockResolvedValue({ error: ["Aset bentrok"] });

      await sesiBookingController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["Aset bentrok"] });
    });

    test("Meneruskan error (Next) jika ada kegagalan sistem", async () => {
      req.body = { dataAset: "aset_1" };
      const err = new Error("Sistem Error");
      sesiBookingService.create.mockRejectedValue(err);

      await sesiBookingController.create(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: update", () => {
    test("Sukses memperbarui data (200 OK)", async () => {
      req.params.id = "b_1";
      req.body = { waktuSelesai: "baru" };
      sesiBookingService.update.mockResolvedValue({
        _id: "b_1",
        waktuSelesai: "baru",
      });

      await sesiBookingController.update(req, res, next);

      expect(sesiBookingService.update).toHaveBeenCalledWith(
        "b_1",
        req.body,
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({
        data: { _id: "b_1", waktuSelesai: "baru" },
      });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await sesiBookingController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (400) jika ada error validasi saat update dari service", async () => {
      req.params.id = "b_1";
      sesiBookingService.update.mockResolvedValue({
        error: ["Penjualan sudah FINAL"],
      });

      await sesiBookingController.update(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: ["Penjualan sudah FINAL"],
      });
    });

    test("Gagal (Next 404) jika data yang diupdate tidak ditemukan oleh service", async () => {
      sesiBookingService.update.mockResolvedValue(null);

      await sesiBookingController.update(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });
  });

  describe("Method: delete", () => {
    test("Sukses menghapus data (200 OK)", async () => {
      req.params.id = "b_1";
      sesiBookingService.delete.mockResolvedValue(true);

      await sesiBookingController.delete(req, res, next);

      expect(sesiBookingService.delete).toHaveBeenCalledWith("b_1", "tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: true });
    });

    test("Gagal (Next 403) jika tenantID tidak tersedia", async () => {
      req.pengguna = null;
      await sesiBookingController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
    });

    test("Gagal (400) jika ada error validasi saat delete dari service (misal: sudah Batal)", async () => {
      req.params.id = "b_1";
      sesiBookingService.delete.mockResolvedValue({ error: ["Sudah Batal"] });

      await sesiBookingController.delete(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["Sudah Batal"] });
    });

    test("Gagal (Next 404) jika data yang dihapus tidak ditemukan", async () => {
      sesiBookingService.delete.mockResolvedValue(null);

      await sesiBookingController.delete(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });
  });
});
