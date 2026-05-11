const mongoose = require("mongoose");
const TipeAset = require("../../../models/tipeAsetModel");

describe("Unit Test — Model — Tipe Aset", () => {
  const validData = {
    tenantID: new mongoose.Types.ObjectId(),
    namaTipeAset: "Lapangan Futsal",
  };

  describe("Konfigurasi Skema & Default Value", () => {
    test("Sukses membuat instance valid dengan default value", async () => {
      const doc = new TipeAset(validData);
      await doc.validate(); // Seharusnya tidak error

      // Mengecek apakah deskripsi bernilai default 'null' saat tidak diisi
      expect(doc.deskripsi).toBeNull();
    });

    test("Harus melakukan trim pada field namaTipeAset", () => {
      const doc = new TipeAset({
        ...validData,
        namaTipeAset: "   Ruang Meeting VIP   ",
      });

      expect(doc.namaTipeAset).toBe("Ruang Meeting VIP");
    });

    test("Memastikan opsi Schema (timestamps, versionKey, virtuals) dikonfigurasi dengan benar", () => {
      const schemaOptions = TipeAset.schema.options;

      expect(schemaOptions.timestamps).toBe(true);
      expect(schemaOptions.versionKey).toBe(false);

      // Memastikan virtual field ikut dikonversi saat menjadi JSON/Object
      expect(schemaOptions.toJSON.virtuals).toBe(true);
      expect(schemaOptions.toObject.virtuals).toBe(true);
    });
  });

  describe("Validasi Field Wajib", () => {
    test("Gagal validasi jika tenantID kosong", () => {
      const doc = new TipeAset({ namaTipeAset: "Meja Billiard" });
      const err = doc.validateSync();

      expect(err.errors.tenantID).toBeDefined();
    });

    test("Gagal validasi jika namaTipeAset kosong", () => {
      const doc = new TipeAset({ tenantID: validData.tenantID });
      const err = doc.validateSync();

      expect(err.errors.namaTipeAset).toBeDefined();
    });
  });

  describe("Konfigurasi Virtual Field (listTarif)", () => {
    test("Memastikan virtual field 'listTarif' dikonfigurasi untuk relasi ke Tarif secara One-to-Many", () => {
      const virtualListTarif = TipeAset.schema.virtuals.listTarif;

      expect(virtualListTarif).toBeDefined();
      expect(virtualListTarif.options.ref).toBe("Tarif");
      expect(virtualListTarif.options.localField).toBe("_id");
      expect(virtualListTarif.options.foreignField).toBe("tipeAsetID");
      expect(virtualListTarif.options.justOne).toBe(false); // One-to-Many (akan jadi array)
    });
  });
});
