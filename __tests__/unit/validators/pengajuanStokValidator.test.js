const mongoose = require("mongoose");
const {
  validatePengajuanStokPayload,
  VALID_STATUS,
} = require("../../../validators/pengajuanStokValidator");

// ─── ID Helper ────────────────────────────────────────────────────────────────
const id = () => new mongoose.Types.ObjectId().toString();
const INVALID_ID = "bukan-object-id";

// ─── Factory: Payload CREATE Valid ───────────────────────────────────────────
function createPayload(overrides = {}) {
  return {
    tenantID: id(),
    nomorPengajuan: "REQ-001",
    dariLocationID: id(),
    keLocationID: id(),
    dimintaOleh: id(),
    items: [{ bahanBakuID: id(), qtyRequest: 10 }],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe("pengajuanStokValidator — Unit Test", () => {

  // ── A: HAPPY PATH CREATE ──────────────────────────────────────────────────
  describe("A: Happy Path — CREATE valid", () => {
    test("A1: payload lengkap harus lolos dan return { valid: true }", () => {
      const result = validatePengajuanStokPayload(createPayload());
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("A2: qtyRequest desimal harus lolos", () => {
      const result = validatePengajuanStokPayload(createPayload({
        items: [{ bahanBakuID: id(), qtyRequest: 0.5 }],
      }));
      expect(result.valid).toBe(true);
    });
  });

  // ── B: REQUIRED FIELDS (CREATE) ───────────────────────────────────────────
  describe("B: Required Fields — CREATE", () => {
    const requiredFields = [
      "tenantID",
      "nomorPengajuan",
      "dariLocationID",
      "keLocationID",
      "dimintaOleh",
    ];

    requiredFields.forEach((field) => {
      test(`B: gagal jika '${field}' tidak diisi`, () => {
        const payload = createPayload();
        delete payload[field];
        const result = validatePengajuanStokPayload(payload);
        expect(result.valid).toBe(false);
      });
    });

    test("B: gagal jika 'items' undefined", () => {
      const result = validatePengajuanStokPayload(createPayload({ items: undefined }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("item"))).toBe(true);
    });
  });

  // ── C: OBJECTID VALIDATION (CREATE) ──────────────────────────────────────
  describe("C: Format ObjectId — CREATE", () => {
    test("C1: tenantID format salah harus gagal", () => {
      const result = validatePengajuanStokPayload(createPayload({ tenantID: INVALID_ID }));
      expect(result.valid).toBe(false);
    });

    test("C2: dariLocationID format salah harus gagal", () => {
      const result = validatePengajuanStokPayload(createPayload({ dariLocationID: INVALID_ID }));
      expect(result.valid).toBe(false);
    });

    test("C3: keLocationID format salah harus gagal", () => {
      const result = validatePengajuanStokPayload(createPayload({ keLocationID: INVALID_ID }));
      expect(result.valid).toBe(false);
    });

    test("C4: dimintaOleh format salah harus gagal", () => {
      const result = validatePengajuanStokPayload(createPayload({ dimintaOleh: INVALID_ID }));
      expect(result.valid).toBe(false);
    });
  });

  // ── D: ITEMS VALIDATION (CREATE) ─────────────────────────────────────────
  describe("D: Items Validation — CREATE", () => {
    test("D1: items array kosong harus gagal", () => {
      const result = validatePengajuanStokPayload(createPayload({ items: [] }));
      expect(result.valid).toBe(false);
    });

    test("D2: item tanpa bahanBakuID harus gagal", () => {
      const result = validatePengajuanStokPayload(createPayload({
        items: [{ qtyRequest: 5 }],
      }));
      expect(result.valid).toBe(false);
    });

    test("D3: qtyRequest = 0 harus gagal — harus positif", () => {
      const result = validatePengajuanStokPayload(createPayload({
        items: [{ bahanBakuID: id(), qtyRequest: 0 }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("positif"))).toBe(true);
    });

    test("D4: qtyRequest negatif harus gagal", () => {
      const result = validatePengajuanStokPayload(createPayload({
        items: [{ bahanBakuID: id(), qtyRequest: -5 }],
      }));
      expect(result.valid).toBe(false);
    });
  });

  // ── E: HAPPY PATH UPDATE ──────────────────────────────────────────────────
  describe("E: Happy Path — UPDATE valid", () => {
    test("E1: update nomorPengajuan harus lolos", () => {
      const result = validatePengajuanStokPayload({ nomorPengajuan: "REQ-002" }, true);
      expect(result.valid).toBe(true);
      expect(result.updates.nomorPengajuan).toBe("REQ-002");
    });

    test("E2: update status harus lolos", () => {
      const result = validatePengajuanStokPayload({ status: "APPROVED" }, true);
      expect(result.valid).toBe(true);
      expect(result.updates.status).toBe("APPROVED");
    });

    test("E3: update multi-field harus lolos", () => {
      const locId = id();
      const result = validatePengajuanStokPayload({
        status: "SUBMITTED",
        dariLocationID: locId,
      }, true);
      expect(result.valid).toBe(true);
      expect(result.updates.dariLocationID).toBe(locId);
    });
  });

  // ── F: FIELD WHITELISTING & BUGS (UPDATE) ────────────────────────────────
  describe("F: Field Whitelisting & Bug — UPDATE", () => {
    test("F1: update tenantID harus ditolak", () => {
      const result = validatePengajuanStokPayload({ tenantID: id() }, true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("tenantID"))).toBe(true);
    });

    test("F2: update transferStokID harus ditolak", () => {
      const result = validatePengajuanStokPayload({ transferStokID: id() }, true);
      expect(result.valid).toBe(false);
    });

    test("F3: field tidak dikenal ('harga') harus ditolak (Bug sudah diperbaiki)", () => {
      const result = validatePengajuanStokPayload({ harga: 50000 }, true);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("tidak dikenal"))).toBe(true);
    });
  });

  // ── G: STATUS ENUM (UPDATE) ──────────────────────────────────────────────
  describe("G: Status Enum — UPDATE", () => {
    test("G1: status tidak valid harus gagal", () => {
      const result = validatePengajuanStokPayload({ status: "PROSES" }, true);
      expect(result.valid).toBe(false);
    });

    test("G2: status lowercase harus gagal", () => {
      const result = validatePengajuanStokPayload({ status: "draft" }, true);
      expect(result.valid).toBe(false);
    });
  });

  // ── H: ITEMS VALIDATION & BUG (UPDATE) ───────────────────────────────────
  describe("H: Items Validation & Bug — UPDATE", () => {
    test("H1: qtyApproved valid harus lolos", () => {
      const result = validatePengajuanStokPayload({
        items: [{ bahanBakuID: id(), qtyApproved: 5 }]
      }, true);
      expect(result.valid).toBe(true);
    });

    test("H2: qtyApproved negatif harus gagal", () => {
      const result = validatePengajuanStokPayload({
        items: [{ bahanBakuID: id(), qtyApproved: -1 }]
      }, true);
      expect(result.valid).toBe(false);
    });

    test("H3: qtyApproved = 0 valid dan harus lolos", () => {
      const result = validatePengajuanStokPayload({
        items: [{ bahanBakuID: id(), qtyApproved: 0 }]
      }, true);
      expect(result.valid).toBe(true);
    });

    test("H4: qtyApproved dengan tipe boolean (falsy) harus gagal (Bug sudah diperbaiki)", () => {
      const result = validatePengajuanStokPayload({
        items: [{ bahanBakuID: id(), qtyApproved: false }]
      }, true);
      expect(result.valid).toBe(false);
    });

    test("H5: qtyApproved = 'nol' string harus gagal", () => {
      const result = validatePengajuanStokPayload({
        items: [{ bahanBakuID: id(), qtyApproved: "nol" }]
      }, true);
      expect(result.valid).toBe(false);
    });
  });

  // ── I: EXPORT ────────────────────────────────────────────────────────────
  describe("I: Export Variables", () => {
    test("I1: VALID_STATUS tersedia", () => {
      expect(VALID_STATUS).toBeDefined();
      expect(Array.isArray(VALID_STATUS)).toBe(true);
      expect(VALID_STATUS).toContain("APPROVED");
    });
  });
});
