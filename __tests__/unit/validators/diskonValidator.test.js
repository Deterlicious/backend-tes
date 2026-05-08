const {
  validateDiskonPayload,
} = require("../../../validators/diskonValidator");

const mongoose = require("mongoose");

describe("Unit Test — Validator — Diskon", () => {
  const validPayload = {
    tenantID: new mongoose.Types.ObjectId().toString(),
    namaDiskon: "Diskon 10.10",
    cakupan: "Global",
    tipe: "persen",
    nilai: 10,
  };

  describe("Validasi Mode: Create (isUpdate = false)", () => {
    test("Sukses lolos validasi jika payload lengkap dan valid", () => {
      const result = validateDiskonPayload(validPayload);
      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika field wajib (tenantID, namaDiskon, cakupan, tipe, nilai) kosong", () => {
      const result = validateDiskonPayload({});

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/tenantID wajib diisi/i),
          expect.stringMatching(/namaDiskon wajib diisi/i),
          expect.stringMatching(/cakupan diskon wajib diisi/i),
          expect.stringMatching(/tipe diskon tidak valid/i),
          expect.stringMatching(/nilai diskon wajib diisi/i),
        ]),
      );
    });

    test("Gagal validasi jika tenantID formatnya bukan ObjectId yang valid", () => {
      const result = validateDiskonPayload({
        ...validPayload,
        tenantID: "invalid-id",
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/tenantID wajib diisi dan valid/i);
    });

    test("Gagal validasi jika namaDiskon hanya berisi spasi kosong (whitespace)", () => {
      const result = validateDiskonPayload({
        ...validPayload,
        namaDiskon: "    ",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/namaDiskon wajib diisi/i),
        ]),
      );
    });

    test("Gagal validasi jika tipe atau cakupan di luar pilihan Enum", () => {
      const result = validateDiskonPayload({
        ...validPayload,
        tipe: "koin",
        cakupan: "Spesial",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/cakupan diskon wajib diisi/i),
          expect.stringMatching(/tipe diskon tidak valid/i),
        ]),
      );
    });
  });

  describe("Validasi Mode: Update (isUpdate = true)", () => {
    test("Sukses lolos validasi untuk update parsial (misal hanya ubah status dan bisaDigabung)", () => {
      const result = validateDiskonPayload(
        {
          status: "Non-Aktif",
          bisaDigabung: true,
        },
        true,
      );

      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika field opsional yang dikirim tidak valid bentuknya", () => {
      const result = validateDiskonPayload(
        {
          namaDiskon: "", // Tidak boleh string kosong jika dikirim
          cakupan: "Salah",
          bisaDigabung: "true", // Berupa string, seharusnya boolean
          status: "Pending", // Di luar Enum
        },
        true,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/namaDiskon tidak boleh kosong/i),
          expect.stringMatching(/cakupan diskon tidak valid/i),
          expect.stringMatching(/bisaDigabung harus boolean/i),
          expect.stringMatching(/status tidak valid/i),
        ]),
      );
    });
  });

  describe("Validasi Logika Kombinasi Tipe & Nilai", () => {
    test("Gagal validasi jika nilai diskon bernilai negatif", () => {
      const result = validateDiskonPayload({
        ...validPayload,
        nilai: -5,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/nilai diskon wajib diisi dan >= 0/i),
        ]),
      );
    });

    test("Gagal validasi jika tipe 'persen' dan nilai lebih dari 100", () => {
      const result = validateDiskonPayload({
        ...validPayload,
        tipe: "persen",
        nilai: 101,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Nilai diskon persen tidak boleh > 100/i),
        ]),
      );
    });

    test("Sukses lolos validasi jika tipe 'persen' dan nilai tepat 100", () => {
      const result = validateDiskonPayload({
        ...validPayload,
        tipe: "persen",
        nilai: 100,
      });

      expect(result.valid).toBe(true);
    });

    test("Sukses lolos validasi jika tipe 'nominal' dan nilai lebih dari 100", () => {
      const result = validateDiskonPayload({
        ...validPayload,
        tipe: "nominal",
        nilai: 50000,
      });

      expect(result.valid).toBe(true);
    });

    test("Sukses lolos validasi jika nilai diskon adalah 0", () => {
      const result = validateDiskonPayload({
        ...validPayload,
        nilai: 0,
      });

      expect(result.valid).toBe(true);
    });
  });
});
