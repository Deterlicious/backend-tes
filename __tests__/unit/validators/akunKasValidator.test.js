const {
  validateAkunKasPayload,
} = require("../../../validators/akunKasValidator");
const mongoose = require("mongoose");

describe("Unit Test — Validator — Akun Kas", () => {
  const validTenantID = new mongoose.Types.ObjectId().toString();

  const validCreatePayload = {
    tenantID: validTenantID,
    namaAkun: "Kas Toko Utama",
    nomorAkun: "111-001",
    tipeAkun: "Kas Fisik",
  };

  describe("Mode Create (!isUpdate)", () => {
    test("Sukses (Valid) untuk payload yang lengkap dan sesuai aturan", () => {
      const result = validateAkunKasPayload(validCreatePayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("Gagal jika field wajib (tenantID, namaAkun, nomorAkun, tipeAkun) kosong atau tidak ada", () => {
      const result = validateAkunKasPayload({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("tenantID wajib diisi dan valid");
      expect(result.errors).toContain("namaAkun wajib diisi");
      expect(result.errors).toContain("nomorAkun wajib diisi");
      expect(result.errors).toContain("tipeAkun tidak valid");
    });

    test("Gagal jika tenantID memiliki format ObjectId yang tidak valid", () => {
      const result = validateAkunKasPayload({
        ...validCreatePayload,
        tenantID: "bukan-id-valid",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("tenantID wajib diisi dan valid");
    });

    test("Gagal jika namaAkun atau nomorAkun hanya berisi string kosong", () => {
      const result = validateAkunKasPayload({
        ...validCreatePayload,
        namaAkun: "",
        nomorAkun: "",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("namaAkun wajib diisi");
      expect(result.errors).toContain("nomorAkun wajib diisi");
    });

    test("Gagal jika tipeAkun diisi dengan nilai di luar Enum", () => {
      const result = validateAkunKasPayload({
        ...validCreatePayload,
        tipeAkun: "E-Wallet",
      });

      expect(result.valid).toBe(false);
      // Akan trigger dua error push karena pengecekan ganda di if (!isUpdate) dan if (data.tipeAkun)
      expect(result.errors).toContain("tipeAkun tidak valid");
    });
  });

  describe("Mode Update (isUpdate = true)", () => {
    test("Sukses (Valid) untuk payload kosong (update parsial opsional)", () => {
      const result = validateAkunKasPayload({}, true);
      expect(result.valid).toBe(true);
    });

    test("Sukses (Valid) untuk update dengan data yang valid", () => {
      const result = validateAkunKasPayload(
        {
          namaAkun: "Bank BCA",
          tipeAkun: "Rekening Bank",
          status: "aktif",
          saldo: 150000,
        },
        true,
      );

      expect(result.valid).toBe(true);
    });

    test("Gagal jika mengirim tipeAkun di luar Enum saat update", () => {
      const result = validateAkunKasPayload({ tipeAkun: "Asuransi" }, true);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("tipeAkun tidak valid");
    });
  });

  describe("Validasi Field Opsional/Umum (Status & Saldo)", () => {
    test("Gagal jika status di luar Enum ('aktif', 'non-aktif')", () => {
      const res1 = validateAkunKasPayload({
        ...validCreatePayload,
        status: "pending",
      });
      const res2 = validateAkunKasPayload({ status: "suspended" }, true);

      expect(res1.valid).toBe(false);
      expect(res1.errors).toContain("status tidak valid");

      expect(res2.valid).toBe(false);
      expect(res2.errors).toContain("status tidak valid");
    });

    test("Gagal jika saldo bukan tipe number (misal: string angka)", () => {
      const result = validateAkunKasPayload({
        ...validCreatePayload,
        saldo: "100000", // String
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "saldo harus berupa angka dan tidak boleh negatif",
      );
    });

    test("Gagal jika saldo bernilai negatif", () => {
      const result = validateAkunKasPayload({
        ...validCreatePayload,
        saldo: -500,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "saldo harus berupa angka dan tidak boleh negatif",
      );
    });
  });
});
