const { validateTarifPayload } = require("../../../validators/tarifValidator");

const mongoose = require("mongoose");

describe("Unit Test — Validator — Tarif", () => {
  const validPayload = {
    tenantID: new mongoose.Types.ObjectId().toString(),
    namaTarif: "Tarif Reguler",
    basisPerhitungan: "per jam",
    harga: 50000,
    durasiMinimum: 1,
    jamMulai: "08:00",
    jamSelesai: "22:00",
    hariAktif: [1, 2, 3, 4, 5],
  };

  describe("Validasi Mode: Create (isUpdate = false)", () => {
    test("Sukses lolos validasi jika payload lengkap dan valid", () => {
      const result = validateTarifPayload(validPayload);
      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika field wajib kosong", () => {
      const result = validateTarifPayload({});

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/tenantID wajib diisi dan valid/i),
          expect.stringMatching(/namaTarif wajib diisi/i),
          expect.stringMatching(/basisPerhitungan wajib diisi/i),
          expect.stringMatching(/harga wajib diisi/i),
          expect.stringMatching(/durasiMinimum wajib diisi/i),
        ]),
      );
    });

    test("Gagal validasi jika tenantID formatnya bukan ObjectId yang valid", () => {
      const result = validateTarifPayload({
        ...validPayload,
        tenantID: "invalid-id",
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/tenantID wajib diisi dan valid/i);
    });
  });

  describe("Validasi Mode: Update (isUpdate = true)", () => {
    test("Sukses lolos validasi untuk update parsial (misal hanya ubah harga)", () => {
      const result = validateTarifPayload(
        {
          harga: 75000,
        },
        true,
      );

      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika field update yang dikirim tidak sesuai aturan", () => {
      const result = validateTarifPayload(
        {
          harga: -10, // Invalid
          basisPerhitungan: "per tahun", // Invalid enum
        },
        true,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Harga harus angka positif/i),
          expect.stringMatching(
            /basisPerhitungan harus 'per jam' atau 'per sesi'/i,
          ),
        ]),
      );
    });
  });

  describe("Validasi Logika Field Angka (Harga & Durasi)", () => {
    test("Gagal validasi jika harga bukan angka yang valid atau negatif", () => {
      const res1 = validateTarifPayload({ ...validPayload, harga: -5000 });
      const res2 = validateTarifPayload({
        ...validPayload,
        harga: "bukan angka",
      });

      expect(res1.valid).toBe(false);
      expect(res1.errors[0]).toMatch(/Harga harus angka positif/i);

      expect(res2.valid).toBe(false);
      expect(res2.errors[0]).toMatch(/Harga harus angka positif/i);
    });

    test("Sukses jika harga bernilai 0 (gratis)", () => {
      const result = validateTarifPayload({ ...validPayload, harga: 0 });
      expect(result.valid).toBe(true);
    });

    test("Gagal validasi jika durasiMinimum kurang dari 1 atau bukan angka", () => {
      const res1 = validateTarifPayload({ ...validPayload, durasiMinimum: 0 });
      expect(res1.valid).toBe(false);
      expect(res1.errors[0]).toMatch(/durasiMinimum harus angka minimal 1/i);
    });
  });

  describe("Validasi Enum & Array (hariAktif & basisPerhitungan)", () => {
    test("Gagal jika hariAktif dikirim bukan sebagai array", () => {
      const result = validateTarifPayload({
        ...validPayload,
        hariAktif: "Senin",
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/hariAktif harus berupa array/i);
    });

    test("Gagal jika hariAktif mengandung angka di luar 0-6", () => {
      const result = validateTarifPayload({
        ...validPayload,
        hariAktif: [0, 1, 7],
      }); // 7 invalid
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/hariAktif hanya boleh berisi angka 0/i);
    });

    test("Sukses jika hariAktif adalah array kosong (berlaku semua hari/default logic)", () => {
      const result = validateTarifPayload({ ...validPayload, hariAktif: [] });
      expect(result.valid).toBe(true);
    });
  });

  describe("Validasi Format dan Logika Waktu (jamMulai & jamSelesai)", () => {
    test("Gagal validasi jika format waktu tidak sesuai regex HH:mm", () => {
      const res1 = validateTarifPayload({ ...validPayload, jamMulai: "8:00" }); // Kurang leading zero
      const res2 = validateTarifPayload({
        ...validPayload,
        jamSelesai: "25:00",
      }); // Jam tidak valid (max 23)
      const res3 = validateTarifPayload({
        ...validPayload,
        jamSelesai: "12:60",
      }); // Menit tidak valid (max 59)

      expect(res1.valid).toBe(false);
      expect(res1.errors[0]).toMatch(/jamMulai harus format HH:mm/i);

      expect(res2.valid).toBe(false);
      expect(res2.errors[0]).toMatch(/jamSelesai harus format HH:mm/i);

      expect(res3.valid).toBe(false);
    });

    test("Gagal validasi jika jamMulai lebih besar dari jamSelesai (Logika Perbandingan)", () => {
      const result = validateTarifPayload({
        ...validPayload,
        jamMulai: "15:00",
        jamSelesai: "10:00", // Lebih kecil dari jam mulai
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(
        /jamMulai harus lebih awal dari jamSelesai/i,
      );
    });

    test("Gagal validasi jika jamMulai dan jamSelesai diatur pada waktu yang persis sama", () => {
      const result = validateTarifPayload({
        ...validPayload,
        jamMulai: "12:00",
        jamSelesai: "12:00",
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(
        /jamMulai harus lebih awal dari jamSelesai/i,
      );
    });
  });

  describe("Validasi tipeAsetID", () => {
    test("Gagal jika tipeAsetID berisi ID yang tidak valid", () => {
      const result = validateTarifPayload({
        ...validPayload,
        tipeAsetID: ["invalid-id"],
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/tipeAsetID tidak valid/i);
    });

    test("Sukses memvalidasi tipeAsetID yang dikirim sebagai string tunggal (bukan array)", () => {
      const validObjectId = new mongoose.Types.ObjectId().toString();
      const result = validateTarifPayload({
        ...validPayload,
        tipeAsetID: validObjectId, // Tidak dibungkus array
      });

      expect(result.valid).toBe(true);
    });
  });
});
