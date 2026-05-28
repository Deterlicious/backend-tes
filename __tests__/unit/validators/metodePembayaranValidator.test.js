const {
  validateMetodePembayaranPayload,
} = require("../../../validators/metodePembayaranValidator");

const mongoose = require("mongoose");

describe("Unit Test — Validator — MetodePembayaran", () => {
  const validPayload = {
    tenantID: new mongoose.Types.ObjectId().toString(),
    akunKasID: new mongoose.Types.ObjectId().toString(),
    namaPembayaran: "QRIS",
    kategori: "non-tunai",
  };

  describe("Validasi Format Payload Umum", () => {
    test("Sukses lolos validasi jika payload valid", () => {
      const result = validateMetodePembayaranPayload(validPayload);
      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika payload kosong ({})", () => {
      const result = validateMetodePembayaranPayload({});

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/tenantID/i),
          expect.stringMatching(/akunKasID/i),
          expect.stringMatching(/namaPembayaran/i),
        ]),
      );
    });

    test("Gagal validasi jika payload bernilai null, string, atau array (Edge Case Tipe Data)", () => {
      expect(validateMetodePembayaranPayload(null).valid).toBe(false);
      expect(validateMetodePembayaranPayload("string").valid).toBe(false);
      expect(validateMetodePembayaranPayload([]).valid).toBe(false);
    });

    test("Gagal validasi jika mendeteksi indikasi NoSQL Injection object", () => {
      const result = validateMetodePembayaranPayload({
        ...validPayload,
        tenantID: { $ne: null },
      });

      expect(result.valid).toBe(false);
    });
  });

  describe("Validasi Mode: Create (isUpdate = false)", () => {
    test("Gagal validasi jika format ObjectId untuk tenantID atau akunKasID tidak valid", () => {
      const result = validateMetodePembayaranPayload({
        ...validPayload,
        tenantID: "abc",
        akunKasID: "xyz",
      });

      expect(result.valid).toBe(false);
    });

    test("Gagal validasi jika kategori di luar pilihan yang sah", () => {
      const result = validateMetodePembayaranPayload({
        ...validPayload,
        kategori: "bitcoin",
      });

      expect(result.valid).toBe(false);
    });

    test("Gagal validasi jika namaPembayaran hanya berisi spasi whitespace", () => {
      const result = validateMetodePembayaranPayload({
        ...validPayload,
        namaPembayaran: "     ",
      });

      expect(result.valid).toBe(false);
    });
  });

  describe("Validasi Mode: Update (isUpdate = true)", () => {
    test("Sukses lolos validasi jika field wajib bersifat opsional saat update", () => {
      const result = validateMetodePembayaranPayload(
        {
          namaPembayaran: "Update",
        },
        true,
      );

      expect(result.valid).toBe(true);
    });

    test("Sukses lolos validasi update parsial (misal: hanya mengupdate isActive)", () => {
      const result = validateMetodePembayaranPayload({ isActive: false }, true);

      expect(result.valid).toBe(true);
    });
  });

  describe("Validasi Logika isAutomated (Xendit)", () => {
    test("Gagal validasi jika metode automated menggunakan kategori tunai", () => {
      const result = validateMetodePembayaranPayload({
        ...validPayload,
        kategori: "tunai",
        isAutomated: true,
        xenditChannelCode: "QRIS",
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(
        /tidak boleh menggunakan kategori tunai/i,
      );
    });

    test("Gagal validasi jika metode automated tidak menyertakan xenditChannelCode", () => {
      const result = validateMetodePembayaranPayload({
        ...validPayload,
        isAutomated: true,
        xenditChannelCode: "",
      });

      expect(result.valid).toBe(false);
    });

    test("Sukses lolos validasi logis (fallback ke false) jika isAutomated dikirim sebagai string 'true' (bukan strict boolean)", () => {
      const result = validateMetodePembayaranPayload({
        ...validPayload,
        isAutomated: "true", // Berupa string, sehingga data.isAutomated === true akan mengembalikan false
        xenditChannelCode: "QRIS",
      });

      // Karena dinilai sebagai non-automated oleh validator, maka validasi xenditChannelCode dilewati
      expect(result.valid).toBe(true);
    });
  });
});
