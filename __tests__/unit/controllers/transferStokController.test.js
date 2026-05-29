const TransferStokController = require("../../../controllers/transferStokController");
const TransferStokService = require("../../../services/transferStokService");

// Mock Service
jest.mock("../../../services/transferStokService");

describe("TransferStokController — Unit Test", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup req, res, next standard
    req = {
      body: {},
      params: {},
      pengguna: {
        tenantID: "tenant-123",
        _id: "user-456",
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE: createTransferStok
  // ══════════════════════════════════════════════════════════════════════════
  describe("createTransferStok", () => {
    test("1. Berhasil membuat draft transfer stok (201)", async () => {
      req.body = { nomorTransfer: "TRF-001", items: [] };
      const mockData = { _id: "trf-123", status: "PENDING" };
      
      TransferStokService.create.mockResolvedValue(mockData);

      await TransferStokController.createTransferStok(req, res, next);

      // Verifikasi Service dipanggil dengan payload gabungan body + tenantID + pengirimID
      expect(TransferStokService.create).toHaveBeenCalledWith({
        ...req.body,
        tenantID: req.pengguna.tenantID,
        pengirimID: req.pengguna._id,
      });

      // Verifikasi response HTTP
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Draft Transfer Stok berhasil dibuat (PENDING)",
        data: mockData,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("2. Error saat membuat draft diteruskan ke next()", async () => {
      const error = new Error("Validasi gagal");
      TransferStokService.create.mockRejectedValue(error);

      await TransferStokController.createTransferStok(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // READ ALL: getAllTransferStok
  // ══════════════════════════════════════════════════════════════════════════
  describe("getAllTransferStok", () => {
    test("1. Berhasil mengambil semua data (200)", async () => {
      const mockData = [{ _id: "1" }, { _id: "2" }];
      TransferStokService.getAll.mockResolvedValue(mockData);

      await TransferStokController.getAllTransferStok(req, res, next);

      expect(TransferStokService.getAll).toHaveBeenCalledWith(req.pengguna.tenantID);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: mockData.length,
        data: mockData,
      });
    });

    test("2. Error mengambil data diteruskan ke next()", async () => {
      const error = new Error("Database error");
      TransferStokService.getAll.mockRejectedValue(error);

      await TransferStokController.getAllTransferStok(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // READ BY ID: getTransferStokById
  // ══════════════════════════════════════════════════════════════════════════
  describe("getTransferStokById", () => {
    beforeEach(() => {
      req.params.id = "trf-123";
    });

    test("1. Berhasil mengambil data by ID (200)", async () => {
      const mockData = { _id: "trf-123", nomorTransfer: "SJ-1" };
      TransferStokService.getById.mockResolvedValue(mockData);

      await TransferStokController.getTransferStokById(req, res, next);

      expect(TransferStokService.getById).toHaveBeenCalledWith(req.pengguna.tenantID, req.params.id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });

    test("2. Error mengambil data by ID diteruskan ke next()", async () => {
      const error = new Error("Not Found");
      TransferStokService.getById.mockRejectedValue(error);

      await TransferStokController.getTransferStokById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE DRAFT: updateTransferDraft
  // ══════════════════════════════════════════════════════════════════════════
  describe("updateTransferDraft", () => {
    beforeEach(() => {
      req.params.id = "trf-123";
      req.body = { catatan: "Revisi" };
    });

    test("1. Berhasil update draft (200)", async () => {
      const mockData = { _id: "trf-123", catatan: "Revisi" };
      TransferStokService.updateDraft.mockResolvedValue(mockData);

      await TransferStokController.updateTransferDraft(req, res, next);

      expect(TransferStokService.updateDraft).toHaveBeenCalledWith(
        req.pengguna.tenantID,
        req.params.id,
        req.body
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Draft Transfer Stok berhasil diperbarui",
        data: mockData,
      });
    });

    test("2. Error update draft diteruskan ke next()", async () => {
      const error = new Error("Draft tidak PENDING");
      TransferStokService.updateDraft.mockRejectedValue(error);

      await TransferStokController.updateTransferDraft(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE STATUS: markAsKirim
  // ══════════════════════════════════════════════════════════════════════════
  describe("markAsKirim", () => {
    beforeEach(() => {
      req.params.id = "trf-123";
      req.body = { tanggalKirim: "2026-05-12" };
    });

    test("1. Berhasil menandai sebagai DIKIRIM (200)", async () => {
      const mockData = { _id: "trf-123", status: "DIKIRIM" };
      TransferStokService.updateStatus.mockResolvedValue(mockData);

      await TransferStokController.markAsKirim(req, res, next);

      expect(TransferStokService.updateStatus).toHaveBeenCalledWith(
        req.pengguna.tenantID,
        req.params.id,
        "DIKIRIM",
        {
          ...req.body,
          pengirimID: req.pengguna._id,
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Transfer Stok berhasil dikirim. Stok Gudang telah berkurang.",
        data: mockData,
      });
    });

    test("2. Error markAsKirim diteruskan ke next()", async () => {
      const error = new Error("Stok tidak mencukupi");
      TransferStokService.updateStatus.mockRejectedValue(error);

      await TransferStokController.markAsKirim(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE STATUS: markAsTerima
  // ══════════════════════════════════════════════════════════════════════════
  describe("markAsTerima", () => {
    beforeEach(() => {
      req.params.id = "trf-123";
      req.body = { tanggalTerima: "2026-05-13" };
    });

    test("1. Berhasil menandai sebagai DITERIMA (200)", async () => {
      const mockData = { _id: "trf-123", status: "DITERIMA" };
      TransferStokService.updateStatus.mockResolvedValue(mockData);

      await TransferStokController.markAsTerima(req, res, next);

      expect(TransferStokService.updateStatus).toHaveBeenCalledWith(
        req.pengguna.tenantID,
        req.params.id,
        "DITERIMA",
        {
          ...req.body,
          penerimaID: req.pengguna._id,
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Transfer Stok berhasil diterima. Stok Toko telah bertambah.",
        data: mockData,
      });
    });

    test("2. Error markAsTerima diteruskan ke next()", async () => {
      const error = new Error("Hanya Transfer DIKIRIM yang bisa diterima");
      TransferStokService.updateStatus.mockRejectedValue(error);

      await TransferStokController.markAsTerima(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE STATUS: markAsBatal
  // ══════════════════════════════════════════════════════════════════════════
  describe("markAsBatal", () => {
    beforeEach(() => {
      req.params.id = "trf-123";
    });

    test("1. Berhasil menandai sebagai BATAL (200)", async () => {
      const mockData = { _id: "trf-123", status: "BATAL" };
      TransferStokService.updateStatus.mockResolvedValue(mockData);

      await TransferStokController.markAsBatal(req, res, next);

      expect(TransferStokService.updateStatus).toHaveBeenCalledWith(
        req.pengguna.tenantID,
        req.params.id,
        "BATAL",
        { pengirimID: req.pengguna._id }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Transfer Stok berhasil dibatalkan.",
        data: mockData,
      });
    });

    test("2. Error markAsBatal diteruskan ke next()", async () => {
      const error = new Error("Sudah DITERIMA, tidak bisa dibatalkan");
      TransferStokService.updateStatus.mockRejectedValue(error);

      await TransferStokController.markAsBatal(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE DRAFT: deleteTransferDraft
  // ══════════════════════════════════════════════════════════════════════════
  describe("deleteTransferDraft", () => {
    beforeEach(() => {
      req.params.id = "trf-123";
    });

    test("1. Berhasil menghapus draft (200)", async () => {
      const mockResult = { message: "Draft Transfer Stok berhasil dihapus" };
      TransferStokService.deleteDraft.mockResolvedValue(mockResult);

      await TransferStokController.deleteTransferDraft(req, res, next);

      expect(TransferStokService.deleteDraft).toHaveBeenCalledWith(
        req.pengguna.tenantID,
        req.params.id
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        ...mockResult,
      });
    });

    test("2. Error saat menghapus draft diteruskan ke next()", async () => {
      const error = new Error("Draft tidak ditemukan");
      TransferStokService.deleteDraft.mockRejectedValue(error);

      await TransferStokController.deleteTransferDraft(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
