const mongoose = require("mongoose");

// ─── Mock semua dependensi sebelum require controller ───────────────────────
jest.mock("../../../services/jurnalStokService");
jest.mock("../../../models/permissionModel");
jest.mock("../../../validators/jurnalStokValidator", () => ({
  validateWmsPayload: jest.fn().mockReturnValue({ valid: true }),
}));

const jurnalStokController = require("../../../controllers/jurnalStokController");
const jurnalStokService    = require("../../../services/jurnalStokService");
const Permission            = require("../../../models/permissionModel");
const { validateWmsPayload } = require("../../../validators/jurnalStokValidator");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const id = () => new mongoose.Types.ObjectId().toString();

const makeReq = (overrides = {}) => ({
  body:   {},
  params: {},
  pengguna: {
    tenantID:    id(),
    _id:         id(),
    permissions: ["read-jurnal-stok", "kelola-jurnal-stok"],
  },
  ...overrides,
});

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json:   jest.fn().mockReturnThis(),
});

// Shortcut: izinkan semua permission (string match langsung)
const allowAll = () => Permission.findOne.mockResolvedValue(null);

// ─────────────────────────────────────────────────────────────────────────────
describe("JurnalStokController — Unit Test", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req  = makeReq();
    res  = makeRes();
    next = jest.fn();
    // Permission match via string (req.pengguna.permissions.includes(name))
    // — tidak perlu Permission.findOne jika nama permission sudah ada di array
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getAll()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("getAll()", () => {
    test("1. [HAPPY] Berhasil → res.json({ data })", async () => {
      const data = [{ _id: id() }];
      jurnalStokService.getAll.mockResolvedValue(data);

      await jurnalStokController.getAll(req, res, next);

      expect(jurnalStokService.getAll).toHaveBeenCalledWith(req.pengguna.tenantID);
      expect(res.json).toHaveBeenCalledWith({ data });
      expect(next).not.toHaveBeenCalled();
    });

    test("2. [AUTH] Permission tidak ada → next(403)", async () => {
      req.pengguna.permissions = [];
      Permission.findOne.mockResolvedValue(null); // nama permission tidak ditemukan di DB

      await jurnalStokController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(jurnalStokService.getAll).not.toHaveBeenCalled();
    });

    test("3. [AUTH] tenantID null → next(403)", async () => {
      req.pengguna.tenantID = null;

      await jurnalStokController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    test("4. [ERROR] Service throw → diteruskan ke next()", async () => {
      jurnalStokService.getAll.mockRejectedValue(new Error("DB error"));

      await jurnalStokController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(res.json).not.toHaveBeenCalled();
    });

    test("5. [EDGE] Data kosong → res.json({ data: [] })", async () => {
      jurnalStokService.getAll.mockResolvedValue([]);

      await jurnalStokController.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: [] });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getById()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("getById()", () => {
    beforeEach(() => { req.params.id = id(); });

    test("1. [HAPPY] Ditemukan → res.json({ data })", async () => {
      const data = { _id: req.params.id };
      jurnalStokService.getById.mockResolvedValue(data);

      await jurnalStokController.getById(req, res, next);

      expect(jurnalStokService.getById).toHaveBeenCalledWith(req.params.id, req.pengguna.tenantID);
      expect(res.json).toHaveBeenCalledWith({ data });
    });

    test("2. [NOT FOUND] Service return null → next(404)", async () => {
      jurnalStokService.getById.mockResolvedValue(null);

      await jurnalStokController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    test("3. [AUTH] Permission tidak ada → next(403)", async () => {
      req.pengguna.permissions = [];
      Permission.findOne.mockResolvedValue(null);

      await jurnalStokController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(jurnalStokService.getById).not.toHaveBeenCalled();
    });

    test("4. [SECURITY] tenantID selalu dikirim ke service (tidak bisa skip)", async () => {
      jurnalStokService.getById.mockResolvedValue({ _id: req.params.id });

      await jurnalStokController.getById(req, res, next);

      const [, calledTenantID] = jurnalStokService.getById.mock.calls[0];
      expect(calledTenantID).toBe(req.pengguna.tenantID);
    });

    test("5. [ERROR] Service throw → next(err)", async () => {
      jurnalStokService.getById.mockRejectedValue(new Error("timeout"));

      await jurnalStokController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // create()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("create()", () => {
    beforeEach(() => {
      req.body = { jumlah: 10, tipeKoreksi: "Masuk", alasan: "Transfer Gudang" };
    });

    test("1. [HAPPY] Berhasil → 201 + { data, message }", async () => {
      const created = { _id: id(), jumlah: 10 };
      jurnalStokService.create.mockResolvedValue(created);

      await jurnalStokController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        data: created,
        message: "Jurnal Stok berhasil ditambahkan",
      });
    });

    test("2. [PAYLOAD] tenantID dari req.pengguna, bukan dari body", async () => {
      req.body.tenantID = "tenant-curang"; // FE mencoba inject tenantID
      jurnalStokService.create.mockResolvedValue({ _id: id() });

      await jurnalStokController.create(req, res, next);

      const [payload] = jurnalStokService.create.mock.calls[0];
      // Controller override tenantID dari pengguna session
      expect(payload.tenantID).toBe(req.pengguna.tenantID);
    });

    test("3. [PAYLOAD] dicatatOleh dari userID jika body tidak ada dicatatOleh", async () => {
      jurnalStokService.create.mockResolvedValue({ _id: id() });

      await jurnalStokController.create(req, res, next);

      const [payload] = jurnalStokService.create.mock.calls[0];
      expect(payload.dicatatOleh).toBe(req.pengguna._id);
    });

    test("4. [PAYLOAD] dicatatOleh dari body jika ada (override userID)", async () => {
      const customPencatat = id();
      req.body.dicatatOleh = customPencatat;
      jurnalStokService.create.mockResolvedValue({ _id: id() });

      await jurnalStokController.create(req, res, next);

      const [payload] = jurnalStokService.create.mock.calls[0];
      expect(payload.dicatatOleh).toBe(customPencatat);
    });

    test("5. [VALIDATION] Service return { error } → 400 + errors list", async () => {
      jurnalStokService.create.mockResolvedValue({ error: ["jumlah wajib diisi"] });

      await jurnalStokController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["jumlah wajib diisi"] });
      expect(next).not.toHaveBeenCalled();
    });

    test("6. [AUTH] Permission tidak ada → next(403)", async () => {
      req.pengguna.permissions = [];
      Permission.findOne.mockResolvedValue(null);

      await jurnalStokController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    test("7. [ERROR] Service throw → next(err)", async () => {
      jurnalStokService.create.mockRejectedValue(new Error("DB write failed"));

      await jurnalStokController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // update()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("update()", () => {
    beforeEach(() => {
      req.params.id = id();
      req.body = { jumlah: 20 };
    });

    test("1. [HAPPY] Berhasil → 200 + { data, message }", async () => {
      const updated = { _id: req.params.id, jumlah: 20 };
      jurnalStokService.update.mockResolvedValue(updated);

      await jurnalStokController.update(req, res, next);

      expect(jurnalStokService.update).toHaveBeenCalledWith(req.params.id, req.body, req.pengguna.tenantID);
      expect(res.json).toHaveBeenCalledWith({
        data: updated,
        message: "Jurnal Stok berhasil diperbarui",
      });
    });

    test("2. [NOT FOUND] Service return null → next(404)", async () => {
      jurnalStokService.update.mockResolvedValue(null);

      await jurnalStokController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    test("3. [VALIDATION] Service return { error } → 400", async () => {
      jurnalStokService.update.mockResolvedValue({ error: ["jumlah harus > 0"] });

      await jurnalStokController.update(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: ["jumlah harus > 0"] });
    });

    test("4. [AUTH] Permission tidak ada → next(403)", async () => {
      req.pengguna.permissions = [];
      Permission.findOne.mockResolvedValue(null);

      await jurnalStokController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(jurnalStokService.update).not.toHaveBeenCalled();
    });

    test("5. [ERROR] Service throw → next(err)", async () => {
      jurnalStokService.update.mockRejectedValue(new Error("Write conflict"));

      await jurnalStokController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test("6. [SECURITY] tenantID selalu dari session (tidak bisa di-override body)", async () => {
      req.body.tenantID = "hacker-tenant";
      jurnalStokService.update.mockResolvedValue({ _id: id() });

      await jurnalStokController.update(req, res, next);

      const [, , calledTenantID] = jurnalStokService.update.mock.calls[0];
      expect(calledTenantID).toBe(req.pengguna.tenantID);
      expect(calledTenantID).not.toBe("hacker-tenant");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // delete()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("delete()", () => {
    beforeEach(() => { req.params.id = id(); });

    test("1. [HAPPY] Berhasil → 200 + message", async () => {
      jurnalStokService.delete.mockResolvedValue(true);

      await jurnalStokController.delete(req, res, next);

      expect(jurnalStokService.delete).toHaveBeenCalledWith(req.params.id, req.pengguna.tenantID);
      expect(res.json).toHaveBeenCalledWith({ message: "Jurnal Stok berhasil dihapus" });
    });

    test("2. [NOT FOUND] Service return null → next(404)", async () => {
      jurnalStokService.delete.mockResolvedValue(null);

      await jurnalStokController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    test("3. [AUTH] Permission tidak ada → next(403)", async () => {
      req.pengguna.permissions = [];
      Permission.findOne.mockResolvedValue(null);

      await jurnalStokController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(jurnalStokService.delete).not.toHaveBeenCalled();
    });

    test("4. [SECURITY] Hanya hapus milik tenant sendiri", async () => {
      jurnalStokService.delete.mockResolvedValue(true);

      await jurnalStokController.delete(req, res, next);

      const [, calledTenantID] = jurnalStokService.delete.mock.calls[0];
      expect(calledTenantID).toBe(req.pengguna.tenantID);
    });

    test("5. [ERROR] Service throw → next(err)", async () => {
      jurnalStokService.delete.mockRejectedValue(new Error("Timeout"));

      await jurnalStokController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WMS — kirimBarang()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("kirimBarang()", () => {
    beforeEach(() => {
      req.body = { bahanBakuID: id(), dariLocationID: id(), qtyKirim: 10, noDokumen: "SJ-001" };
      validateWmsPayload.mockReturnValue({ valid: true });
    });

    test("1. [HAPPY] Berhasil → 201 + { data, message }", async () => {
      const result = { inventory: {}, jurnal: {} };
      jurnalStokService.kirimBarangJurnal.mockResolvedValue(result);

      await jurnalStokController.kirimBarang(req, res, next);

      expect(validateWmsPayload).toHaveBeenCalledWith("kirim", req.body);
      expect(jurnalStokService.kirimBarangJurnal).toHaveBeenCalledWith(
        req.body.bahanBakuID,
        req.body.dariLocationID,
        req.body.qtyKirim,
        req.body.noDokumen,
        req.pengguna.tenantID,
        req.pengguna._id
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: result }));
    });

    test("2. [VALIDATION] Payload invalid → 400 + errors, service tidak dipanggil", async () => {
      validateWmsPayload.mockReturnValue({ valid: false, errors: ["qtyKirim wajib"] });

      await jurnalStokController.kirimBarang(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors: ["qtyKirim wajib"] }));
      expect(jurnalStokService.kirimBarangJurnal).not.toHaveBeenCalled();
    });

    test("3. [ERROR] Service throw 400 (stok kurang) → next(err)", async () => {
      const err = Object.assign(new Error("Stok tidak mencukupi"), { status: 400 });
      jurnalStokService.kirimBarangJurnal.mockRejectedValue(err);

      await jurnalStokController.kirimBarang(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });

    test("4. [SECURITY] tenantID & dicatatOleh dari session, bukan body", async () => {
      req.body.tenantID    = "hacker-tenant";
      req.body.dicatatOleh = "hacker-user";
      jurnalStokService.kirimBarangJurnal.mockResolvedValue({});

      await jurnalStokController.kirimBarang(req, res, next);

      const args = jurnalStokService.kirimBarangJurnal.mock.calls[0];
      expect(args[4]).toBe(req.pengguna.tenantID);  // tenantID
      expect(args[5]).toBe(req.pengguna._id);        // dicatatOleh
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WMS — terimaBarang()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("terimaBarang()", () => {
    beforeEach(() => {
      req.body = { bahanBakuID: id(), keLocationID: id(), qtyTerima: 5, noDokumen: "SJ-001" };
      validateWmsPayload.mockReturnValue({ valid: true });
    });

    test("1. [HAPPY] Berhasil → 201", async () => {
      jurnalStokService.terimaBarangJurnal.mockResolvedValue({ inventory: {}, jurnal: {} });

      await jurnalStokController.terimaBarang(req, res, next);

      expect(validateWmsPayload).toHaveBeenCalledWith("terima", req.body);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("2. [VALIDATION] Payload invalid → 400, service tidak dipanggil", async () => {
      validateWmsPayload.mockReturnValue({ valid: false, errors: ["keLocationID wajib"] });

      await jurnalStokController.terimaBarang(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(jurnalStokService.terimaBarangJurnal).not.toHaveBeenCalled();
    });

    test("3. [ERROR] Service throw → next(err)", async () => {
      jurnalStokService.terimaBarangJurnal.mockRejectedValue(new Error("DB error"));

      await jurnalStokController.terimaBarang(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test("4. [PAYLOAD] Argumen dikirim ke service dalam urutan yang benar", async () => {
      jurnalStokService.terimaBarangJurnal.mockResolvedValue({});

      await jurnalStokController.terimaBarang(req, res, next);

      expect(jurnalStokService.terimaBarangJurnal).toHaveBeenCalledWith(
        req.body.bahanBakuID,
        req.body.keLocationID,
        req.body.qtyTerima,
        req.body.noDokumen,
        req.pengguna.tenantID,
        req.pengguna._id
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WMS — rollbackBarang()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("rollbackBarang()", () => {
    beforeEach(() => {
      req.body = { bahanBakuID: id(), dariLocationID: id(), qtyKirim: 10, noDokumen: "SJ-001" };
      validateWmsPayload.mockReturnValue({ valid: true });
    });

    test("1. [HAPPY] Berhasil → 201", async () => {
      jurnalStokService.rollbackBarangJurnal.mockResolvedValue({ inventory: {}, jurnal: {} });

      await jurnalStokController.rollbackBarang(req, res, next);

      expect(validateWmsPayload).toHaveBeenCalledWith("rollback", req.body);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("2. [VALIDATION] Payload invalid → 400", async () => {
      validateWmsPayload.mockReturnValue({ valid: false, errors: ["noDokumen wajib"] });

      await jurnalStokController.rollbackBarang(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(jurnalStokService.rollbackBarangJurnal).not.toHaveBeenCalled();
    });

    test("3. [ERROR] Service throw 404 (record tidak ada) → next(err)", async () => {
      const err = Object.assign(new Error("tidak ditemukan"), { status: 404 });
      jurnalStokService.rollbackBarangJurnal.mockRejectedValue(err);

      await jurnalStokController.rollbackBarang(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WMS — opnameBarang()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("opnameBarang()", () => {
    beforeEach(() => {
      req.body = { inventoryID: id(), fisikAktual: 80, catatan: "Opname Mei" };
      validateWmsPayload.mockReturnValue({ valid: true });
    });

    test("1. [HAPPY] Berhasil → 201 + pesan delta", async () => {
      const result = { inventory: {}, jurnal: {}, delta: -20 };
      jurnalStokService.opnameBarangJurnal.mockResolvedValue(result);

      await jurnalStokController.opnameBarang(req, res, next);

      expect(validateWmsPayload).toHaveBeenCalledWith("opname", req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining("-20"),
      }));
    });

    test("2. [HAPPY] delta positif → pesan tetap mengandung angka delta", async () => {
      jurnalStokService.opnameBarangJurnal.mockResolvedValue({ delta: 30 });

      await jurnalStokController.opnameBarang(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining("30"),
      }));
    });

    test("3. [VALIDATION] Payload invalid → 400", async () => {
      validateWmsPayload.mockReturnValue({ valid: false, errors: ["fisikAktual negatif"] });

      await jurnalStokController.opnameBarang(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(jurnalStokService.opnameBarangJurnal).not.toHaveBeenCalled();
    });

    test("4. [PAYLOAD] Argumen dikirim ke service dalam urutan yang benar", async () => {
      jurnalStokService.opnameBarangJurnal.mockResolvedValue({ delta: 0 });

      await jurnalStokController.opnameBarang(req, res, next);

      expect(jurnalStokService.opnameBarangJurnal).toHaveBeenCalledWith(
        req.body.inventoryID,
        req.body.fisikAktual,
        req.body.catatan,
        req.pengguna.tenantID,
        req.pengguna._id
      );
    });

    test("5. [ERROR] Service throw 404 → next(err)", async () => {
      const err = Object.assign(new Error("inventory tidak ditemukan"), { status: 404 });
      jurnalStokService.opnameBarangJurnal.mockRejectedValue(err);

      await jurnalStokController.opnameBarang(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });

    test("6. [EDGE] catatan undefined → tetap dikirim ke service (opsional)", async () => {
      req.body.catatan = undefined;
      jurnalStokService.opnameBarangJurnal.mockResolvedValue({ delta: 0 });

      await jurnalStokController.opnameBarang(req, res, next);

      const args = jurnalStokService.opnameBarangJurnal.mock.calls[0];
      expect(args[2]).toBeUndefined(); // catatan = undefined → valid
    });
  });
});
