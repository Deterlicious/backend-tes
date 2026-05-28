const { validateAsetPayload } = require("../../../validators/asetValidator");
const mongoose = require("mongoose");

describe("Unit Test — Validator — Aset", () => {
  const validTenantID = new mongoose.Types.ObjectId().toString();
  const validTipeAsetID = new mongoose.Types.ObjectId().toString();

  const validCreatePayload = {
    tenantID: validTenantID,
    namaAset: "Lapangan Tenis 1",
    tipeAsetID: validTipeAsetID,
  };

  describe("Validasi Mode: Create (isUpdate = false)", () => {
    test("Sukses lolos validasi jika payload lengkap dan valid", () => {
      const result = validateAsetPayload(validCreatePayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("Gagal validasi jika field wajib (tenantID, namaAset, tipeAsetID) kosong", () => {
      const result = validateAsetPayload({});

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/tenantID wajib diisi dan valid/i),
          expect.stringMatching(/namaAset wajib diisi/i),
          expect.stringMatching(/tipeAsetID wajib diisi dan valid/i),
        ]),
      );
    });

    test("Gagal validasi jika tenantID formatnya bukan ObjectId yang valid", () => {
      const result = validateAsetPayload({
        ...validCreatePayload,
        tenantID: "id-palsu-123",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("tenantID wajib diisi dan valid");
    });

    test("Gagal validasi jika tipeAsetID formatnya bukan ObjectId yang valid", () => {
      const result = validateAsetPayload({
        ...validCreatePayload,
        tipeAsetID: "id-tipe-palsu",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("tipeAsetID wajib diisi dan valid");
    });
  });

  describe("Validasi Mode: Update (isUpdate = true)", () => {
    test("Sukses lolos validasi untuk update parsial (hanya ubah namaAset)", () => {
      const result = validateAsetPayload(
        {
          namaAset: "Lapangan Tenis 2",
        },
        true,
      );

      expect(result.valid).toBe(true);
    });

    test("Sukses lolos validasi jika payload update kosong (tidak ada modifikasi)", () => {
      const result = validateAsetPayload({}, true);
      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika payload update menyertakan tipeAsetID yang tidak valid", () => {
      const result = validateAsetPayload(
        {
          tipeAsetID: "invalid-id",
        },
        true,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("tipeAsetID tidak valid");
    });
  });

  describe("Validasi Status (Enum)", () => {
    test("Sukses validasi jika status diisi dengan nilai yang valid ('tersedia', 'digunakan', 'perbaikan')", () => {
      const res1 = validateAsetPayload({
        ...validCreatePayload,
        status: "tersedia",
      });
      const res2 = validateAsetPayload({ status: "digunakan" }, true); // Test saat update
      const res3 = validateAsetPayload({ status: "perbaikan" }, true);

      expect(res1.valid).toBe(true);
      expect(res2.valid).toBe(true);
      expect(res3.valid).toBe(true);
    });

    test("Gagal validasi jika status diisi dengan nilai di luar Enum", () => {
      const result = validateAsetPayload({
        ...validCreatePayload,
        status: "rusak berat", // Tidak ada di array VALID_STATUS
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Status tidak valid/i);
    });
  });
});
