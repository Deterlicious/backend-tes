const mongoose = require("mongoose");
const Tarif = require("../../../models/tarifModel");

describe("Unit Test — Model — Tarif", () => {
  const validData = {
    namaTarif: "Tarif Weekend",
    basisPerhitungan: "per jam",
    harga: 150000,
    durasiMinimum: 2,
    tenantID: new mongoose.Types.ObjectId(),
  };

  describe("Konfigurasi Skema & Default Value", () => {
    test("Sukses membuat instance valid dengan default value yang benar", async () => {
      const doc = new Tarif(validData);
      await doc.validate();

      // Pengecekan Default Values sesuai Schema
      expect(doc.isActive).toBe(false);
      expect(doc.hariAktif).toEqual([]);
      expect(doc.jamMulai).toBe("00:00");
      expect(doc.jamSelesai).toBe("23:59");
      expect(doc.prioritas).toBe(1);
      expect(doc.tipeAsetID).toEqual([]);
    });

    test("Harus mengaktifkan timestamps pada opsi Schema", () => {
      const schemaOptions = Tarif.schema.options;
      expect(schemaOptions.timestamps).toBe(true);
    });

    test("Harus melakukan trim pada field string (namaTarif, jamMulai, jamSelesai)", () => {
      const doc = new Tarif({
        ...validData,
        namaTarif: "   Tarif Spesial   ",
        jamMulai: "  08:00  ",
        jamSelesai: "  16:00  ",
      });

      expect(doc.namaTarif).toBe("Tarif Spesial");
      expect(doc.jamMulai).toBe("08:00");
      expect(doc.jamSelesai).toBe("16:00");
    });
  });

  describe("Validasi Field Wajib & Batasan Nilai (Min)", () => {
    test("Gagal validasi jika field wajib kosong", () => {
      const doc = new Tarif({});
      const err = doc.validateSync();

      expect(err.errors.namaTarif).toBeDefined();
      expect(err.errors.basisPerhitungan).toBeDefined();
      expect(err.errors.harga).toBeDefined();
      expect(err.errors.durasiMinimum).toBeDefined();
      expect(err.errors.tenantID).toBeDefined();
    });

    test("Gagal validasi jika harga bernilai negatif (di bawah min 0)", () => {
      const doc = new Tarif({
        ...validData,
        harga: -50000,
      });

      const err = doc.validateSync();
      expect(err.errors.harga).toBeDefined();
      expect(err.errors.harga.message).toMatch(/min/i);
    });

    test("Gagal validasi jika durasiMinimum kurang dari 1", () => {
      const doc = new Tarif({
        ...validData,
        durasiMinimum: 0,
      });

      const err = doc.validateSync();
      expect(err.errors.durasiMinimum).toBeDefined();
      expect(err.errors.durasiMinimum.message).toMatch(/min/i);
    });
  });

  describe("Validasi Enum", () => {
    test("Gagal validasi jika basisPerhitungan di luar pilihan enum", () => {
      const doc = new Tarif({
        ...validData,
        basisPerhitungan: "per bulan", // Hanya boleh "per jam" atau "per sesi"
      });

      const err = doc.validateSync();
      expect(err.errors.basisPerhitungan).toBeDefined();
    });

    test("Gagal validasi jika array hariAktif berisi angka di luar 0-6 (Enum Hari)", () => {
      const doc = new Tarif({
        ...validData,
        hariAktif: [1, 3, 7], // Angka 7 tidak valid (format hari JS 0=Minggu, 6=Sabtu)
      });

      const err = doc.validateSync();

      // Mongoose biasanya melacak error array pada index spesifiknya, contoh: 'hariAktif.2'
      const hasEnumError = Object.keys(err.errors).some((key) =>
        key.includes("hariAktif"),
      );
      expect(hasEnumError).toBe(true);
    });

    test("Sukses memvalidasi array hariAktif jika diisi rentang 0-6", async () => {
      const doc = new Tarif({
        ...validData,
        hariAktif: [0, 6], // Minggu dan Sabtu
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined(); // Lolos validasi
      expect(doc.hariAktif).toHaveLength(2);
    });
  });
});
