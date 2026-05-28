const {
  validatePembayaranPayload,
} = require("../../../validators/pembayaranValidator");

const mongoose = require("mongoose");

describe("Unit Test — Validator — Pembayaran", () => {
  const validPayload = {
    tenantID: new mongoose.Types.ObjectId().toString(),
    penjualanID: new mongoose.Types.ObjectId().toString(),
    metodePembayaranID: new mongoose.Types.ObjectId().toString(),
    akunKasID: new mongoose.Types.ObjectId().toString(),
    jumlahBayar: 234300, // Simulasi nominal dengan PPN
  };

  describe("Validasi Mode: Create (isUpdate = false)", () => {
    test("Sukses lolos validasi untuk payload lengkap dan valid", () => {
      const result = validatePembayaranPayload(validPayload);
      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika field wajib berbentuk ObjectId kosong atau formatnya invalid", () => {
      const result = validatePembayaranPayload({
        jumlahBayar: 150000,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/tenantID wajib diisi/i),
          expect.stringMatching(/penjualanID wajib diisi/i),
          expect.stringMatching(/metodePembayaranID wajib diisi/i),
          expect.stringMatching(/akunKasID wajib diisi/i),
        ]),
      );
    });

    test("Gagal validasi jika akunKasID dikirim dengan format string biasa (bukan ObjectId)", () => {
      const result = validatePembayaranPayload({
        ...validPayload,
        akunKasID: "bukan-object-id",
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/akunKasID wajib diisi dan valid/i);
    });
  });

  describe("Validasi Mode: Update (isUpdate = true)", () => {
    test("Sukses lolos validasi jika melakukan update parsial (contoh: hanya status)", () => {
      const result = validatePembayaranPayload(
        {
          status: "PAID",
        },
        true,
      );

      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika update mencoba mengubah akunKasID dengan format invalid", () => {
      const result = validatePembayaranPayload(
        {
          akunKasID: "invalid-id",
        },
        true,
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/akunKasID wajib diisi dan valid/i);
    });
  });

  describe("Validasi Logika jumlahBayar (Berlaku untuk Create & Update)", () => {
    test("Sukses lolos validasi jika jumlahBayar dikirim sebagai string angka", () => {
      const result = validatePembayaranPayload({
        ...validPayload,
        jumlahBayar: " 150000 ", // String dengan spasi
      });

      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika jumlahBayar bernilai negatif (Mode Create)", () => {
      const result = validatePembayaranPayload({
        ...validPayload,
        jumlahBayar: -500,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(
        /jumlahBayar wajib diisi dan tidak boleh negatif/i,
      );
    });

    test("Gagal validasi jika jumlahBayar bernilai negatif (Mode Update)", () => {
      const result = validatePembayaranPayload(
        {
          jumlahBayar: -500,
        },
        true,
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/jumlahBayar tidak valid/i);
    });

    test("Gagal validasi jika jumlahBayar dikirim dengan karakter non-angka (NaN)", () => {
      const result = validatePembayaranPayload({
        ...validPayload,
        jumlahBayar: "seratus ribu",
      });

      expect(result.valid).toBe(false);
    });
  });

  describe("Validasi Logika status", () => {
    test("Sukses lolos validasi jika status sesuai dengan pilihan Enum", () => {
      const result = validatePembayaranPayload({
        ...validPayload,
        status: "FAILED",
      });

      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika status di luar pilihan Enum", () => {
      const result = validatePembayaranPayload({
        ...validPayload,
        status: "REFUND",
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Status tidak valid/i);
    });
  });

  describe("Validasi Logika tanggalBayar", () => {
    test("Sukses lolos validasi jika tanggalBayar berisi format ISO string yang valid", () => {
      const result = validatePembayaranPayload({
        ...validPayload,
        tanggalBayar: "2026-05-15T10:00:00.000Z",
      });

      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika properti tanggalBayar ada tetapi bernilai null", () => {
      const result = validatePembayaranPayload({
        ...validPayload,
        tanggalBayar: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Format tanggal bayar tidak valid/i);
    });

    test("Gagal validasi jika properti tanggalBayar ada tetapi berupa string kosong", () => {
      const result = validatePembayaranPayload({
        ...validPayload,
        tanggalBayar: "",
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Format tanggal bayar tidak valid/i);
    });

    test("Gagal validasi jika tanggalBayar diisi dengan teks sembarangan (Invalid Date)", () => {
      const result = validatePembayaranPayload({
        ...validPayload,
        tanggalBayar: "bukan-tanggal",
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Format tanggal bayar tidak valid/i);
    });

    test("Sukses (Dilewati) jika tanggalBayar tidak disertakan sama sekali dalam payload", () => {
      const payloadWithoutDate = { ...validPayload };
      delete payloadWithoutDate.tanggalBayar;

      const result = validatePembayaranPayload(payloadWithoutDate);
      expect(result.valid).toBe(true);
    });
  });
});
