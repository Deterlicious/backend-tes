const pembayaranController = require("../../../controllers/pembayaranController");
const pembayaranService = require("../../../services/pembayaranService");

// 🔥 TAMBAHAN: Mock redis & logger agar tidak ada open handles & console log bocor
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

jest.mock("../../../services/pembayaranService");

describe("Unit Test — Controller — Pembayaran", () => {
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
    test("Sukses mengembalikan tenantID jika objek pengguna tersedia", () => {
      const result = pembayaranController._getRequesterTenantID(req);
      expect(result).toBe("tenant_1");
    });

    test("Mengembalikan null jika objek pengguna kosong atau undefined", () => {
      req.pengguna = null;
      const result = pembayaranController._getRequesterTenantID(req);
      expect(result).toBeNull();
    });
  });

  describe("Method: getAll", () => {
    test("Sukses memanggil service dan mengembalikan data (200 OK)", async () => {
      pembayaranService.getAll.mockResolvedValue([1, 2]);

      await pembayaranController.getAll(req, res, next);

      expect(pembayaranService.getAll).toHaveBeenCalledWith("tenant_1");
      expect(res.json).toHaveBeenCalledWith({ data: [1, 2] });
    });

    test("Meneruskan error (Next) jika service gagal ambil data", async () => {
      const err = new Error("DB Error");
      pembayaranService.getAll.mockRejectedValue(err);

      await pembayaranController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: getById", () => {
    test("Sukses mengambil detail data berdasarkan ID (200 OK)", async () => {
      pembayaranService.getById.mockResolvedValue({ _id: "bayar_1" });
      req.params.id = "bayar_1";

      await pembayaranController.getById(req, res, next);

      expect(pembayaranService.getById).toHaveBeenCalledWith(
        "bayar_1",
        "tenant_1",
      );
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "bayar_1" } });
    });

    test("Gagal (Next 404) jika data tidak ditemukan oleh service", async () => {
      pembayaranService.getById.mockResolvedValue(null);

      await pembayaranController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Meneruskan error (Next) jika terjadi kegagalan dari service", async () => {
      const err = new Error("Detail Error");
      pembayaranService.getById.mockRejectedValue(err);

      await pembayaranController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: create", () => {
    test("Sukses menyuntikkan tenantID dari pengguna dan membuat data (201 Created)", async () => {
      pembayaranService.create.mockResolvedValue({ _id: "bayar_1" });

      await pembayaranController.create(req, res, next);

      expect(req.body.tenantID).toBe("tenant_1");
      expect(pembayaranService.create).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { _id: "bayar_1" } });
    });

    test("Gagal (400) jika payload ditolak oleh validasi di service", async () => {
      pembayaranService.create.mockResolvedValue({
        error: ["Validation Failed"],
      });

      await pembayaranController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["Validation Failed"] });
    });

    test("Mencegah manipulasi: menimpa tenantID di body jika klien mencoba menyuntikkan ID lain", async () => {
      req.body.tenantID = "tenant_hacker";
      pembayaranService.create.mockResolvedValue({ _id: "bayar_1" });

      await pembayaranController.create(req, res, next);

      expect(req.body.tenantID).toBe("tenant_1");
    });

    test("Meneruskan error (Next) jika service gagal memproses create", async () => {
      const err = new Error("Create Error");
      pembayaranService.create.mockRejectedValue(err);

      await pembayaranController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: update", () => {
    test("Sukses menghapus atribut terlarang (tenantID, penjualanID, noReferensi) dari body untuk keamanan", async () => {
      req.body = {
        tenantID: "hacker",
        penjualanID: "ubah_jual",
        noReferensi: "ubah_ref",
        jumlahBayar: 10000,
      };
      req.params.id = "bayar_1";
      pembayaranService.update.mockResolvedValue({ _id: "bayar_1" });

      await pembayaranController.update(req, res, next);

      expect(req.body.tenantID).toBeUndefined();
      expect(req.body.penjualanID).toBeUndefined();
      expect(req.body.noReferensi).toBeUndefined();
      expect(req.body.jumlahBayar).toBe(10000);
      expect(pembayaranService.update).toHaveBeenCalledWith(
        "bayar_1",
        req.body,
        "tenant_1",
      );
    });

    test("Gagal (400) jika payload update ditolak oleh validasi di service", async () => {
      pembayaranService.update.mockResolvedValue({ error: ["Update Failed"] });

      await pembayaranController.update(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["Update Failed"] });
    });

    test("Gagal (Next 404) jika data yang ingin diupdate tidak ditemukan", async () => {
      pembayaranService.update.mockResolvedValue(null);

      await pembayaranController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Sukses memperbarui data (200 OK)", async () => {
      pembayaranService.update.mockResolvedValue({ _id: "bayar_1" });

      await pembayaranController.update(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: { _id: "bayar_1" } });
    });

    test("Meneruskan error (Next) jika service gagal memproses update", async () => {
      const err = new Error("Update Error");
      pembayaranService.update.mockRejectedValue(err);

      await pembayaranController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("Method: delete", () => {
    test("Gagal (400) jika ada aturan bisnis yang melarang penghapusan (misal: VOID)", async () => {
      pembayaranService.delete.mockResolvedValue({
        error: ["Tidak dapat dihapus"],
      });

      await pembayaranController.delete(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: ["Tidak dapat dihapus"],
      });
    });

    test("Gagal (Next 404) jika data tidak ditemukan untuk dihapus", async () => {
      pembayaranService.delete.mockResolvedValue(null);

      await pembayaranController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
    });

    test("Sukses menghapus data (200 OK)", async () => {
      pembayaranService.delete.mockResolvedValue(true);

      await pembayaranController.delete(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: true });
    });

    test("Meneruskan error (Next) jika service gagal memproses delete", async () => {
      const err = new Error("Delete Error");
      pembayaranService.delete.mockRejectedValue(err);

      await pembayaranController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
