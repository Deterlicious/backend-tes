const mongoose = require("mongoose");
const {
  validateJurnalPayload,
  validateWmsPayload,
} = require("../../../validators/jurnalStokValidator");

const validId = () => new mongoose.Types.ObjectId().toString();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const baseCreate = (overrides = {}) => ({
  tenantID:    validId(),
  bahanBakuID: validId(),
  locationID:  validId(),
  tipeKoreksi: "Masuk",
  alasan:      "Transfer Gudang",
  jumlah:      10,
  tanggal:     new Date().toISOString(),
  ...overrides,
});

const baseUpdate = (overrides = {}) => ({
  tipeKoreksi: "Masuk",
  jumlah:      5,
  ...overrides,
});

const baseWms = {
  kirim: (ov = {}) => ({
    bahanBakuID:    validId(),
    dariLocationID: validId(),
    qtyKirim:       10,
    noDokumen:      "SJ-001",
    ...ov,
  }),
  terima: (ov = {}) => ({
    bahanBakuID:   validId(),
    keLocationID:  validId(),
    qtyTerima:     10,
    noDokumen:     "SJ-001",
    ...ov,
  }),
  rollback: (ov = {}) => ({
    bahanBakuID:    validId(),
    dariLocationID: validId(),
    qtyKirim:       10,
    noDokumen:      "SJ-001",
    ...ov,
  }),
  opname: (ov = {}) => ({
    inventoryID: validId(),
    fisikAktual: 50,
    ...ov,
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
describe("JurnalStok Validator — Unit Test", () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // validateJurnalPayload — CREATE (isUpdate = false)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("validateJurnalPayload() — CREATE", () => {

    test("1. [HAPPY] Payload lengkap dan valid → { valid: true }", () => {
      const result = validateJurnalPayload(baseCreate());
      expect(result.valid).toBe(true);
    });

    test("2. [HAPPY] alasan 'Lainnya' + keterangan terisi → valid", () => {
      const result = validateJurnalPayload(
        baseCreate({ alasan: "Lainnya", keterangan: "Selisih fisik" })
      );
      expect(result.valid).toBe(true);
    });

    // Field ID wajib
    const idFields = ["tenantID", "bahanBakuID", "locationID"];
    test.each(idFields)(
      "3. Field '%s' tidak ada → invalid",
      (field) => {
        const result = validateJurnalPayload(baseCreate({ [field]: undefined }));
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes(field))).toBe(true);
      }
    );

    test.each(idFields)(
      "4. Field '%s' bukan ObjectId valid → invalid",
      (field) => {
        const result = validateJurnalPayload(baseCreate({ [field]: "bukan-id" }));
        expect(result.valid).toBe(false);
      }
    );

    // tipeKoreksi
    test("5. tipeKoreksi tidak ada → invalid", () => {
      const result = validateJurnalPayload(baseCreate({ tipeKoreksi: undefined }));
      expect(result.valid).toBe(false);
    });

    test("6. tipeKoreksi nilai tidak dikenal ('Transfer') → invalid", () => {
      const result = validateJurnalPayload(baseCreate({ tipeKoreksi: "Transfer" }));
      expect(result.valid).toBe(false);
    });

    test("7. tipeKoreksi case-sensitive — 'masuk' → invalid", () => {
      const result = validateJurnalPayload(baseCreate({ tipeKoreksi: "masuk" }));
      expect(result.valid).toBe(false);
    });

    // alasan
    test("8. alasan tidak ada → invalid", () => {
      const result = validateJurnalPayload(baseCreate({ alasan: undefined }));
      expect(result.valid).toBe(false);
    });

    test("9. alasan nilai tidak dikenal → invalid", () => {
      const result = validateJurnalPayload(baseCreate({ alasan: "Koreksi Manual" }));
      expect(result.valid).toBe(false);
    });

    test("10. alasan 'Lainnya' tanpa keterangan → invalid", () => {
      const result = validateJurnalPayload(
        baseCreate({ alasan: "Lainnya", keterangan: undefined })
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("keterangan"))).toBe(true);
    });

    test("11. alasan 'Lainnya' + keterangan string spasi saja → invalid", () => {
      const result = validateJurnalPayload(
        baseCreate({ alasan: "Lainnya", keterangan: "   " })
      );
      expect(result.valid).toBe(false);
    });

    // jumlah
    test("12. jumlah tidak ada (undefined) → invalid", () => {
      const result = validateJurnalPayload(baseCreate({ jumlah: undefined }));
      expect(result.valid).toBe(false);
    });

    test("13. jumlah = 0 → invalid (harus > 0)", () => {
      const result = validateJurnalPayload(baseCreate({ jumlah: 0 }));
      expect(result.valid).toBe(false);
    });

    test("14. jumlah negatif → invalid", () => {
      const result = validateJurnalPayload(baseCreate({ jumlah: -5 }));
      expect(result.valid).toBe(false);
    });

    test("15. jumlah string angka ('10') → invalid (harus number)", () => {
      const result = validateJurnalPayload(baseCreate({ jumlah: "10" }));
      expect(result.valid).toBe(false);
    });

    test("16. jumlah desimal positif (0.5) → valid", () => {
      const result = validateJurnalPayload(baseCreate({ jumlah: 0.5 }));
      expect(result.valid).toBe(true);
    });

    // tanggal
    test("17. tanggal tidak ada → invalid", () => {
      const result = validateJurnalPayload(baseCreate({ tanggal: undefined }));
      expect(result.valid).toBe(false);
    });

    // Multiple errors
    test("18. [MULTI-ERROR] Beberapa field salah → semua error dikumpulkan sekaligus", () => {
      const result = validateJurnalPayload({
        tenantID:    "invalid",
        bahanBakuID: undefined,
        tipeKoreksi: "Invalid",
        jumlah:      -1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validateJurnalPayload — UPDATE (isUpdate = true)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("validateJurnalPayload() — UPDATE (isUpdate = true)", () => {

    test("1. [HAPPY] Payload partial valid (hanya ubah jumlah) → valid", () => {
      const result = validateJurnalPayload({ jumlah: 20 }, true);
      expect(result.valid).toBe(true);
    });

    test("2. [HAPPY] Payload kosong {} → valid (semua opsional di mode update)", () => {
      const result = validateJurnalPayload({}, true);
      expect(result.valid).toBe(true);
    });

    test("3. tenantID/bahanBakuID/locationID TIDAK divalidasi di mode update", () => {
      // Field-field ini hanya dicek saat create
      const result = validateJurnalPayload(
        { tenantID: "invalid", bahanBakuID: undefined },
        true
      );
      expect(result.valid).toBe(true);
    });

    test("4. jumlah jika diisi harus > 0 (validasi shared)", () => {
      const result = validateJurnalPayload({ jumlah: 0 }, true);
      expect(result.valid).toBe(false);
    });

    test("5. jumlah negatif → invalid meski mode update", () => {
      const result = validateJurnalPayload({ jumlah: -10 }, true);
      expect(result.valid).toBe(false);
    });

    test("6. tipeKoreksi jika diisi harus enum valid", () => {
      const result = validateJurnalPayload({ tipeKoreksi: "Dibatalkan" }, true);
      expect(result.valid).toBe(false);
    });

    test("7. alasan 'Lainnya' tanpa keterangan → invalid meski mode update", () => {
      const result = validateJurnalPayload(
        { alasan: "Lainnya", keterangan: "" },
        true
      );
      expect(result.valid).toBe(false);
    });

    test("8. [SECURITY] tenantID diisi dengan id valid tidak menambah error (diabaikan di update)", () => {
      const result = validateJurnalPayload(
        { tenantID: validId(), jumlah: 5, tipeKoreksi: "Masuk" },
        true
      );
      expect(result.valid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validateWmsPayload — KIRIM
  // ═══════════════════════════════════════════════════════════════════════════
  describe("validateWmsPayload() — action: kirim", () => {

    test("1. [HAPPY] Semua field valid → { valid: true }", () => {
      expect(validateWmsPayload("kirim", baseWms.kirim()).valid).toBe(true);
    });

    test("2. bahanBakuID tidak ada → invalid", () => {
      const r = validateWmsPayload("kirim", baseWms.kirim({ bahanBakuID: undefined }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.includes("bahanBakuID"))).toBe(true);
    });

    test("3. bahanBakuID bukan ObjectId → invalid", () => {
      expect(validateWmsPayload("kirim", baseWms.kirim({ bahanBakuID: "abc" })).valid).toBe(false);
    });

    test("4. dariLocationID tidak ada → invalid", () => {
      const r = validateWmsPayload("kirim", baseWms.kirim({ dariLocationID: undefined }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.includes("dariLocationID"))).toBe(true);
    });

    test("5. dariLocationID bukan ObjectId → invalid", () => {
      expect(validateWmsPayload("kirim", baseWms.kirim({ dariLocationID: "bukan-id" })).valid).toBe(false);
    });

    test("6. qtyKirim = 0 → invalid", () => {
      expect(validateWmsPayload("kirim", baseWms.kirim({ qtyKirim: 0 })).valid).toBe(false);
    });

    test("7. qtyKirim negatif → invalid", () => {
      expect(validateWmsPayload("kirim", baseWms.kirim({ qtyKirim: -5 })).valid).toBe(false);
    });

    test("8. qtyKirim string → invalid (harus number)", () => {
      expect(validateWmsPayload("kirim", baseWms.kirim({ qtyKirim: "10" })).valid).toBe(false);
    });

    test("9. qtyKirim desimal positif → valid", () => {
      expect(validateWmsPayload("kirim", baseWms.kirim({ qtyKirim: 0.5 })).valid).toBe(true);
    });

    test("10. noDokumen tidak ada → invalid", () => {
      const r = validateWmsPayload("kirim", baseWms.kirim({ noDokumen: undefined }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.includes("noDokumen"))).toBe(true);
    });

    test("11. noDokumen string spasi saja → invalid", () => {
      expect(validateWmsPayload("kirim", baseWms.kirim({ noDokumen: "   " })).valid).toBe(false);
    });

    test("12. noDokumen string kosong → invalid", () => {
      expect(validateWmsPayload("kirim", baseWms.kirim({ noDokumen: "" })).valid).toBe(false);
    });

    test("13. [MULTI] Beberapa field invalid → semua error dikumpulkan", () => {
      const r = validateWmsPayload("kirim", { bahanBakuID: undefined, dariLocationID: undefined, qtyKirim: 0 });
      expect(r.valid).toBe(false);
      expect(r.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validateWmsPayload — TERIMA
  // ═══════════════════════════════════════════════════════════════════════════
  describe("validateWmsPayload() — action: terima", () => {

    test("1. [HAPPY] Semua field valid → { valid: true }", () => {
      expect(validateWmsPayload("terima", baseWms.terima()).valid).toBe(true);
    });

    test("2. bahanBakuID tidak ada → invalid", () => {
      expect(validateWmsPayload("terima", baseWms.terima({ bahanBakuID: undefined })).valid).toBe(false);
    });

    test("3. keLocationID tidak ada → invalid", () => {
      const r = validateWmsPayload("terima", baseWms.terima({ keLocationID: undefined }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.includes("keLocationID"))).toBe(true);
    });

    test("4. keLocationID bukan ObjectId → invalid", () => {
      expect(validateWmsPayload("terima", baseWms.terima({ keLocationID: "xyz" })).valid).toBe(false);
    });

    test("5. qtyTerima = 0 → invalid", () => {
      expect(validateWmsPayload("terima", baseWms.terima({ qtyTerima: 0 })).valid).toBe(false);
    });

    test("6. qtyTerima negatif → invalid", () => {
      expect(validateWmsPayload("terima", baseWms.terima({ qtyTerima: -1 })).valid).toBe(false);
    });

    test("7. qtyTerima string → invalid", () => {
      expect(validateWmsPayload("terima", baseWms.terima({ qtyTerima: "10" })).valid).toBe(false);
    });

    test("8. noDokumen tidak ada → invalid", () => {
      expect(validateWmsPayload("terima", baseWms.terima({ noDokumen: undefined })).valid).toBe(false);
    });

    test("9. [ISOLATION] dariLocationID tidak divalidasi pada action terima", () => {
      // Terima hanya butuh keLocationID, bukan dariLocationID
      const r = validateWmsPayload("terima", baseWms.terima({ dariLocationID: "bukan-id" }));
      expect(r.valid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validateWmsPayload — ROLLBACK
  // ═══════════════════════════════════════════════════════════════════════════
  describe("validateWmsPayload() — action: rollback", () => {

    test("1. [HAPPY] Semua field valid → { valid: true }", () => {
      expect(validateWmsPayload("rollback", baseWms.rollback()).valid).toBe(true);
    });

    test("2. bahanBakuID tidak ada → invalid", () => {
      expect(validateWmsPayload("rollback", baseWms.rollback({ bahanBakuID: undefined })).valid).toBe(false);
    });

    test("3. dariLocationID tidak ada → invalid", () => {
      expect(validateWmsPayload("rollback", baseWms.rollback({ dariLocationID: undefined })).valid).toBe(false);
    });

    test("4. qtyKirim = 0 → invalid", () => {
      expect(validateWmsPayload("rollback", baseWms.rollback({ qtyKirim: 0 })).valid).toBe(false);
    });

    test("5. qtyKirim negatif → invalid", () => {
      expect(validateWmsPayload("rollback", baseWms.rollback({ qtyKirim: -99 })).valid).toBe(false);
    });

    test("6. noDokumen tidak ada → invalid", () => {
      expect(validateWmsPayload("rollback", baseWms.rollback({ noDokumen: undefined })).valid).toBe(false);
    });

    test("7. noDokumen hanya spasi → invalid", () => {
      expect(validateWmsPayload("rollback", baseWms.rollback({ noDokumen: "  " })).valid).toBe(false);
    });

    test("8. [ISOLATION] keLocationID tidak divalidasi pada action rollback", () => {
      const r = validateWmsPayload("rollback", baseWms.rollback({ keLocationID: "bukan-id" }));
      expect(r.valid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validateWmsPayload — OPNAME
  // ═══════════════════════════════════════════════════════════════════════════
  describe("validateWmsPayload() — action: opname", () => {

    test("1. [HAPPY] Semua field valid → { valid: true }", () => {
      expect(validateWmsPayload("opname", baseWms.opname()).valid).toBe(true);
    });

    test("2. [HAPPY] fisikAktual = 0 → valid (opname ke nol diperbolehkan)", () => {
      expect(validateWmsPayload("opname", baseWms.opname({ fisikAktual: 0 })).valid).toBe(true);
    });

    test("3. [HAPPY] bahanBakuID tidak diperlukan untuk opname → valid meski tidak ada", () => {
      const r = validateWmsPayload("opname", baseWms.opname({ bahanBakuID: undefined }));
      expect(r.valid).toBe(true);
    });

    test("4. inventoryID tidak ada → invalid", () => {
      const r = validateWmsPayload("opname", baseWms.opname({ inventoryID: undefined }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.includes("inventoryID"))).toBe(true);
    });

    test("5. inventoryID bukan ObjectId valid → invalid", () => {
      expect(validateWmsPayload("opname", baseWms.opname({ inventoryID: "invalid-id" })).valid).toBe(false);
    });

    test("6. fisikAktual tidak ada (undefined) → invalid", () => {
      expect(validateWmsPayload("opname", baseWms.opname({ fisikAktual: undefined })).valid).toBe(false);
    });

    test("7. fisikAktual negatif → invalid", () => {
      const r = validateWmsPayload("opname", baseWms.opname({ fisikAktual: -1 }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.includes("fisikAktual"))).toBe(true);
    });

    test("8. fisikAktual string angka → invalid (harus number)", () => {
      expect(validateWmsPayload("opname", baseWms.opname({ fisikAktual: "50" })).valid).toBe(false);
    });

    test("9. fisikAktual desimal positif → valid", () => {
      expect(validateWmsPayload("opname", baseWms.opname({ fisikAktual: 49.75 })).valid).toBe(true);
    });

    test("10. catatan tidak ada → tetap valid (opsional)", () => {
      const r = validateWmsPayload("opname", baseWms.opname({ catatan: undefined }));
      expect(r.valid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validateWmsPayload — ACTION TIDAK DIKENAL
  // ═══════════════════════════════════════════════════════════════════════════
  describe("validateWmsPayload() — action tidak dikenal", () => {

    test("1. Action 'hapus' → invalid dengan pesan action tidak dikenali", () => {
      const r = validateWmsPayload("hapus", baseWms.kirim());
      expect(r.valid).toBe(false);
      expect(r.errors[0]).toMatch(/tidak dikenali/i);
    });

    test("2. Action string kosong → invalid", () => {
      const r = validateWmsPayload("", {});
      expect(r.valid).toBe(false);
    });

    test("3. Action undefined → invalid", () => {
      const r = validateWmsPayload(undefined, {});
      expect(r.valid).toBe(false);
    });

    test("4. Action 'KIRIM' (uppercase) → invalid (case-sensitive)", () => {
      const r = validateWmsPayload("KIRIM", baseWms.kirim());
      expect(r.valid).toBe(false);
      expect(r.errors[0]).toMatch(/tidak dikenali/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN SHAPE
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Shape of return value", () => {

    test("Return valid selalu berupa { valid: true } tanpa property errors", () => {
      const result = validateJurnalPayload(baseCreate());
      expect(result).toEqual({ valid: true });
      expect(result.errors).toBeUndefined();
    });

    test("Return invalid selalu berupa { valid: false, errors: [...] }", () => {
      const result = validateJurnalPayload({});
      expect(result.valid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("Setiap error dalam array adalah string yang tidak kosong", () => {
      const result = validateJurnalPayload({});
      result.errors.forEach((e) => {
        expect(typeof e).toBe("string");
        expect(e.trim().length).toBeGreaterThan(0);
      });
    });
  });
});
