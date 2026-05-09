const mongoose = require("mongoose");
const createError = require("http-errors");

// --- MOCKING DEPENDENCIES ---
jest.mock("../../../models/transferStokModel");
jest.mock("../../../models/inventoryModel");
jest.mock("../../../models/pengajuanStokModel");
jest.mock("../../../models/jurnalStokModel");
jest.mock("../../../config/redis", () => ({
  del: jest.fn().mockResolvedValue(true)
}));
jest.mock("../../../validators/transferStokValidator", () => ({
  validateTransferPayload: jest.fn(),
  VALID_STATUS: ["PENDING", "DIKIRIM", "DITERIMA", "BATAL"]
}));

// Import Dependencies Setelah Di-mock
const TransferStok = require("../../../models/transferStokModel");
const Inventory = require("../../../models/inventoryModel");
const PengajuanStok = require("../../../models/pengajuanStokModel");
const JurnalStok = require("../../../models/jurnalStokModel");
const redis = require("../../../config/redis");
const { validateTransferPayload } = require("../../../validators/transferStokValidator");

// Import Service yang akan diuji
const transferStokService = require("../../../services/transferStokService");

describe("TransferStokService — Unit Test", () => {
  let tenantID, dariLocationID, keLocationID, pengajuanStokID, bahanBakuID;

  beforeEach(() => {
    // Bersihkan semua mock sebelum setiap test
    jest.clearAllMocks();

    tenantID = new mongoose.Types.ObjectId();
    dariLocationID = new mongoose.Types.ObjectId();
    keLocationID = new mongoose.Types.ObjectId();
    pengajuanStokID = new mongoose.Types.ObjectId();
    bahanBakuID = new mongoose.Types.ObjectId();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER MOCK BUILDER
  // ══════════════════════════════════════════════════════════════════════════
  const mockPopulate = (mockData) => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(mockData)
  });

  // ══════════════════════════════════════════════════════════════════════════
  // METHOD: create()
  // ══════════════════════════════════════════════════════════════════════════
  describe("create() — Membuat Draft Surat Jalan", () => {
    let basePayload;
    let mockPengajuan;

    beforeEach(() => {
      basePayload = {
        tenantID,
        pengajuanStokID,
        dariLocationID,
        keLocationID,
        items: [{ bahanBakuID, qtyKirim: 10 }]
      };

      mockPengajuan = {
        _id: pengajuanStokID,
        tenantID,
        status: "APPROVED",
        dariLocationID,
        keLocationID,
        nomorPengajuan: "PGJ-001",
        items: [{
          bahanBakuID: { _id: bahanBakuID, satuan: "kg" },
          jumlah: 10,
          satuan: "kg"
        }]
      };

      validateTransferPayload.mockReturnValue({ valid: true });
      PengajuanStok.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPengajuan)
      });
      Inventory.findOne.mockResolvedValue({ stok: 100 }); // Stok cukup
      TransferStok.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      PengajuanStok.updateOne.mockResolvedValue({ modifiedCount: 1 });
    });

    test("1. Error jika pengajuanStokID tidak ada atau tidak valid", async () => {
      await expect(transferStokService.create({ ...basePayload, pengajuanStokID: null }))
        .rejects.toThrow("wajib dibuat dari Pengajuan Stok");

      await expect(transferStokService.create({ ...basePayload, pengajuanStokID: "invalid-id" }))
        .rejects.toThrow("wajib dibuat dari Pengajuan Stok");
    });

    test("2. Error jika pengajuan tidak ditemukan atau belum APPROVED", async () => {
      PengajuanStok.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });

      await expect(transferStokService.create(basePayload))
        .rejects.toThrow("tidak ditemukan atau belum berstatus APPROVED");
    });

    test("3. Error jika pengajuan sudah memiliki Surat Jalan", async () => {
      mockPengajuan.transferStokID = new mongoose.Types.ObjectId();

      await expect(transferStokService.create(basePayload))
        .rejects.toThrow("sudah memiliki Surat Jalan");
    });

    test("4. Error jika lokasi asal tidak cocok", async () => {
      await expect(transferStokService.create({ ...basePayload, dariLocationID: new mongoose.Types.ObjectId() }))
        .rejects.toThrow("Lokasi asal Surat Jalan harus sama");
    });

    test("5. Error jika jumlah kirim > jumlah diminta", async () => {
      basePayload.items[0].qtyKirim = 15; // Minta 10, kirim 15

      await expect(transferStokService.create(basePayload))
        .rejects.toThrow("tidak boleh melebihi jumlah yang diminta");
    });

    test("6. Error validasi payload dari validator", async () => {
      validateTransferPayload.mockReturnValue({ valid: false, errors: ["Error"] });

      await expect(transferStokService.create(basePayload))
        .rejects.toThrow("Validasi gagal");
    });

    test("7. Error jika stok tidak mencukupi (Early validation)", async () => {
      Inventory.findOne.mockResolvedValue({ stok: 5 }); // Butuh 10, stok cuma 5

      await expect(transferStokService.create(basePayload))
        .rejects.toThrow("Stok untuk salah satu bahan baku tidak mencukupi");
    });

    test("8. Berhasil dan melakukan konversi satuan secara implisit", async () => {
      // Skenario konversi: diminta 10.000 gram, dikirim 10.000 gram. Base unit bahanBaku adalah kg.
      basePayload.items[0].qtyKirim = 10000;
      mockPengajuan.items[0].jumlah = 10000;
      mockPengajuan.items[0].satuan = "gram"; // user request dalam gram

      await expect(transferStokService.create(basePayload)).resolves.toBeDefined();
      expect(TransferStok.create).toHaveBeenCalled();
      expect(PengajuanStok.updateOne).toHaveBeenCalledWith(
        { _id: pengajuanStokID },
        { $set: { transferStokID: expect.any(Object) } }
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // METHOD: getAll() & getById()
  // ══════════════════════════════════════════════════════════════════════════
  describe("getAll() & getById() — Fetch Data", () => {
    test("getAll - Error jika tenantID invalid", async () => {
      await expect(transferStokService.getAll("invalid-id")).rejects.toThrow("tenantID wajib disertakan");
    });

    test("getAll - Berhasil dan mempopulate data", async () => {
      TransferStok.find.mockReturnValue(mockPopulate([{ id: 1 }]));
      const result = await transferStokService.getAll(tenantID);
      expect(result).toHaveLength(1);
    });

    test("getById - Error jika ID invalid", async () => {
      await expect(transferStokService.getById(tenantID, "invalid-id")).rejects.toThrow("wajib disertakan dan harus valid");
    });

    test("getById - Error jika tidak ditemukan", async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        then: function(resolve) { resolve(null); }
      };
      TransferStok.findOne.mockReturnValue(mockQuery);

      await expect(transferStokService.getById(tenantID, new mongoose.Types.ObjectId()))
        .rejects.toThrow("tidak ditemukan atau Anda tidak memiliki akses");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // METHOD: updateStatus()
  // ══════════════════════════════════════════════════════════════════════════
  describe("updateStatus() — Perubahan Status Surat Jalan", () => {
    let transferId;
    let mockTransfer;

    beforeEach(() => {
      transferId = new mongoose.Types.ObjectId();
      mockTransfer = {
        _id: transferId,
        tenantID,
        status: "PENDING",
        dariLocationID,
        keLocationID,
        pengajuanStokID,
        nomorTransfer: "SJ-123",
        items: [{ bahanBakuID, qtyKirim: 10, qtyTerima: 0 }],
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockReturnThis()
      };

      TransferStok.findOne.mockResolvedValue(mockTransfer);
      Inventory.findOneAndUpdate.mockResolvedValue({ stok: 90 }); // Default stok cukup
    });

    test("1. Error transisi status tidak valid", async () => {
      // PENDING -> DITERIMA (Salah, harus DIKIRIM dulu)
      await expect(transferStokService.updateStatus(tenantID, transferId, "DITERIMA"))
        .rejects.toThrow("Hanya Transfer DIKIRIM yang bisa diubah menjadi DITERIMA");
      
      // DIKIRIM -> DIKIRIM
      mockTransfer.status = "DIKIRIM";
      await expect(transferStokService.updateStatus(tenantID, transferId, "DIKIRIM"))
        .rejects.toThrow("Hanya Transfer PENDING yang bisa diubah menjadi DIKIRIM");
    });

    test("2. Status DIKIRIM — Kurangi stok & buat Jurnal Keluar", async () => {
      await transferStokService.updateStatus(tenantID, transferId, "DIKIRIM", { pengirimID: new mongoose.Types.ObjectId() });

      expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ stok: { $gte: 10 } }), // Pastikan query stok >= qtyKirim
        { $inc: { stok: -10 } },
        { new: true }
      );
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipeKoreksi: "Keluar", alasan: "Transfer Gudang" })
      );
      expect(mockTransfer.status).toBe("DIKIRIM");
      expect(mockTransfer.save).toHaveBeenCalled();
    });

    test("3. Status DIKIRIM — Gagal jika stok tiba-tiba kurang", async () => {
      Inventory.findOneAndUpdate.mockResolvedValue(null); // Simulasi race condition stok habis

      await expect(transferStokService.updateStatus(tenantID, transferId, "DIKIRIM"))
        .rejects.toThrow("tidak mencukupi di lokasi asal");
    });

    test("4. Status DITERIMA — Tambah stok & buat Jurnal Masuk", async () => {
      mockTransfer.status = "DIKIRIM"; // Status awal
      const updates = { penerimaID: new mongoose.Types.ObjectId(), items: [{ bahanBakuID, qtyKirim: 10, qtyTerima: 8 }] };
      
      await transferStokService.updateStatus(tenantID, transferId, "DITERIMA", updates);

      expect(Inventory.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ locationID: keLocationID }),
        expect.objectContaining({ $inc: { stok: 8 } }), // Bertambah 8 sesuai qtyTerima
        { upsert: true }
      );
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipeKoreksi: "Masuk", jumlah: 8 })
      );
      expect(PengajuanStok.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: pengajuanStokID, tenantID },
        { status: "COMPLETED" }
      );
    });

    test("5. Status BATAL — Kembalikan stok (rollback) jika sudah DIKIRIM", async () => {
      mockTransfer.status = "DIKIRIM"; // Barang sudah terlanjur keluar
      
      await transferStokService.updateStatus(tenantID, transferId, "BATAL");

      expect(Inventory.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ locationID: dariLocationID }),
        { $inc: { stok: 10 } } // Dikembalikan 10
      );
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipeKoreksi: "Masuk", alasan: "Lainnya" }) // Jurnal koreksi pembatalan
      );
      expect(mockTransfer.status).toBe("BATAL");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // METHOD: updateDraft() & deleteDraft()
  // ══════════════════════════════════════════════════════════════════════════
  describe("updateDraft() & deleteDraft()", () => {
    const draftId = new mongoose.Types.ObjectId();

    test("updateDraft - Berhasil", async () => {
      validateTransferPayload.mockReturnValue({ valid: true, updates: { catatan: "Tes" } });
      TransferStok.findOneAndUpdate.mockResolvedValue({ _id: draftId });

      const result = await transferStokService.updateDraft(tenantID, draftId, {});
      expect(result).toBeDefined();
      expect(TransferStok.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: draftId, tenantID, status: "PENDING" },
        { catatan: "Tes" },
        { new: true, runValidators: true }
      );
    });

    test("deleteDraft - Berhasil", async () => {
      TransferStok.findOneAndDelete.mockResolvedValue({ _id: draftId });

      const result = await transferStokService.deleteDraft(tenantID, draftId);
      expect(result.message).toBe("Draft Transfer Stok berhasil dihapus");
      expect(TransferStok.findOneAndDelete).toHaveBeenCalledWith({
        _id: draftId,
        tenantID,
        status: "PENDING"
      });
    });
  });

});
