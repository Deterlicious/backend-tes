const {
  validateTipeAsetPayload,
} = require("../../../validators/tipeAsetValidator");

const mongoose = require("mongoose");

describe("Unit Test — Validator — Tipe Aset", () => {
  const validPayload = {
    tenantID: new mongoose.Types.ObjectId().toString(),
    namaTipeAset: "Ruangan VIP",
  };

  describe("Validasi Mode: Create (isUpdate = false)", () => {
    test("Sukses lolos validasi jika payload lengkap dan valid", () => {
      const result = validateTipeAsetPayload(validPayload);
      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika tenantID dan namaTipeAset tidak dikirim", () => {
      const result = validateTipeAsetPayload({});

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/tenantID wajib diisi dan valid/i),
          expect.stringMatching(/namaTipeAset wajib diisi/i),
        ]),
      );
    });

    test("Gagal validasi jika tenantID formatnya bukan ObjectId yang valid", () => {
      const result = validateTipeAsetPayload({
        ...validPayload,
        tenantID: "id-ngasal-123",
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/tenantID wajib diisi dan valid/i);
    });

    test("Gagal validasi jika namaTipeAset hanya berisi spasi (whitespace)", () => {
      const result = validateTipeAsetPayload({
        ...validPayload,
        namaTipeAset: "     ",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/namaTipeAset wajib diisi/i), // Dari blok !isUpdate
          expect.stringMatching(/namaTipeAset tidak boleh kosong/i), // Dari blok pengecekan umum
        ]),
      );
    });
  });

  describe("Validasi Mode: Update (isUpdate = true)", () => {
    test("Sukses lolos validasi untuk update parsial", () => {
      const result = validateTipeAsetPayload(
        {
          namaTipeAset: "Kamar Suite",
        },
        true,
      );

      expect(result.valid).toBe(true);
    });

    test("Sukses lolos validasi jika payload kosong saat update (tidak ada field yang diubah)", () => {
      const result = validateTipeAsetPayload({}, true);
      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika payload update mengirimkan namaTipeAset yang kosong", () => {
      const result = validateTipeAsetPayload(
        {
          namaTipeAset: "",
        },
        true,
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/namaTipeAset tidak boleh kosong/i);
    });
  });

  describe("Validasi Batasan Karakter (namaTipeAset)", () => {
    test("Gagal validasi jika namaTipeAset kurang dari 2 karakter", () => {
      const result = validateTipeAsetPayload({
        ...validPayload,
        namaTipeAset: "A",
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/namaTipeAset minimal 2 karakter/i);
    });

    test("Gagal validasi jika namaTipeAset kurang dari 2 karakter SETELAH di-trim", () => {
      const result = validateTipeAsetPayload({
        ...validPayload,
        namaTipeAset: " B ", // Panjang asli 3, tapi setelah trim jadi 1
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/namaTipeAset minimal 2 karakter/i);
    });

    test("Sukses validasi jika namaTipeAset tepat 2 karakter", () => {
      const result = validateTipeAsetPayload({
        ...validPayload,
        namaTipeAset: "PC",
      });

      expect(result.valid).toBe(true);
    });
  });
});
