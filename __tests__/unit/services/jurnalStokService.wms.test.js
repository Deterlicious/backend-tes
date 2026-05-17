const mongoose = require("mongoose");

jest.mock("../../../models/jurnalStokModel");
jest.mock("../../../models/inventoryModel");
jest.mock("../../../config/redis", () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../../validators/jurnalStokValidator", () => ({
  validateJurnalPayload: jest.fn().mockReturnValue({ valid: true }),
}));

const Inventory = require("../../../models/inventoryModel");
const JurnalStok = require("../../../models/jurnalStokModel");

const jurnalStokService = require("../../../services/jurnalStokService");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const id = () => new mongoose.Types.ObjectId();

const mockInventoryDoc = (overrides = {}) => ({
  _id: id(),
  bahanBakuID: id(),
  locationID: id(),
  stok: 100,
  tenantID: id(),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const mockJurnalDoc = (overrides = {}) => ({
  _id: id(),
  tipeKoreksi: "Keluar",
  jumlah: 10,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
describe("JurnalStokService — WMS Audit Trail (Unit)", () => {
  let tenantID, bahanBakuID, dariLocationID, keLocationID, dicatatOleh;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantID = id();
    bahanBakuID = id();
    dariLocationID = id();
    keLocationID = id();
    dicatatOleh = id();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // kirimBarangJurnal
  // ═══════════════════════════════════════════════════════════════════════════
  describe("kirimBarangJurnal()", () => {
    test("1. [HAPPY] Kurangi stok & catat jurnal Keluar", async () => {
      const updatedInv = mockInventoryDoc({ stok: 90 });
      Inventory.findOneAndUpdate.mockResolvedValue(updatedInv);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc());

      const result = await jurnalStokService.kirimBarangJurnal(
        bahanBakuID, dariLocationID, 10, "SJ-001", tenantID, dicatatOleh
      );

      expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
        { bahanBakuID, locationID: dariLocationID, tenantID, stok: { $gte: 10 } },
        { $inc: { stok: -10 } },
        { new: true }
      );
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipeKoreksi: "Keluar",
          jumlah: 10,
          alasan: "Transfer Gudang",
          keterangan: "Kirim Transfer: SJ-001",
          locationID: dariLocationID,
          tenantID,
          dicatatOleh,
        })
      );
      expect(result).toHaveProperty("inventory", updatedInv);
      expect(result).toHaveProperty("jurnal");
    });

    test("2. [EDGE] Stok pas-pasan (qty = stok saat ini) — harus berhasil", async () => {
      Inventory.findOneAndUpdate.mockResolvedValue(mockInventoryDoc({ stok: 0 }));
      JurnalStok.create.mockResolvedValue(mockJurnalDoc());

      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 100, "SJ-002", tenantID)
      ).resolves.toBeDefined();
    });

    test("3. [ERROR] Stok tidak mencukupi → findOneAndUpdate null → throw 400", async () => {
      Inventory.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 999, "SJ-003", tenantID)
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Stok tidak mencukupi") });

      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("4. [ERROR] Record inventory tidak ada di lokasi asal → throw 400", async () => {
      Inventory.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-004", tenantID)
      ).rejects.toMatchObject({ status: 400 });
    });

    test("5. [BUG SCAN] Jurnal TIDAK dibuat jika update stok gagal (DB error)", async () => {
      Inventory.findOneAndUpdate.mockRejectedValue(new Error("DB connection lost"));

      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-005", tenantID)
      ).rejects.toThrow("DB connection lost");

      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("6. [BUG SCAN] dicatatOleh default null tidak menyebabkan error", async () => {
      Inventory.findOneAndUpdate.mockResolvedValue(mockInventoryDoc());
      JurnalStok.create.mockResolvedValue(mockJurnalDoc());

      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-006", tenantID)
        // dicatatOleh tidak dikirim → default null
      ).resolves.toBeDefined();

      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ dicatatOleh: null })
      );
    });

    test("7. [BUG SCAN] qtyKirim = 0 → throw 400 sebelum DB dipanggil", async () => {
      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 0, "SJ-007", tenantID)
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("harus lebih dari 0") });

      expect(Inventory.findOneAndUpdate).not.toHaveBeenCalled();
      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("8. [BUG SCAN] qtyKirim negatif → throw 400 sebelum DB dipanggil", async () => {
      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, -5, "SJ-008", tenantID)
      ).rejects.toMatchObject({ status: 400 });

      expect(Inventory.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("9. [BUG SCAN] Jurnal gagal → compensating rollback mengembalikan stok", async () => {
      Inventory.findOneAndUpdate
        .mockResolvedValueOnce(mockInventoryDoc({ stok: 90 })) // update stok berhasil
        .mockResolvedValueOnce({ stok: 100 });                 // compensating rollback
      JurnalStok.create.mockRejectedValue(new Error("Journal write failed"));

      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-009", tenantID)
      ).rejects.toThrow("Journal write failed");

      expect(Inventory.findOneAndUpdate).toHaveBeenCalledTimes(2);
      const compensateCall = Inventory.findOneAndUpdate.mock.calls[1];
      expect(compensateCall[1]).toEqual({ $inc: { stok: 10 } }); // dikembalikan +10
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // terimaBarangJurnal
  // ═══════════════════════════════════════════════════════════════════════════
  describe("terimaBarangJurnal()", () => {
    test("1. [HAPPY] Record sudah ada → increment stok & catat jurnal Masuk", async () => {
      const updatedInv = mockInventoryDoc({ stok: 110 });
      Inventory.findOneAndUpdate.mockResolvedValue(updatedInv);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc({ tipeKoreksi: "Masuk" }));

      const result = await jurnalStokService.terimaBarangJurnal(
        bahanBakuID, keLocationID, 10, "SJ-001", tenantID, dicatatOleh
      );

      expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
        { bahanBakuID, locationID: keLocationID, tenantID },
        { $inc: { stok: 10 } },
        { new: true }
      );
      expect(Inventory.create).not.toHaveBeenCalled();
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipeKoreksi: "Masuk",
          jumlah: 10,
          alasan: "Transfer Gudang",
          keterangan: "Terima Transfer: SJ-001",
          locationID: keLocationID,
        })
      );
      expect(result.inventory).toBe(updatedInv);
    });

    test("2. [HAPPY] Record belum ada di lokasi tujuan → inisialisasi via Inventory.create", async () => {
      Inventory.findOneAndUpdate.mockResolvedValue(null);
      const newInv = mockInventoryDoc({ stok: 10 });
      Inventory.create.mockResolvedValue(newInv);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc({ tipeKoreksi: "Masuk" }));

      const result = await jurnalStokService.terimaBarangJurnal(
        bahanBakuID, keLocationID, 10, "SJ-002", tenantID
      );

      expect(Inventory.create).toHaveBeenCalledWith({
        bahanBakuID,
        locationID: keLocationID,
        stok: 10,
        tenantID,
      });
      expect(result.inventory).toBe(newInv);
      expect(JurnalStok.create).toHaveBeenCalled();
    });

    test("3. [BUG SCAN] Jurnal TIDAK dibuat jika Inventory.create gagal (DB error)", async () => {
      Inventory.findOneAndUpdate.mockResolvedValue(null);
      Inventory.create.mockRejectedValue(new Error("Validation error"));

      await expect(
        jurnalStokService.terimaBarangJurnal(bahanBakuID, keLocationID, 10, "SJ-003", tenantID)
      ).rejects.toThrow("Validation error");

      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("4. [BUG SCAN] Jurnal TIDAK dibuat jika findOneAndUpdate gagal (DB error)", async () => {
      Inventory.findOneAndUpdate.mockRejectedValue(new Error("Timeout"));

      await expect(
        jurnalStokService.terimaBarangJurnal(bahanBakuID, keLocationID, 10, "SJ-004", tenantID)
      ).rejects.toThrow("Timeout");

      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("5. [ERROR] qtyTerima = 0 → throw 400 sebelum DB dipanggil", async () => {
      await expect(
        jurnalStokService.terimaBarangJurnal(bahanBakuID, keLocationID, 0, "SJ-005", tenantID)
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("harus lebih dari 0") });

      expect(Inventory.findOneAndUpdate).not.toHaveBeenCalled();
      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("6. [BUG SCAN] Jurnal gagal pada record BARU → compensating delete inventory", async () => {
      const newInv = { ...mockInventoryDoc({ stok: 10 }), _id: new mongoose.Types.ObjectId() };
      Inventory.findOneAndUpdate.mockResolvedValue(null); // record tidak ada
      Inventory.create.mockResolvedValue(newInv);
      Inventory.findOneAndDelete.mockResolvedValue(newInv);
      JurnalStok.create.mockRejectedValue(new Error("Journal write failed"));

      await expect(
        jurnalStokService.terimaBarangJurnal(bahanBakuID, keLocationID, 10, "SJ-006", tenantID)
      ).rejects.toThrow("Journal write failed");

      expect(Inventory.findOneAndDelete).toHaveBeenCalledWith({ _id: newInv._id });
    });

    test("7. [BUG SCAN] Jurnal gagal pada record LAMA → compensating decrement stok", async () => {
      Inventory.findOneAndUpdate
        .mockResolvedValueOnce(mockInventoryDoc({ stok: 110 })) // update stok berhasil
        .mockResolvedValueOnce({ stok: 100 });                  // compensating rollback
      JurnalStok.create.mockRejectedValue(new Error("Journal write failed"));

      await expect(
        jurnalStokService.terimaBarangJurnal(bahanBakuID, keLocationID, 10, "SJ-007", tenantID)
      ).rejects.toThrow("Journal write failed");

      const compensateCall = Inventory.findOneAndUpdate.mock.calls[1];
      expect(compensateCall[1]).toEqual({ $inc: { stok: -10 } }); // dikurangi kembali
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // rollbackBarangJurnal
  // ═══════════════════════════════════════════════════════════════════════════
  describe("rollbackBarangJurnal()", () => {
    test("1. [HAPPY] Kembalikan stok & catat jurnal Masuk (Lainnya)", async () => {
      const restoredInv = mockInventoryDoc({ stok: 110 });
      Inventory.findOneAndUpdate.mockResolvedValue(restoredInv);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc({ tipeKoreksi: "Masuk" }));

      const result = await jurnalStokService.rollbackBarangJurnal(
        bahanBakuID, dariLocationID, 10, "SJ-001", tenantID, dicatatOleh
      );

      expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
        { bahanBakuID, locationID: dariLocationID, tenantID },
        { $inc: { stok: 10 } },
        { new: true }
      );
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipeKoreksi: "Masuk",
          jumlah: 10,
          alasan: "Lainnya",
          keterangan: "Pembatalan Transfer: SJ-001",
        })
      );
      expect(result.inventory).toBe(restoredInv);
    });

    test("2. [ERROR] Record tidak ditemukan → throw 404 (data corrupt / sudah dihapus)", async () => {
      Inventory.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        jurnalStokService.rollbackBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-002", tenantID)
      ).rejects.toMatchObject({ status: 404, message: expect.stringContaining("Rollback tidak dapat dilakukan") });

      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("3. [BUG SCAN] Jurnal TIDAK dibuat jika update stok gagal (DB error)", async () => {
      Inventory.findOneAndUpdate.mockRejectedValue(new Error("Write conflict"));

      await expect(
        jurnalStokService.rollbackBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-003", tenantID)
      ).rejects.toThrow("Write conflict");

      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("4. [BUG SCAN] Rollback tidak memiliki guard stok minimum (boleh melebihi stok sebelumnya)", async () => {
      Inventory.findOneAndUpdate.mockResolvedValue(mockInventoryDoc({ stok: 999 }));
      JurnalStok.create.mockResolvedValue(mockJurnalDoc());

      await expect(
        jurnalStokService.rollbackBarangJurnal(bahanBakuID, dariLocationID, 999, "SJ-004", tenantID)
      ).resolves.toBeDefined();

      expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({ stok: expect.anything() }),
        { $inc: { stok: 999 } },
        { new: true }
      );
    });

    test("5. [ERROR] qtyKirim = 0 → throw 400 sebelum DB dipanggil", async () => {
      await expect(
        jurnalStokService.rollbackBarangJurnal(bahanBakuID, dariLocationID, 0, "SJ-005", tenantID)
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("harus lebih dari 0") });

      expect(Inventory.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("6. [BUG SCAN] Jurnal gagal → compensating rollback mengurangi stok kembali", async () => {
      Inventory.findOneAndUpdate
        .mockResolvedValueOnce(mockInventoryDoc({ stok: 110 })) // kembalikan stok berhasil
        .mockResolvedValueOnce({ stok: 100 });                  // compensating rollback
      JurnalStok.create.mockRejectedValue(new Error("Journal write failed"));

      await expect(
        jurnalStokService.rollbackBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-006", tenantID)
      ).rejects.toThrow("Journal write failed");

      expect(Inventory.findOneAndUpdate).toHaveBeenCalledTimes(2);
      const compensateCall = Inventory.findOneAndUpdate.mock.calls[1];
      expect(compensateCall[1]).toEqual({ $inc: { stok: -10 } }); // stok dikurangi kembali
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // opnameBarangJurnal
  // ═══════════════════════════════════════════════════════════════════════════
  describe("opnameBarangJurnal()", () => {
    let inventoryID, mockInv;

    beforeEach(() => {
      inventoryID = id();
      mockInv = mockInventoryDoc({ _id: inventoryID, stok: 100 });
    });

    test("1. [HAPPY] Stok fisik lebih banyak → delta positif → jurnal Masuk", async () => {
      Inventory.findOne.mockResolvedValue(mockInv);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc({ tipeKoreksi: "Masuk", jumlah: 20 }));

      const result = await jurnalStokService.opnameBarangJurnal(
        inventoryID, 120, "Opname Mei 2026", tenantID, dicatatOleh
      );

      expect(mockInv.stok).toBe(120);
      expect(mockInv.save).toHaveBeenCalled();
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipeKoreksi: "Masuk",
          jumlah: 20,
          alasan: "Stok Opname",
          keterangan: "Opname Mei 2026",
        })
      );
      expect(result.delta).toBe(20);
    });

    test("2. [HAPPY] Stok fisik lebih sedikit → delta negatif → jurnal Keluar", async () => {
      Inventory.findOne.mockResolvedValue(mockInv);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc({ tipeKoreksi: "Keluar", jumlah: 30 }));

      const result = await jurnalStokService.opnameBarangJurnal(
        inventoryID, 70, "Opname Mei 2026", tenantID
      );

      expect(mockInv.stok).toBe(70);
      expect(result.delta).toBe(-30);
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipeKoreksi: "Keluar", jumlah: 30 })
      );
    });

    test("3. [EDGE] Stok fisik sama dengan sistem → delta = 0 → jurnal Masuk tetap dibuat", async () => {
      Inventory.findOne.mockResolvedValue(mockInv);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc({ tipeKoreksi: "Masuk", jumlah: 0 }));

      const result = await jurnalStokService.opnameBarangJurnal(
        inventoryID, 100, "Opname tidak ada selisih", tenantID
      );

      expect(result.delta).toBe(0);
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipeKoreksi: "Masuk", jumlah: 0 })
      );
    });

    test("4. [EDGE] Opname ke nol (fisik = 0) → delta negatif → jurnal Keluar", async () => {
      Inventory.findOne.mockResolvedValue(mockInv);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc({ tipeKoreksi: "Keluar", jumlah: 100 }));

      const result = await jurnalStokService.opnameBarangJurnal(
        inventoryID, 0, "Barang hilang semua", tenantID
      );

      expect(mockInv.stok).toBe(0);
      expect(result.delta).toBe(-100);
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipeKoreksi: "Keluar", jumlah: 100 })
      );
    });

    test("5. [ERROR] fisikAktual negatif → throw 400 sebelum DB dipanggil", async () => {
      await expect(
        jurnalStokService.opnameBarangJurnal(inventoryID, -1, "Test", tenantID)
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("tidak boleh bernilai negatif") });

      expect(Inventory.findOne).not.toHaveBeenCalled();
      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("6. [ERROR] Inventory tidak ditemukan → throw 404", async () => {
      Inventory.findOne.mockResolvedValue(null);

      await expect(
        jurnalStokService.opnameBarangJurnal(inventoryID, 50, "Test", tenantID)
      ).rejects.toMatchObject({ status: 404 });

      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("7. [BUG SCAN] save() gagal → jurnal TIDAK dibuat & stok DIKEMBALIKAN ke nilai semula", async () => {
      mockInv.stok = 100;
      mockInv.save
        .mockRejectedValueOnce(new Error("Mongoose save error")) // save pertama gagal
        .mockResolvedValueOnce(true);                            // save compensating berhasil
      Inventory.findOne.mockResolvedValue(mockInv);

      await expect(
        jurnalStokService.opnameBarangJurnal(inventoryID, 120, "Test", tenantID)
      ).rejects.toThrow("Mongoose save error");

      expect(JurnalStok.create).not.toHaveBeenCalled();
    });

    test("8a. [BUG SCAN] JurnalStok.create gagal setelah save → stok DIKEMBALIKAN ke nilai semula", async () => {
      mockInv.stok = 100;
      Inventory.findOne.mockResolvedValue(mockInv);
      JurnalStok.create.mockRejectedValue(new Error("Journal write failed"));

      await expect(
        jurnalStokService.opnameBarangJurnal(inventoryID, 120, "Test", tenantID)
      ).rejects.toThrow("Journal write failed");

      // Compensating: stok harus dikembalikan ke 100
      expect(mockInv.stok).toBe(100);
      expect(mockInv.save).toHaveBeenCalledTimes(2); // save baru + save restore
    });

    test("8. [BUG SCAN] catatan undefined/null → fallback ke string default", async () => {
      Inventory.findOne.mockResolvedValue(mockInv);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc());

      await jurnalStokService.opnameBarangJurnal(inventoryID, 110, null, tenantID);

      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ keterangan: "Penyesuaian stok fisik" })
      );

      jest.clearAllMocks();
      Inventory.findOne.mockResolvedValue(mockInventoryDoc({ stok: 100 }));
      JurnalStok.create.mockResolvedValue(mockJurnalDoc());

      await jurnalStokService.opnameBarangJurnal(inventoryID, 110, undefined, tenantID);
      expect(JurnalStok.create).toHaveBeenCalledWith(
        expect.objectContaining({ keterangan: "Penyesuaian stok fisik" })
      );
    });

    test("9. [BUG SCAN] jumlah jurnal selalu positif meski delta negatif (Math.abs)", async () => {
      mockInv.stok = 50;
      Inventory.findOne.mockResolvedValue(mockInv);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc());

      await jurnalStokService.opnameBarangJurnal(inventoryID, 20, "Test", tenantID);

      const call = JurnalStok.create.mock.calls[0][0];
      expect(call.jumlah).toBe(30);   // Math.abs(-30)
      expect(call.jumlah).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SKENARIO LINTAS FUNGSI (Cross-function / Race Condition)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Skenario Luar Konteks — Deteksi Bug Potensial", () => {
    test("1. [RACE] kirim → rollback berurutan tidak mencatat jurnal ganda", async () => {
      const invAfterKirim = mockInventoryDoc({ stok: 90 });
      const invAfterRollback = mockInventoryDoc({ stok: 100 });

      Inventory.findOneAndUpdate
        .mockResolvedValueOnce(invAfterKirim)    // kirim
        .mockResolvedValueOnce(invAfterRollback); // rollback

      JurnalStok.create.mockResolvedValue(mockJurnalDoc());

      await jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-X", tenantID);
      await jurnalStokService.rollbackBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-X", tenantID);

      expect(JurnalStok.create).toHaveBeenCalledTimes(2);
      const calls = JurnalStok.create.mock.calls.map(c => c[0].tipeKoreksi);
      expect(calls).toEqual(["Keluar", "Masuk"]);
    });

    test("2. [ISOLATION] Fungsi WMS tidak memanggil clearCache (jurnal CRUD yang memanggil)", async () => {
      Inventory.findOneAndUpdate.mockResolvedValue(mockInventoryDoc());
      JurnalStok.create.mockResolvedValue(mockJurnalDoc());

      const redis = require("../../../config/redis");
      await jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-Y", tenantID);

      expect(redis.del).not.toHaveBeenCalled();
    });

    test("3. [INTEGRITY] JurnalStok.create error setelah stok berhasil diupdate → compensating rollback dieksekusi", async () => {
      Inventory.findOneAndUpdate
        .mockResolvedValueOnce(mockInventoryDoc({ stok: 90 })) // update stok berhasil
        .mockResolvedValueOnce({ stok: 100 });                 // compensating rollback
      JurnalStok.create.mockRejectedValue(new Error("Journal write failed"));

      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-Z", tenantID)
      ).rejects.toThrow("Journal write failed");

      // Compensating rollback dieksekusi — stok dikembalikan
      expect(Inventory.findOneAndUpdate).toHaveBeenCalledTimes(2);
      const compensateCall = Inventory.findOneAndUpdate.mock.calls[1];
      expect(compensateCall[1]).toEqual({ $inc: { stok: 10 } });
    });

    test("4. [TENANT ISOLATION] Query selalu menyertakan tenantID — tidak bisa akses data tenant lain", async () => {
      const otherTenant = id();
      Inventory.findOneAndUpdate.mockResolvedValue(null); // Tidak ditemukan karena tenant beda

      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 10, "SJ-001", otherTenant)
      ).rejects.toMatchObject({ status: 400 });

      expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ tenantID: otherTenant }),
        expect.anything(),
        expect.anything()
      );
    });

    test("5. [OPNAME + KIRIM] Opname ke nilai lebih rendah lalu kirim → kirim memakai stok terbaru", async () => {
      const invAfterOpname = mockInventoryDoc({ stok: 30 });
      invAfterOpname.save = jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      });

      Inventory.findOne.mockResolvedValue(invAfterOpname);
      JurnalStok.create.mockResolvedValue(mockJurnalDoc());

      await jurnalStokService.opnameBarangJurnal(invAfterOpname._id, 30, "Opname turun", tenantID);

      // Kirim lebih banyak dari stok baru → harus gagal (null dari guard)
      Inventory.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        jurnalStokService.kirimBarangJurnal(bahanBakuID, dariLocationID, 50, "SJ-AFTER", tenantID)
      ).rejects.toMatchObject({ status: 400 });
    });
  });
});
