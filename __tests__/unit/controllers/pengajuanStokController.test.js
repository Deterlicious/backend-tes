const PengajuanStokController = require("../../../controllers/pengajuanStokController");
const pengajuanStokService = require("../../../services/pengajuanStokService");

// Mocking Service
jest.mock("../../../services/pengajuanStokService");

describe("PengajuanStokController — Unit Test", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default request object
    req = {
      body: {},
      params: {},
      query: {},
      pengguna: {
        _id: "user-123",
        tenantID: "tenant-123",
      },
    };

    // Default response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Default next function
    next = jest.fn();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getAllPengajuanStok
  // ══════════════════════════════════════════════════════════════════════════
  describe("getAllPengajuanStok", () => {
    test("1. Berhasil get all (200)", async () => {
      const mockData = [{ _id: "1" }, { _id: "2" }];
      req.query = { status: "APPROVED" };
      
      pengajuanStokService.getAll.mockResolvedValue(mockData);

      await PengajuanStokController.getAllPengajuanStok(req, res, next);

      expect(pengajuanStokService.getAll).toHaveBeenCalledWith(req.query, req.pengguna);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    test("2. Gagal dan meneruskan error ke next()", async () => {
      const err = new Error("Database error");
      pengajuanStokService.getAll.mockRejectedValue(err);

      await PengajuanStokController.getAllPengajuanStok(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // createPengajuanStok
  // ══════════════════════════════════════════════════════════════════════════
  describe("createPengajuanStok", () => {
    test("1. Berhasil create (201) dan menyuntikkan tenantID, dimintaOleh, dan status DRAFT", async () => {
      req.body = { nomorPengajuan: "REQ-01", status: "HACKER-STATUS" }; // Mencoba bypass status
      const mockResult = { _id: "new-1" };
      
      pengajuanStokService.create.mockResolvedValue(mockResult);

      await PengajuanStokController.createPengajuanStok(req, res, next);

      // Pastikan status dipaksa menjadi DRAFT oleh controller
      expect(pengajuanStokService.create).toHaveBeenCalledWith({
        nomorPengajuan: "REQ-01",
        tenantID: "tenant-123",
        dimintaOleh: "user-123",
        status: "DRAFT",
      });
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    test("2. Gagal dan meneruskan error ke next()", async () => {
      const err = new Error("Invalid payload");
      pengajuanStokService.create.mockRejectedValue(err);

      await PengajuanStokController.createPengajuanStok(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // updatePengajuanStok
  // ══════════════════════════════════════════════════════════════════════════
  describe("updatePengajuanStok", () => {
    test("1. Berhasil update (200)", async () => {
      req.params.id = "req-1";
      req.body = { catatan: "Revisi" };
      const mockResult = { _id: "req-1", catatan: "Revisi" };

      pengajuanStokService.update.mockResolvedValue(mockResult);

      await PengajuanStokController.updatePengajuanStok(req, res, next);

      expect(pengajuanStokService.update).toHaveBeenCalledWith("req-1", "tenant-123", req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Data berhasil diperbarui",
        data: mockResult,
      });
    });

    test("2. Gagal dan meneruskan error ke next()", async () => {
      const err = new Error("Data tidak ditemukan");
      pengajuanStokService.update.mockRejectedValue(err);

      await PengajuanStokController.updatePengajuanStok(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // submitRequest
  // ══════════════════════════════════════════════════════════════════════════
  describe("submitRequest", () => {
    test("1. Berhasil submit (200)", async () => {
      req.params.id = "req-1";
      const mockResult = { _id: "req-1", status: "SUBMITTED" };

      pengajuanStokService.submit.mockResolvedValue(mockResult);

      await PengajuanStokController.submitRequest(req, res, next);

      expect(pengajuanStokService.submit).toHaveBeenCalledWith("req-1", "tenant-123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Status berhasil diubah menjadi SUBMITTED",
        data: mockResult,
      });
    });

    test("2. Gagal dan meneruskan error ke next()", async () => {
      const err = new Error("Tidak bisa di-submit");
      pengajuanStokService.submit.mockRejectedValue(err);

      await PengajuanStokController.submitRequest(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // approveRequest
  // ══════════════════════════════════════════════════════════════════════════
  describe("approveRequest", () => {
    test("1. Berhasil approve (200)", async () => {
      req.params.id = "req-1";
      const mockResult = { message: "Approved", data: { _id: "req-1" } };

      pengajuanStokService.approve.mockResolvedValue(mockResult);

      await PengajuanStokController.approveRequest(req, res, next);

      expect(pengajuanStokService.approve).toHaveBeenCalledWith("req-1", "tenant-123", "user-123");
      expect(res.status).toHaveBeenCalledWith(200);
      // Approve mengembalikan response tanpa dibungkus ulang { success: true }
      expect(res.json).toHaveBeenCalledWith(mockResult); 
    });

    test("2. Gagal dan meneruskan error ke next()", async () => {
      const err = new Error("Gagal approve");
      pengajuanStokService.approve.mockRejectedValue(err);

      await PengajuanStokController.approveRequest(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // rejectRequest
  // ══════════════════════════════════════════════════════════════════════════
  describe("rejectRequest", () => {
    test("1. Berhasil reject dengan alasan tertulis (200)", async () => {
      req.params.id = "req-1";
      req.body = { alasan: "Stok kurang" };
      const mockResult = { _id: "req-1", status: "REJECTED" };

      pengajuanStokService.reject.mockResolvedValue(mockResult);

      await PengajuanStokController.rejectRequest(req, res, next);

      expect(pengajuanStokService.reject).toHaveBeenCalledWith("req-1", "tenant-123", "user-123", "Stok kurang");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    test("2. Berhasil reject meski req.body kosong / undefined (Proteksi null-check berjalan)", async () => {
      req.params.id = "req-1";
      req.body = undefined; // Simulasi tanpa body
      const mockResult = { _id: "req-1", status: "REJECTED" };

      pengajuanStokService.reject.mockResolvedValue(mockResult);

      await PengajuanStokController.rejectRequest(req, res, next);

      expect(pengajuanStokService.reject).toHaveBeenCalledWith("req-1", "tenant-123", "user-123", undefined);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("3. Gagal dan meneruskan error ke next()", async () => {
      const err = new Error("Gagal menolak");
      pengajuanStokService.reject.mockRejectedValue(err);

      await PengajuanStokController.rejectRequest(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
