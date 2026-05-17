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

const JurnalStok = require("../../../models/jurnalStokModel");
const Inventory  = require("../../../models/inventoryModel");
const redis      = require("../../../config/redis");
const { validateJurnalPayload } = require("../../../validators/jurnalStokValidator");

const jurnalStokService = require("../../../services/jurnalStokService");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const id = () => new mongoose.Types.ObjectId();

const mockChain = (data) => ({
  populate: jest.fn().mockReturnThis(),
  sort:     jest.fn().mockReturnThis(),
  lean:     jest.fn().mockResolvedValue(data),
});

const mockJurnal = (overrides = {}) => ({
  _id:         id(),
  bahanBakuID: id(),
  locationID:  id(),
  tenantID:    id(),
  tipeKoreksi: "Masuk",
  jumlah:      10,
  alasan:      "Transfer Gudang",
  tanggal:     new Date(),
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
describe("JurnalStokService — CRUD (Unit)", () => {
  let tenantID;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantID = id();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getAll()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("getAll()", () => {
    test("1. [ERROR] tenantID tidak ada → throw 400", async () => {
      await expect(jurnalStokService.getAll(null)).rejects.toMatchObject({ status: 400 });
      await expect(jurnalStokService.getAll(undefined)).rejects.toMatchObject({ status: 400 });
      await expect(jurnalStokService.getAll("")).rejects.toMatchObject({ status: 400 });
    });

    test("2. [CACHE HIT] Data ada di Redis → langsung return tanpa query DB", async () => {
      const cached = [mockJurnal()];
      // Redis menyimpan JSON string → parse mengubah Date ke string
      const serialized = JSON.parse(JSON.stringify(cached));
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await jurnalStokService.getAll(tenantID);

      expect(redis.get).toHaveBeenCalledWith(`jurnalstok:list:${tenantID}`);
      expect(JurnalStok.find).not.toHaveBeenCalled();
      expect(result).toEqual(serialized);
    });

    test("3. [CACHE MISS] Tidak ada cache → query DB, simpan ke Redis", async () => {
      const data = [mockJurnal(), mockJurnal()];
      redis.get.mockResolvedValue(null);
      JurnalStok.find.mockReturnValue(mockChain(data));

      const result = await jurnalStokService.getAll(tenantID);

      expect(JurnalStok.find).toHaveBeenCalledWith({ tenantID });
      expect(redis.set).toHaveBeenCalledWith(
        `jurnalstok:list:${tenantID}`,
        JSON.stringify(data),
        "EX",
        300
      );
      expect(result).toHaveLength(2);
    });

    test("4. [EDGE] Data kosong → tidak disimpan ke Redis", async () => {
      redis.get.mockResolvedValue(null);
      JurnalStok.find.mockReturnValue(mockChain([]));

      const result = await jurnalStokService.getAll(tenantID);

      expect(redis.set).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test("5. [EDGE] DB error → error dipropagasi ke caller", async () => {
      redis.get.mockResolvedValue(null);
      JurnalStok.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort:     jest.fn().mockReturnThis(),
        lean:     jest.fn().mockRejectedValue(new Error("DB down")),
      });

      await expect(jurnalStokService.getAll(tenantID)).rejects.toThrow("DB down");
    });

    test("6. [SECURITY] Query selalu menyertakan tenantID", async () => {
      JurnalStok.find.mockReturnValue(mockChain([mockJurnal()]));

      await jurnalStokService.getAll(tenantID);

      expect(JurnalStok.find).toHaveBeenCalledWith({ tenantID });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getById()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("getById()", () => {
    test("1. [CACHE HIT] Cache ada & tenantID cocok → return cache", async () => {
      const jurnal = mockJurnal({ tenantID });
      redis.get.mockResolvedValue(JSON.stringify({ ...jurnal, tenantID: tenantID.toString() }));

      const result = await jurnalStokService.getById(jurnal._id, tenantID);

      expect(JurnalStok.findOne).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test("2. [SECURITY] Cache ada tapi tenantID beda → return null (tidak bocor ke tenant lain)", async () => {
      const tenantLain = id();
      redis.get.mockResolvedValue(JSON.stringify({ tenantID: tenantLain.toString() }));

      const result = await jurnalStokService.getById(id(), tenantID);

      expect(result).toBeNull();
      expect(JurnalStok.findOne).not.toHaveBeenCalled();
    });

    test("3. [CACHE MISS] Tidak ada cache → query DB dengan _id + tenantID", async () => {
      const jurnalID = id();
      const data = mockJurnal({ _id: jurnalID, tenantID });
      redis.get.mockResolvedValue(null);
      JurnalStok.findOne.mockReturnValue(mockChain(data));

      const result = await jurnalStokService.getById(jurnalID, tenantID);

      expect(JurnalStok.findOne).toHaveBeenCalledWith({
        _id: jurnalID,
        tenantID,
      });
      expect(redis.set).toHaveBeenCalledWith(
        `jurnalstok:detail:${jurnalID}`,
        JSON.stringify(data),
        "EX",
        300
      );
      expect(result).toEqual(data);
    });

    test("4. [NOT FOUND] Data tidak ada di DB → return null", async () => {
      redis.get.mockResolvedValue(null);
      JurnalStok.findOne.mockReturnValue(mockChain(null));

      const result = await jurnalStokService.getById(id(), tenantID);

      expect(result).toBeNull();
      expect(redis.set).not.toHaveBeenCalled();
    });

    test("5. [SECURITY] Query DB selalu menyertakan tenantID (bukan hanya _id)", async () => {
      const jurnalID = id();
      redis.get.mockResolvedValue(null);
      JurnalStok.findOne.mockReturnValue(mockChain(null));

      await jurnalStokService.getById(jurnalID, tenantID);

      expect(JurnalStok.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ tenantID })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // create()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("create()", () => {
    const basePayload = () => ({
      bahanBakuID: id(),
      locationID:  id(),
      tenantID:    id(),
      tipeKoreksi: "Masuk",
      jumlah:      10,
      alasan:      "Transfer Gudang",
      tanggal:     new Date(),
    });

    test("1. [HAPPY] Payload valid → buat jurnal, update inventory, clear cache", async () => {
      const payload = basePayload();
      const createdJurnal = mockJurnal(payload);
      JurnalStok.create.mockResolvedValue(createdJurnal);
      Inventory.findOneAndUpdate.mockResolvedValue({ stok: 110 });

      const result = await jurnalStokService.create(payload);

      expect(JurnalStok.create).toHaveBeenCalledWith(payload);
      expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          bahanBakuID: payload.bahanBakuID,
          locationID:  payload.locationID,
          tenantID:    payload.tenantID,
        }),
        { $inc: { stok: 10 } }, // Masuk → multiplier +1 → +10
        { upsert: true, new: true }
      );
      expect(redis.del).toHaveBeenCalled();
      expect(result).toEqual(createdJurnal);
    });

    test("2. [HAPPY] tipeKoreksi 'Keluar' → stok dikurangi ($inc negatif)", async () => {
      const payload = { ...basePayload(), tipeKoreksi: "Keluar", jumlah: 5 };
      JurnalStok.create.mockResolvedValue(mockJurnal(payload));
      Inventory.findOneAndUpdate.mockResolvedValue({ stok: 95 });

      await jurnalStokService.create(payload);

      expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $inc: { stok: -5 } }, // Keluar → multiplier -1 → -5
        expect.anything()
      );
    });

    test("3. [VALIDATION] validateJurnalPayload gagal → return { error } tanpa DB dipanggil", async () => {
      validateJurnalPayload.mockReturnValue({ valid: false, errors: ["tenantID wajib"] });

      const result = await jurnalStokService.create({});

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("tenantID wajib");
      expect(JurnalStok.create).not.toHaveBeenCalled();
      expect(Inventory.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("4. [ERROR] JurnalStok.create gagal → error dilempar ke caller", async () => {
      validateJurnalPayload.mockReturnValue({ valid: true }); // reset ke valid
      JurnalStok.create.mockRejectedValue(new Error("Write error"));
      Inventory.findOneAndUpdate.mockResolvedValue({});

      await expect(jurnalStokService.create(basePayload())).rejects.toThrow("Write error");
    });

    test("5. [CACHE] Cache di-clear setelah create berhasil", async () => {
      validateJurnalPayload.mockReturnValue({ valid: true }); // reset ke valid
      const payload = basePayload();
      JurnalStok.create.mockResolvedValue(mockJurnal());
      Inventory.findOneAndUpdate.mockResolvedValue({});

      await jurnalStokService.create(payload);

      expect(redis.del).toHaveBeenCalledWith(
        expect.arrayContaining([`jurnalstok:list:${payload.tenantID}`])
      );
    });

    test("6. [MULTIPLIER] _getMultiplier: 'Masuk' → +1, 'Keluar' → -1", () => {
      expect(jurnalStokService._getMultiplier("Masuk")).toBe(1);
      expect(jurnalStokService._getMultiplier("Keluar")).toBe(-1);
      expect(jurnalStokService._getMultiplier("lainnya")).toBe(-1); // default fallback
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // update()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("update()", () => {
    let jurnalID, oldJurnal;

    beforeEach(() => {
      validateJurnalPayload.mockReturnValue({ valid: true }); // pastikan validasi lulus di semua update test
      jurnalID = id();
      oldJurnal = {
        _id:         jurnalID,
        bahanBakuID: id(),
        locationID:  id(),
        tenantID,
        tipeKoreksi: "Masuk",
        jumlah:      10,
      };
      JurnalStok.findOne.mockResolvedValue(oldJurnal);
      JurnalStok.findOneAndUpdate.mockReturnValue(mockChain({ ...oldJurnal, jumlah: 20 }));
      Inventory.updateOne.mockResolvedValue({ modifiedCount: 1 });
    });

    test("1. [HAPPY] Update jumlah → reverse old + apply new ke inventory", async () => {
      const result = await jurnalStokService.update(jurnalID, { jumlah: 20 }, tenantID);

      // Step 1: reverse stok lama (Masuk 10 → kurangi 10)
      expect(Inventory.updateOne).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ bahanBakuID: oldJurnal.bahanBakuID }),
        { $inc: { stok: -10 } }
      );
      // Step 2: apply stok baru (Masuk 20 → tambah 20)
      expect(Inventory.updateOne).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        { $inc: { stok: 20 } },
        { upsert: true }
      );
      expect(result).toBeDefined();
    });

    test("2. [HAPPY] Update tipeKoreksi dari Masuk ke Keluar → stok dikurangi", async () => {
      await jurnalStokService.update(jurnalID, { tipeKoreksi: "Keluar" }, tenantID);

      // Nilai akhir: Keluar × jumlah lama (10) = -10
      expect(Inventory.updateOne).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        { $inc: { stok: -10 } },
        expect.anything()
      );
    });

    test("3. [NOT FOUND] Jurnal tidak ada → return null, inventory tidak disentuh", async () => {
      JurnalStok.findOne.mockResolvedValue(null);

      const result = await jurnalStokService.update(jurnalID, { jumlah: 5 }, tenantID);

      expect(result).toBeNull();
      expect(Inventory.updateOne).not.toHaveBeenCalled();
    });

    test("4. [VALIDATION] validateJurnalPayload gagal → return { error }, tidak query DB", async () => {
      validateJurnalPayload.mockReturnValue({ valid: false, errors: ["jumlah harus > 0"] });

      const result = await jurnalStokService.update(jurnalID, { jumlah: 0 }, tenantID);

      expect(result).toHaveProperty("error");
      expect(JurnalStok.findOne).not.toHaveBeenCalled();
    });

    test("5. [SECURITY] tenantID, bahanBakuID, locationID dihapus dari payload sebelum update", async () => {
      const payload = {
        jumlah:      15,
        tenantID:    id(),    // tidak boleh diubah
        bahanBakuID: id(),    // tidak boleh diubah
        locationID:  id(),    // tidak boleh diubah
      };

      await jurnalStokService.update(jurnalID, payload, tenantID);

      const updateCall = JurnalStok.findOneAndUpdate.mock.calls[0][1];
      expect(updateCall.tenantID).toBeUndefined();
      expect(updateCall.bahanBakuID).toBeUndefined();
      expect(updateCall.locationID).toBeUndefined();
    });

    test("6. [CACHE] Cache list + detail di-clear setelah update berhasil", async () => {
      await jurnalStokService.update(jurnalID, { jumlah: 5 }, tenantID);

      expect(redis.del).toHaveBeenCalledWith(
        expect.arrayContaining([
          `jurnalstok:list:${tenantID}`,
          `jurnalstok:detail:${jurnalID}`,
        ])
      );
    });

    test("7. [EDGE] jumlah di payload undefined → pakai jumlah lama dari DB", async () => {
      await jurnalStokService.update(jurnalID, { tipeKoreksi: "Keluar" }, tenantID);

      // finalJumlah = oldJurnal.jumlah (10), finalTipe = "Keluar" → -10
      expect(Inventory.updateOne).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        { $inc: { stok: -10 } },
        expect.anything()
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // delete()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("delete()", () => {
    test("1. [HAPPY] Hapus jurnal 'Masuk' → stok dikurangi (reverse), return true", async () => {
      const jurnalID = id();
      const deleted = {
        _id:         jurnalID,
        bahanBakuID: id(),
        locationID:  id(),
        tipeKoreksi: "Masuk",
        jumlah:      10,
      };
      JurnalStok.findOneAndDelete.mockResolvedValue(deleted);
      Inventory.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await jurnalStokService.delete(jurnalID, tenantID);

      expect(JurnalStok.findOneAndDelete).toHaveBeenCalledWith({
        _id: jurnalID,
        tenantID,
      });
      // Masuk × 10 = +10 → reverse → -10
      expect(Inventory.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ bahanBakuID: deleted.bahanBakuID }),
        { $inc: { stok: -10 } }
      );
      expect(result).toBe(true);
    });

    test("2. [HAPPY] Hapus jurnal 'Keluar' → stok ditambah (reverse), return true", async () => {
      const deleted = { bahanBakuID: id(), locationID: id(), tipeKoreksi: "Keluar", jumlah: 5 };
      JurnalStok.findOneAndDelete.mockResolvedValue(deleted);
      Inventory.updateOne.mockResolvedValue({});

      await jurnalStokService.delete(id(), tenantID);

      // Keluar × 5 = -5 → reverse → -(-5) = +5
      expect(Inventory.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $inc: { stok: 5 } }
      );
    });

    test("3. [NOT FOUND] Jurnal tidak ada → return null, inventory tidak disentuh", async () => {
      JurnalStok.findOneAndDelete.mockResolvedValue(null);

      const result = await jurnalStokService.delete(id(), tenantID);

      expect(result).toBeNull();
      expect(Inventory.updateOne).not.toHaveBeenCalled();
    });

    test("4. [SECURITY] Delete hanya jika tenantID cocok (_id + tenantID dalam query)", async () => {
      JurnalStok.findOneAndDelete.mockResolvedValue(null);
      const jurnalID = id();

      await jurnalStokService.delete(jurnalID, tenantID);

      expect(JurnalStok.findOneAndDelete).toHaveBeenCalledWith({
        _id:      jurnalID,
        tenantID: tenantID,
      });
    });

    test("5. [CACHE] Cache list + detail di-clear setelah delete berhasil", async () => {
      const jurnalID = id();
      JurnalStok.findOneAndDelete.mockResolvedValue({
        bahanBakuID: id(), locationID: id(), tipeKoreksi: "Masuk", jumlah: 1,
      });
      Inventory.updateOne.mockResolvedValue({});

      await jurnalStokService.delete(jurnalID, tenantID);

      expect(redis.del).toHaveBeenCalledWith(
        expect.arrayContaining([
          `jurnalstok:list:${tenantID}`,
          `jurnalstok:detail:${jurnalID}`,
        ])
      );
    });

    test("6. [ERROR] DB error saat delete → error dipropagasi (tidak silent)", async () => {
      JurnalStok.findOneAndDelete.mockRejectedValue(new Error("Timeout"));

      await expect(jurnalStokService.delete(id(), tenantID)).rejects.toThrow("Timeout");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // clearCache() — internal helper
  // ═══════════════════════════════════════════════════════════════════════════
  describe("clearCache()", () => {
    test("1. Hanya tenantID → hapus hanya KEY_LIST", async () => {
      await jurnalStokService.clearCache(tenantID);

      expect(redis.del).toHaveBeenCalledWith([`jurnalstok:list:${tenantID}`]);
    });

    test("2. tenantID + id → hapus KEY_LIST dan KEY_DETAIL sekaligus", async () => {
      const jurnalID = id();
      await jurnalStokService.clearCache(tenantID, jurnalID);

      expect(redis.del).toHaveBeenCalledWith([
        `jurnalstok:list:${tenantID}`,
        `jurnalstok:detail:${jurnalID}`,
      ]);
    });
  });
});
