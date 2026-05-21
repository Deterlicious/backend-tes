const PengajuanStokService = require("../../../services/pengajuanStokService");
const PengajuanStok = require("../../../models/pengajuanStokModel");
const BahanBaku = require("../../../models/bahanBakuModel");
const redis = require("../../../config/redis");
const { convertToBaseUnit } = require("../../../utils/unitConverter");

// Mock dependencies
jest.mock("../../../models/pengajuanStokModel");
jest.mock("../../../models/bahanBakuModel");
jest.mock("../../../config/redis", () => ({
  del: jest.fn().mockResolvedValue(true),
  status: "ready",
}));
jest.mock("../../../utils/unitConverter", () => ({
  convertToBaseUnit: jest.fn((jumlah) => jumlah), // default mock
}));

describe("PengajuanStokService — Unit Test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const tenantID = "tenant-123";
  const userID = "user-123";

  // ══════════════════════════════════════════════════════════════════════════
  // getAll()
  // ══════════════════════════════════════════════════════════════════════════
  describe("getAll()", () => {
    const mockData = [{ _id: "1", status: "DRAFT" }];
    
    let mockQuery;
    beforeEach(() => {
      mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockData),
      };
      PengajuanStok.find.mockReturnValue(mockQuery);
    });

    test("1. Manager (punya approve) bisa melihat semua status", async () => {
      const user = { tenantID, permissions: ["approve-pengajuan-stok", "create-transfer-stok"] };
      const result = await PengajuanStokService.getAll({ jenisPengajuan: "PERMINTAAN" }, user);

      expect(PengajuanStok.find).toHaveBeenCalledWith({
        tenantID,
        jenisPengajuan: "PERMINTAAN",
      });
      expect(result).toEqual(mockData);
    });

    test("2. Staf Gudang (hanya create-transfer-stok) hanya bisa melihat SUBMITTED, APPROVED, PENDING, COMPLETED", async () => {
      const user = { tenantID, permissions: ["create-transfer-stok"] };
      await PengajuanStokService.getAll({}, user);

      expect(PengajuanStok.find).toHaveBeenCalledWith({
        tenantID,
        status: { $in: ["SUBMITTED", "APPROVED", "PENDING", "COMPLETED"] },
      });
    });

    test("3. Filter manual status yang dilarang bagi Staf Gudang (misal REJECTED) mengembalikan array kosong", async () => {
      const user = { tenantID, permissions: ["create-transfer-stok"] };
      const result = await PengajuanStokService.getAll({ status: "REJECTED" }, user);

      expect(result).toEqual([]);
      expect(PengajuanStok.find).not.toHaveBeenCalled();
    });

    test("4. Filter manual status yang diizinkan bagi Staf Gudang (misal APPROVED) berhasil", async () => {
      const user = { tenantID, permissions: ["create-transfer-stok"] };
      await PengajuanStokService.getAll({ status: "APPROVED" }, user);

      expect(PengajuanStok.find).toHaveBeenCalledWith({
        tenantID,
        status: "APPROVED",
      });
    });

    test("5. Pengguna Outlet (tanpa izin approve dan create-transfer) dapat melihat semua status karena mereka adalah pembuat", async () => {
      const user = { tenantID, permissions: [] }; // Tidak punya permission gudang/pusat
      await PengajuanStokService.getAll({}, user);

      expect(PengajuanStok.find).toHaveBeenCalledWith({
        tenantID,
        // filter.status TIDAK DITAMBAHKAN karena allowedStatuses = null
      });
    });

    test("6. Parameter jenisPengajuan diabaikan jika tidak diberikan", async () => {
      const user = { tenantID, permissions: ["approve-pengajuan-stok"] };
      await PengajuanStokService.getAll({}, user);

      expect(PengajuanStok.find).toHaveBeenCalledWith({
        tenantID, // Hanya tenantID, tanpa jenisPengajuan
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // create()
  // ══════════════════════════════════════════════════════════════════════════
  describe("create()", () => {
    test("1. Berhasil membuat pengajuan (nomor digenerate otomatis) dan reset cache", async () => {
      PengajuanStok.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ nomorPengajuan: "PGJ/202605/0005" }),
      });
      PengajuanStok.create.mockResolvedValue({ _id: "new-1" });

      const payload = { tenantID, items: [] };
      const result = await PengajuanStokService.create(payload);

      expect(payload.nomorPengajuan).toBe("PGJ/202605/0006");
      expect(payload.status).toBe("DRAFT");
      expect(PengajuanStok.create).toHaveBeenCalledWith(payload);
      expect(redis.del).toHaveBeenCalledWith(`pengajuanStok:list:${tenantID}`);
      expect(result).toEqual({ _id: "new-1" });
    });

    test("2. Berhasil mengkonversi satuan (Smart Converter) sebelum menyimpan", async () => {
      PengajuanStok.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });
      
      const payload = {
        tenantID,
        nomorPengajuan: "MANUAL-01",
        items: [{ bahanBakuID: "bb-1", jumlah: 1000, satuan: "gram" }],
      };

      BahanBaku.findById.mockResolvedValue({ satuan: "kg" });
      convertToBaseUnit.mockReturnValue(1); // 1000 gram = 1 kg

      await PengajuanStokService.create(payload);

      expect(BahanBaku.findById).toHaveBeenCalledWith("bb-1");
      expect(convertToBaseUnit).toHaveBeenCalledWith(1000, "gram", "kg");
      expect(payload.items[0].jumlah).toBe(1);
      expect(payload.items[0].satuan).toBe("kg");
      expect(PengajuanStok.create).toHaveBeenCalledWith(payload);
    });

    test("3. Error jika Bahan Baku tidak ditemukan saat konversi", async () => {
      const payload = { items: [{ bahanBakuID: "invalid-bb" }] };
      BahanBaku.findById.mockResolvedValue(null);

      await expect(PengajuanStokService.create(payload)).rejects.toThrow("tidak ditemukan");
    });

    test("4. Berhasil create jika tidak ada items (items kosong atau undefined)", async () => {
      PengajuanStok.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });
      PengajuanStok.create.mockResolvedValue({ _id: "new-2" });

      const payload = { tenantID }; // Tanpa items
      await PengajuanStokService.create(payload);

      expect(BahanBaku.findById).not.toHaveBeenCalled(); // Tidak ada konversi
      expect(PengajuanStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantID, status: "DRAFT" })
      );
    });

    test("5. Status tidak ditimpa DRAFT jika sudah diberikan secara eksplisit (meski ini harusnya dihalangi validator di level route)", async () => {
      PengajuanStok.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });

      const payload = { tenantID, status: "APPROVED" };
      await PengajuanStokService.create(payload);

      expect(PengajuanStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: "APPROVED" })
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // update()
  // ══════════════════════════════════════════════════════════════════════════
  describe("update()", () => {
    test("1. Error jika data tidak ditemukan", async () => {
      PengajuanStok.findOne.mockResolvedValue(null);
      await expect(PengajuanStokService.update("id-1", tenantID, {})).rejects.toThrow("tidak ditemukan");
    });

    test("2. Error jika status terlarang (sudah disubmit)", async () => {
      PengajuanStok.findOne.mockResolvedValue({ status: "SUBMITTED" });
      await expect(PengajuanStokService.update("id-1", tenantID, {})).rejects.toThrow("sudah diproses");
    });

    test("3. Berhasil update DRAFT dan konversi satuan ulang", async () => {
      PengajuanStok.findOne.mockResolvedValue({ status: "DRAFT" });
      BahanBaku.findById.mockResolvedValue({ satuan: "liter" });
      convertToBaseUnit.mockReturnValue(2); // misal 2000 ml -> 2 liter

      PengajuanStok.findByIdAndUpdate.mockResolvedValue({ _id: "id-1", status: "DRAFT" });

      const payload = {
        items: [{ bahanBakuID: "bb-2", jumlah: 2000, satuan: "ml" }],
      };

      await PengajuanStokService.update("id-1", tenantID, payload);

      expect(payload.items[0].jumlah).toBe(2);
      expect(payload.items[0].satuan).toBe("liter");
      expect(PengajuanStok.findByIdAndUpdate).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
    });

    test("4. Berhasil update tanpa ada perubahan pada items (konversi dilewati)", async () => {
      PengajuanStok.findOne.mockResolvedValue({ status: "DRAFT" });
      PengajuanStok.findByIdAndUpdate.mockResolvedValue({ _id: "id-1", status: "DRAFT" });

      const payload = { catatan: "Catatan baru" }; // tanpa items
      await PengajuanStokService.update("id-1", tenantID, payload);

      expect(BahanBaku.findById).not.toHaveBeenCalled(); // Lewati konversi
      expect(PengajuanStok.findByIdAndUpdate).toHaveBeenCalledWith(
        "id-1",
        { $set: payload },
        { new: true }
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // submit()
  // ══════════════════════════════════════════════════════════════════════════
  describe("submit()", () => {
    test("1. Error jika data tidak ditemukan", async () => {
      PengajuanStok.findOne.mockResolvedValue(null);
      await expect(PengajuanStokService.submit("id-1", tenantID)).rejects.toThrow("tidak ditemukan");
    });

    test("2. Error jika status bukan DRAFT", async () => {
      PengajuanStok.findOne.mockResolvedValue({ status: "APPROVED" });
      await expect(PengajuanStokService.submit("id-1", tenantID)).rejects.toThrow("Tidak bisa submit");
    });

    test("3. Berhasil submit (ubah DRAFT jadi SUBMITTED)", async () => {
      const mockSave = jest.fn();
      PengajuanStok.findOne.mockResolvedValue({ status: "DRAFT", save: mockSave });

      await PengajuanStokService.submit("id-1", tenantID);

      expect(mockSave).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // approve()
  // ══════════════════════════════════════════════════════════════════════════
  describe("approve()", () => {
    test("1. Error jika data tidak SUBMITTED", async () => {
      PengajuanStok.findOne.mockResolvedValue(null);
      await expect(PengajuanStokService.approve("id-1", tenantID, userID)).rejects.toThrow("SUBMITTED");
    });

    test("2. Berhasil approve dan merekam jejak persetujuan", async () => {
      const mockData = { status: "SUBMITTED", save: jest.fn() };
      PengajuanStok.findOne.mockResolvedValue(mockData);

      const result = await PengajuanStokService.approve("id-1", tenantID, userID);

      expect(mockData.status).toBe("APPROVED");
      expect(mockData.disetujuiOleh).toBe(userID);
      expect(mockData.tanggalApprove).toBeDefined();
      expect(mockData.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
      expect(result.message).toContain("disetujui");
    });

    test("3. Berhasil approve dan melanjutkan eksekusi jika cache Redis offline", async () => {
      const mockData = { status: "SUBMITTED", save: jest.fn() };
      PengajuanStok.findOne.mockResolvedValue(mockData);

      // Ubah status redis menjadi bukan "ready"
      redis.status = "reconnecting";

      await PengajuanStokService.approve("id-1", tenantID, userID);

      expect(redis.del).not.toHaveBeenCalled(); // Karena tidak ready, del di skip
      expect(mockData.save).toHaveBeenCalled(); // Tetap berhasil
      
      redis.status = "ready"; // Kembalikan state mock
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // reject()
  // ══════════════════════════════════════════════════════════════════════════
  describe("reject()", () => {
    test("1. Error jika data tidak SUBMITTED", async () => {
      PengajuanStok.findOne.mockResolvedValue(null);
      await expect(PengajuanStokService.reject("id-1", tenantID, userID, "Batal")).rejects.toThrow("Gagal menolak");
    });

    test("2. Berhasil reject, merekam alasan, dan menghapus cache (meskipun catch)", async () => {
      const mockData = { status: "SUBMITTED", save: jest.fn() };
      PengajuanStok.findOne.mockResolvedValue(mockData);

      redis.del.mockReturnValueOnce(Promise.reject(new Error("Redis error"))); // Uji .catch()

      const result = await PengajuanStokService.reject("id-1", tenantID, userID, "Stok habis");

      expect(mockData.status).toBe("REJECTED");
      expect(mockData.catatanPenolakan).toBe("Stok habis");
      expect(mockData.ditolakOleh).toBe(userID);
      expect(mockData.tanggalReject).toBeDefined();
      expect(mockData.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test("3. Default alasan fallback digunakan jika catatan penolakan kosong", async () => {
      const mockData = { status: "SUBMITTED", save: jest.fn() };
      PengajuanStok.findOne.mockResolvedValue(mockData);

      await PengajuanStokService.reject("id-1", tenantID, userID, "");

      expect(mockData.catatanPenolakan).toBe("Ditolak oleh admin");
    });
  });
});
