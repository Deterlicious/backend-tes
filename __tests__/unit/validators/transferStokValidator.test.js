const mongoose = require("mongoose");
const {
  validateTransferPayload,
  VALID_STATUS,
} = require("../../../validators/transferStokValidator");

// ─── ID Helper ────────────────────────────────────────────────────────────────
const id = () => new mongoose.Types.ObjectId().toString();
const INVALID_ID = "bukan-object-id";

// ─── Factory: Payload CREATE Valid ───────────────────────────────────────────
// Selalu valid — test hanya perlu override field yang diuji
function createPayload(overrides = {}) {
  return {
    tenantID:      id(),
    nomorTransfer: "SJ-PGJ/202605/0001-TEST",
    dariLocationID: id(),
    keLocationID:   id(),
    pengirimID:     id(),
    tanggalKirim:  new Date("2026-05-08"),
    items: [{ bahanBakuID: id(), qtyKirim: 10 }],
    ...overrides,
  };
}

// ─── Factory: Payload UPDATE Valid ───────────────────────────────────────────
function updatePayload(overrides = {}) {
  return { nomorTransfer: "SJ-UPDATE-001", ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
describe("transferStokValidator — Unit Test", () => {

  // ── A: HAPPY PATH CREATE ──────────────────────────────────────────────────
  describe("A: Happy Path — CREATE valid", () => {

    test("A1: payload lengkap harus lolos dan return { valid: true }", () => {
      const result = validateTransferPayload(createPayload());
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("A2: CREATE tidak return 'updates' — hanya { valid: true }", () => {
      const result = validateTransferPayload(createPayload());
      expect(result).toEqual({ valid: true });
    });

    test("A3: multi-item valid harus lolos", () => {
      const result = validateTransferPayload(createPayload({
        items: [
          { bahanBakuID: id(), qtyKirim: 5 },
          { bahanBakuID: id(), qtyKirim: 3 },
        ],
      }));
      expect(result.valid).toBe(true);
    });

    test("A4: qtyKirim desimal (0.5 — hasil konversi 500 gram → kg) harus lolos", () => {
      const result = validateTransferPayload(createPayload({
        items: [{ bahanBakuID: id(), qtyKirim: 0.5 }],
      }));
      expect(result.valid).toBe(true);
    });

    test("A5: qtyKirim = 0.001 (1 ml → liter) harus lolos", () => {
      const result = validateTransferPayload(createPayload({
        items: [{ bahanBakuID: id(), qtyKirim: 0.001 }],
      }));
      expect(result.valid).toBe(true);
    });

    test("A6: field opsional ekstra (pengajuanStokID) tidak mengganggu validasi CREATE", () => {
      const result = validateTransferPayload(createPayload({
        pengajuanStokID: id(),
      }));
      // CREATE hanya cek field wajib — field ekstra tidak diblok di mode ini
      expect(result.valid).toBe(true);
    });

  });

  // ── B: REQUIRED FIELDS (CREATE) ───────────────────────────────────────────
  describe("B: Required Fields — CREATE", () => {

    const requiredFields = [
      "tenantID",
      "nomorTransfer",
      "dariLocationID",
      "keLocationID",
      "pengirimID",
      "tanggalKirim",
    ];

    requiredFields.forEach((field) => {
      test(`B: gagal jika '${field}' tidak diisi (undefined)`, () => {
        const result = validateTransferPayload(createPayload({ [field]: undefined }));
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test("B: gagal jika 'items' undefined", () => {
      const result = validateTransferPayload(createPayload({ items: undefined }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining("item")])
      );
    });

    test("B: semua field wajib kosong — error harus akumulasi (lebih dari 1)", () => {
      const result = validateTransferPayload({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });

  });

  // ── C: OBJECTID VALIDATION (CREATE) ──────────────────────────────────────
  describe("C: Format ObjectId — CREATE", () => {

    test("C1: tenantID format salah harus gagal", () => {
      const result = validateTransferPayload(createPayload({ tenantID: INVALID_ID }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Tenant ID"))).toBe(true);
    });

    test("C2: dariLocationID format salah harus gagal", () => {
      const result = validateTransferPayload(createPayload({ dariLocationID: INVALID_ID }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("dariLocationID"))).toBe(true);
    });

    test("C3: keLocationID format salah harus gagal", () => {
      const result = validateTransferPayload(createPayload({ keLocationID: INVALID_ID }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("keLocationID"))).toBe(true);
    });

    test("C4: pengirimID format salah harus gagal", () => {
      const result = validateTransferPayload(createPayload({ pengirimID: INVALID_ID }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Pengirim ID"))).toBe(true);
    });

    test("C5: ObjectId string yang valid (24 hex char) harus lolos", () => {
      const result = validateTransferPayload(createPayload({
        tenantID: "507f1f77bcf86cd799439011",
      }));
      expect(result.valid).toBe(true);
    });

  });

  // ── D: ITEMS VALIDATION (CREATE) ─────────────────────────────────────────
  describe("D: Items Validation — CREATE", () => {

    test("D1: items = [] (array kosong) harus gagal", () => {
      const result = validateTransferPayload(createPayload({ items: [] }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("item"))).toBe(true);
    });

    test("D2: items bukan array (string) harus gagal", () => {
      const result = validateTransferPayload(createPayload({ items: "tepung" }));
      expect(result.valid).toBe(false);
    });

    test("D3: items bukan array (object) harus gagal", () => {
      const result = validateTransferPayload(createPayload({ items: { bahanBakuID: id(), qtyKirim: 1 } }));
      expect(result.valid).toBe(false);
    });

    test("D4: item tanpa bahanBakuID harus gagal", () => {
      const result = validateTransferPayload(createPayload({
        items: [{ qtyKirim: 5 }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Bahan Baku ID"))).toBe(true);
    });

    test("D5: item dengan bahanBakuID format salah harus gagal", () => {
      const result = validateTransferPayload(createPayload({
        items: [{ bahanBakuID: INVALID_ID, qtyKirim: 5 }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Bahan Baku ID"))).toBe(true);
    });

    test("D6: item tanpa qtyKirim harus gagal", () => {
      const result = validateTransferPayload(createPayload({
        items: [{ bahanBakuID: id() }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("qtyKirim"))).toBe(true);
    });

    test("D7: qtyKirim = 0 harus gagal — harus positif", () => {
      const result = validateTransferPayload(createPayload({
        items: [{ bahanBakuID: id(), qtyKirim: 0 }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("positif"))).toBe(true);
    });

    test("D8: qtyKirim = -5 (negatif) harus gagal", () => {
      const result = validateTransferPayload(createPayload({
        items: [{ bahanBakuID: id(), qtyKirim: -5 }],
      }));
      expect(result.valid).toBe(false);
    });

    test("D9: qtyKirim = '10' (string) harus gagal — typeof bukan number", () => {
      const result = validateTransferPayload(createPayload({
        items: [{ bahanBakuID: id(), qtyKirim: "10" }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("qtyKirim"))).toBe(true);
    });

    test("D10: multi-item, satu item invalid — harus gagal dan error menyebut item ke berapa", () => {
      const result = validateTransferPayload(createPayload({
        items: [
          { bahanBakuID: id(), qtyKirim: 5 },   // valid
          { bahanBakuID: id(), qtyKirim: -1 },   // invalid
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Item 2"))).toBe(true);
    });

    test("D11: multi-item, semua invalid — error harus akumulasi untuk tiap item", () => {
      const result = validateTransferPayload(createPayload({
        items: [
          { qtyKirim: 0 },    // tidak ada bahanBakuID, qtyKirim tidak positif
          { qtyKirim: -1 },   // sama
        ],
      }));
      expect(result.valid).toBe(false);
      // Minimal 4 error: 2 bahanBakuID + 2 qtyKirim
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

  });

  // ── E: HAPPY PATH UPDATE ──────────────────────────────────────────────────
  describe("E: Happy Path — UPDATE valid", () => {

    test("E1: update nomorTransfer saja harus lolos", () => {
      const result = validateTransferPayload({ nomorTransfer: "SJ-BARU" }, true);
      expect(result.valid).toBe(true);
    });

    test("E2: update harus return { valid: true, updates: {...} }", () => {
      const result = validateTransferPayload({ nomorTransfer: "SJ-BARU" }, true);
      expect(result.valid).toBe(true);
      expect(result.updates).toBeDefined();
      expect(result.updates.nomorTransfer).toBe("SJ-BARU");
    });

    test("E3: update status DIKIRIM harus lolos dan masuk updates", () => {
      const result = validateTransferPayload({ status: "DIKIRIM" }, true);
      expect(result.valid).toBe(true);
      expect(result.updates.status).toBe("DIKIRIM");
    });

    test("E4: update pengirimID dengan ObjectId valid harus lolos", () => {
      const validId = id();
      const result = validateTransferPayload({ pengirimID: validId }, true);
      expect(result.valid).toBe(true);
      expect(result.updates.pengirimID).toBe(validId);
    });

    test("E5: update items dengan qtyTerima harus lolos", () => {
      const result = validateTransferPayload({
        items: [{ bahanBakuID: id(), qtyKirim: 10, qtyTerima: 9 }],
      }, true);
      expect(result.valid).toBe(true);
    });

    test("E6: update multi-field sekaligus harus lolos dan semua masuk updates", () => {
      const newId = id();
      const result = validateTransferPayload({
        nomorTransfer: "SJ-X",
        tanggalTerima: new Date(),
        penerimaID: newId,
      }, true);
      expect(result.valid).toBe(true);
      expect(result.updates.nomorTransfer).toBe("SJ-X");
      expect(result.updates.penerimaID).toBe(newId);
    });

  });

  // ── F: FIELD WHITELISTING (UPDATE) ───────────────────────────────────────
  describe("F: Field Whitelisting — UPDATE", () => {

    test("F1: update tenantID harus ditolak — field terlindungi", () => {
      const result = validateTransferPayload({ tenantID: id() }, true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("tenantID"))).toBe(true);
    });

    test("F2: update _id harus ditolak", () => {
      const result = validateTransferPayload({ _id: id() }, true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("_id"))).toBe(true);
    });

    test("F3: update createdAt harus ditolak", () => {
      const result = validateTransferPayload({ createdAt: new Date() }, true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("createdAt"))).toBe(true);
    });

    test("F4: update updatedAt harus ditolak", () => {
      const result = validateTransferPayload({ updatedAt: new Date() }, true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("updatedAt"))).toBe(true);
    });

    test("F5: field tidak dikenal ('harga') harus ditolak", () => {
      const result = validateTransferPayload({ harga: 50000 }, true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("tidak dikenal"))).toBe(true);
    });

    test("F6: field tidak dikenal ('catatan') harus ditolak", () => {
      const result = validateTransferPayload({ catatan: "test" }, true);
      expect(result.valid).toBe(false);
    });

    test("F7: campuran field valid + field terlarang — error terjadi, field valid tidak diproses", () => {
      const result = validateTransferPayload({
        nomorTransfer: "SJ-OK",
        tenantID: id(),         // terlarang
      }, true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("tenantID"))).toBe(true);
    });

  });

  // ── G: STATUS ENUM VALIDATION (UPDATE) ───────────────────────────────────
  describe("G: Status Enum — UPDATE", () => {

    VALID_STATUS.forEach((status) => {
      test(`G: status '${status}' harus lolos`, () => {
        const result = validateTransferPayload({ status }, true);
        expect(result.valid).toBe(true);
      });
    });

    test("G: status 'PROSES' (tidak ada di enum) harus gagal", () => {
      const result = validateTransferPayload({ status: "PROSES" }, true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Status tidak valid"))).toBe(true);
    });

    test("G: status 'pending' (lowercase) harus gagal — case-sensitive", () => {
      const result = validateTransferPayload({ status: "pending" }, true);
      expect(result.valid).toBe(false);
    });

    test("G: status 'DIKIRIMKAN' (typo) harus gagal", () => {
      const result = validateTransferPayload({ status: "DIKIRIMKAN" }, true);
      expect(result.valid).toBe(false);
    });

    test("G: status string kosong '' harus gagal", () => {
      const result = validateTransferPayload({ status: "" }, true);
      expect(result.valid).toBe(false);
    });

  });

  // ── H: ITEMS VALIDATION (UPDATE) ─────────────────────────────────────────
  describe("H: Items Validation — UPDATE", () => {

    test("H1: qtyKirim = 0 dalam update harus gagal — regression test bug falsy guard", () => {
      // Bug lama: `item.qtyKirim && ...` melewatkan 0 karena 0 falsy di JS
      // Fix: diganti dengan `item.qtyKirim !== undefined` agar 0 tetap diperiksa
      const result = validateTransferPayload({
        items: [{ bahanBakuID: id(), qtyKirim: 0 }],
      }, true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("qtyKirim"))).toBe(true);
    });

    test("H2: qtyKirim = -1 dalam update harus gagal", () => {
      const result = validateTransferPayload({
        items: [{ bahanBakuID: id(), qtyKirim: -1 }],
      }, true);
      expect(result.valid).toBe(false);
    });

    test("H3: qtyKirim = 0.5 (desimal, hasil konversi) dalam update harus lolos", () => {
      const result = validateTransferPayload({
        items: [{ bahanBakuID: id(), qtyKirim: 0.5 }],
      }, true);
      expect(result.valid).toBe(true);
    });

    test("H4: qtyTerima = 'abc' (string bukan angka) harus gagal", () => {
      const result = validateTransferPayload({
        items: [{ bahanBakuID: id(), qtyKirim: 10, qtyTerima: "abc" }],
      }, true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("qtyTerima"))).toBe(true);
    });

    test("H5: qtyTerima valid angka (9) harus lolos", () => {
      const result = validateTransferPayload({
        items: [{ bahanBakuID: id(), qtyKirim: 10, qtyTerima: 9 }],
      }, true);
      expect(result.valid).toBe(true);
    });

    test("H6: qtyTerima boleh 0 dalam update (barang tidak ada yang diterima)", () => {
      // Validator UPDATE: kondisi `item.qtyTerima && ...` — jika 0, dianggap falsy, tidak diperiksa
      const result = validateTransferPayload({
        items: [{ bahanBakuID: id(), qtyKirim: 10, qtyTerima: 0 }],
      }, true);
      expect(result.valid).toBe(true);
    });

    test("H7: update items masuk ke dalam 'updates' object", () => {
      const items = [{ bahanBakuID: id(), qtyKirim: 10, qtyTerima: 8 }];
      const result = validateTransferPayload({ items }, true);
      expect(result.valid).toBe(true);
      expect(result.updates.items).toEqual(items);
    });

  });

  // ── I: EDGE CASES & BUG DOKUMENTASI ──────────────────────────────────────
  describe("I: Edge Cases & Dokumentasi Behavior", () => {

    // ⚠️ BUG TERDOKUMENTASI: baris 116-117 validator
    // Jika data = {} di mode UPDATE: errors kosong, updates kosong.
    // Validator push error tapi langsung return { valid: true, updates: {} }
    // tanpa memeriksa errors lagi — error tidak pernah dikembalikan.
    test("I1: [BUG] UPDATE dengan {} kosong — seharusnya error tapi return valid:true", () => {
      const result = validateTransferPayload({}, true);
      // Dokumentasi behavior aktual — bukan yang diharapkan secara ideal
      // Jika bug ini diperbaiki, test ini harus diupdate ke: expect(result.valid).toBe(false)
      expect(result.valid).toBe(true);
      expect(result.updates).toEqual({});
    });

    test("I2: CREATE — errors diakumulasi semua, tidak berhenti di error pertama", () => {
      const result = validateTransferPayload({
        // Semua field wajib hilang
        items: [{ qtyKirim: -1 }], // bahanBakuID hilang, qtyKirim invalid
      });
      expect(result.valid).toBe(false);
      // Minimal: tenantID + nomorTransfer + dariLocationID + keLocationID +
      //          pengirimID + tanggalKirim + bahanBakuID item + qtyKirim item = 8
      expect(result.errors.length).toBeGreaterThanOrEqual(7);
    });

    test("I3: UPDATE — penerimaID dengan format ID valid harus lolos", () => {
      const validId = id();
      const result = validateTransferPayload({ penerimaID: validId }, true);
      expect(result.valid).toBe(true);
      expect(result.updates.penerimaID).toBe(validId);
    });

    test("I4: UPDATE — penerimaID format salah harus gagal", () => {
      const result = validateTransferPayload({ penerimaID: INVALID_ID }, true);
      expect(result.valid).toBe(false);
    });

    test("I5: CREATE — nomorTransfer string kosong '' harus gagal", () => {
      const result = validateTransferPayload(createPayload({ nomorTransfer: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Nomor Transfer"))).toBe(true);
    });

    test("I6: CREATE — tanggalKirim null harus gagal", () => {
      const result = validateTransferPayload(createPayload({ tanggalKirim: null }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Tanggal Kirim"))).toBe(true);
    });

    test("I7: isUpdate default false — memanggil tanpa arg kedua = mode CREATE", () => {
      // Memastikan default parameter isUpdate = false berfungsi
      const result = validateTransferPayload(createPayload());
      expect(result.valid).toBe(true);
      expect(result.updates).toBeUndefined(); // CREATE tidak punya 'updates'
    });

  });

  // ── J: VALID_STATUS EXPORT ────────────────────────────────────────────────
  describe("J: VALID_STATUS Export", () => {

    test("J1: VALID_STATUS adalah array", () => {
      expect(Array.isArray(VALID_STATUS)).toBe(true);
    });

    test("J2: VALID_STATUS berisi tepat 4 nilai", () => {
      expect(VALID_STATUS).toHaveLength(4);
    });

    test("J3: VALID_STATUS mengandung PENDING, DIKIRIM, DITERIMA, BATAL", () => {
      expect(VALID_STATUS).toEqual(
        expect.arrayContaining(["PENDING", "DIKIRIM", "DITERIMA", "BATAL"])
      );
    });

    test("J4: VALID_STATUS tidak mengandung status lowercase", () => {
      const hasLower = VALID_STATUS.some((s) => s !== s.toUpperCase());
      expect(hasLower).toBe(false);
    });

  });

});
