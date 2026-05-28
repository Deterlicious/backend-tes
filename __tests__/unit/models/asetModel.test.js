const mongoose = require("mongoose");
const Aset = require("../../../models/asetModel");

describe("Unit Test — Model — Aset", () => {
  const validData = {
    tenantID: new mongoose.Types.ObjectId(),
    namaAset: "Lapangan 1",
    tipeAsetID: new mongoose.Types.ObjectId(),
  };

  describe("Konfigurasi Skema & Default Value", () => {
    test("Sukses membuat instance valid dan memastikan default value 'status' adalah 'tersedia'", async () => {
      const doc = new Aset(validData);
      const err = doc.validateSync();

      expect(err).toBeUndefined(); // Lolos validasi
      expect(doc.status).toBe("tersedia"); // Mengecek default value
    });

    test("Harus melakukan trim (menghapus spasi berlebih) pada field namaAset", () => {
      const doc = new Aset({
        ...validData,
        namaAset: "   Meja Billiard VIP   ",
      });

      expect(doc.namaAset).toBe("Meja Billiard VIP");
    });

    test("Memastikan opsi Schema (timestamps & versionKey) dikonfigurasi dengan benar", () => {
      const schemaOptions = Aset.schema.options;

      expect(schemaOptions.timestamps).toBe(true);
      expect(schemaOptions.versionKey).toBe(false);
    });
  });

  describe("Validasi Field Wajib (Required)", () => {
    test("Gagal validasi jika field wajib (tenantID, namaAset, tipeAsetID) kosong", () => {
      const doc = new Aset({});
      const err = doc.validateSync();

      expect(err.errors.tenantID).toBeDefined();
      expect(err.errors.namaAset).toBeDefined();
      expect(err.errors.tipeAsetID).toBeDefined();
    });

    test("Gagal validasi jika tipe data ObjectId tidak sesuai", () => {
      const doc = new Aset({
        ...validData,
        tenantID: "bukan-object-id", // Tipe data salah
      });

      const err = doc.validateSync();
      expect(err.errors.tenantID).toBeDefined();
      expect(err.errors.tenantID.name).toBe("CastError"); // Mongoose melempar CastError untuk ObjectId invalid
    });
  });

  describe("Validasi Enum (Status)", () => {
    test("Gagal validasi jika status diisi dengan nilai di luar pilihan Enum", () => {
      const doc = new Aset({
        ...validData,
        status: "rusak total", // Nilai di luar Enum
      });

      const err = doc.validateSync();
      expect(err.errors.status).toBeDefined();
      expect(err.errors.status.message).toMatch(/is not a valid enum value/i);
    });

    test("Sukses validasi jika status diisi dengan nilai yang sah ('digunakan' / 'perbaikan')", () => {
      const doc1 = new Aset({ ...validData, status: "digunakan" });
      const doc2 = new Aset({ ...validData, status: "perbaikan" });

      expect(doc1.validateSync()).toBeUndefined();
      expect(doc2.validateSync()).toBeUndefined();
    });
  });
});
