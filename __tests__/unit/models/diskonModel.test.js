const mongoose = require("mongoose");
const Diskon = require("../../../models/diskonModel");

describe("Unit Test — Model — Diskon", () => {
  const validData = {
    tenantID: new mongoose.Types.ObjectId(),
    namaDiskon: "Promo Lebaran",
    cakupan: "Global",
    tipe: "persen",
    nilai: 10,
  };

  describe("Konfigurasi Skema & Default Value", () => {
    test("Sukses membuat instance valid dengan default value", async () => {
      const doc = new Diskon(validData);
      await doc.validate();

      expect(doc.bisaDigabung).toBe(false);
      expect(doc.status).toBe("Aktif");
    });

    test("Harus mengaktifkan timestamps dan menonaktifkan versionKey pada opsi Schema", () => {
      const schemaOptions = Diskon.schema.options;

      expect(schemaOptions.timestamps).toBe(true);
      expect(schemaOptions.versionKey).toBe(false);
    });

    test("Harus melakukan trim pada field namaDiskon", () => {
      const doc = new Diskon({
        ...validData,
        namaDiskon: "   Promo Akhir Tahun   ",
      });

      expect(doc.namaDiskon).toBe("Promo Akhir Tahun");
    });
  });

  describe("Validasi Field Wajib & Enum", () => {
    test("Gagal validasi jika field wajib kosong", () => {
      const doc = new Diskon({});
      const err = doc.validateSync();

      expect(err.errors.tenantID).toBeDefined();
      expect(err.errors.namaDiskon).toBeDefined();
      expect(err.errors.cakupan).toBeDefined();
      expect(err.errors.tipe).toBeDefined();
      expect(err.errors.nilai).toBeDefined();
    });

    test("Gagal validasi jika cakupan di luar pilihan enum", () => {
      const doc = new Diskon({ ...validData, cakupan: "Spesial" });
      const err = doc.validateSync();
      expect(err.errors.cakupan).toBeDefined();
    });

    test("Gagal validasi jika tipe di luar pilihan enum", () => {
      const doc = new Diskon({ ...validData, tipe: "koin" });
      const err = doc.validateSync();
      expect(err.errors.tipe).toBeDefined();
    });

    test("Gagal validasi jika status di luar pilihan enum", () => {
      const doc = new Diskon({ ...validData, status: "Pending" });
      const err = doc.validateSync();
      expect(err.errors.status).toBeDefined();
    });
  });

  describe("Validasi Custom Logika: Nilai Diskon", () => {
    test("Gagal validasi jika nilai diskon bernilai negatif", () => {
      const doc = new Diskon({ ...validData, nilai: -5 });
      const err = doc.validateSync();

      expect(err.errors.nilai).toBeDefined();
      expect(err.errors.nilai.message).toMatch(
        /Nilai diskon tidak boleh negatif/i,
      );
    });

    test("Sukses validasi jika tipe 'persen' dan nilai tepat 100", async () => {
      const doc = new Diskon({ ...validData, tipe: "persen", nilai: 100 });
      const err = doc.validateSync();
      expect(err).toBeUndefined(); // Lolos validasi
    });

    test("Gagal validasi jika tipe 'persen' dan nilai lebih dari 100", () => {
      const doc = new Diskon({ ...validData, tipe: "persen", nilai: 101 });
      const err = doc.validateSync();

      expect(err.errors.nilai).toBeDefined();
      expect(err.errors.nilai.message).toMatch(
        /Diskon bertipe persen tidak boleh melebihi 100/i,
      );
    });

    test("Sukses validasi jika tipe 'nominal' dan nilai lebih dari 100", async () => {
      // Diskon nominal bebas nominalnya (contoh: potongan Rp 50.000)
      const doc = new Diskon({ ...validData, tipe: "nominal", nilai: 50000 });
      const err = doc.validateSync();

      expect(err).toBeUndefined(); // Lolos validasi
    });
  });
});
