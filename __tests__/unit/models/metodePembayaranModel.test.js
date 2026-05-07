const mongoose = require("mongoose");
const MetodePembayaran = require("../../../models/metodePembayaranModel");

describe("Unit Test — Model — MetodePembayaran", () => {
  const validData = {
    tenantID: new mongoose.Types.ObjectId(),
    akunKasID: new mongoose.Types.ObjectId(),
    namaPembayaran: "QRIS",
    kategori: "non-tunai",
  };

  describe("Konfigurasi Skema & Default Value", () => {
    test("Sukses membuat instance valid dengan default value", async () => {
      const doc = new MetodePembayaran(validData);
      await doc.validate();

      expect(doc.isAutomated).toBe(false);
      expect(doc.isActive).toBe(true);
      expect(doc.xenditChannelCode).toBeNull();
    });

    test("Harus mengaktifkan timestamps dan menonaktifkan versionKey pada opsi Schema", () => {
      // Ambil opsi konfigurasi langsung dari Schema (Best practice untuk unit test tanpa koneksi DB)
      const schemaOptions = MetodePembayaran.schema.options;

      expect(schemaOptions.timestamps).toBe(true);
      expect(schemaOptions.versionKey).toBe(false);
    });

    test("Bisa secara eksplisit mengatur isActive menjadi false saat pembuatan", async () => {
      const doc = new MetodePembayaran({
        ...validData,
        isActive: false,
      });

      await doc.validate();
      expect(doc.isActive).toBe(false);
    });

    test("Harus melakukan trim pada field namaPembayaran", () => {
      const doc = new MetodePembayaran({
        ...validData,
        namaPembayaran: "   Transfer BCA   ",
      });
      expect(doc.namaPembayaran).toBe("Transfer BCA");
    });

    test("Harus melakukan trim pada field xenditChannelCode", () => {
      const doc = new MetodePembayaran({
        ...validData,
        isAutomated: true,
        xenditChannelCode: "   QRIS   ",
      });
      expect(doc.xenditChannelCode).toBe("QRIS");
    });
  });

  describe("Validasi Field Wajib & Enum", () => {
    test("Gagal validasi jika field wajib (tenantID, akunKasID, namaPembayaran, kategori) kosong", () => {
      const doc = new MetodePembayaran({});
      const err = doc.validateSync();

      expect(err.errors.tenantID).toBeDefined();
      expect(err.errors.akunKasID).toBeDefined();
      expect(err.errors.namaPembayaran).toBeDefined();
      expect(err.errors.kategori).toBeDefined();
    });

    test("Gagal validasi jika namaPembayaran hanya berisi string kosong", () => {
      const doc = new MetodePembayaran({
        ...validData,
        namaPembayaran: "",
      });

      const err = doc.validateSync();
      expect(err.errors.namaPembayaran).toBeDefined();
    });

    test("Gagal validasi jika kategori di luar pilihan enum", () => {
      const doc = new MetodePembayaran({
        ...validData,
        kategori: "crypto",
      });

      const err = doc.validateSync();
      expect(err.errors.kategori).toBeDefined();
    });

    test("Gagal validasi jika kategori menggunakan huruf besar (case sensitive)", () => {
      const doc = new MetodePembayaran({
        ...validData,
        kategori: "TUNAI",
      });

      const err = doc.validateSync();
      expect(err.errors.kategori).toBeDefined();
    });
  });

  describe("Pre-validate Hook (Logika isAutomated)", () => {
    test("Sukses jika isAutomated true, kategori non-tunai, dan memiliki channel code", async () => {
      const doc = new MetodePembayaran({
        ...validData,
        kategori: "non-tunai",
        isAutomated: true,
        xenditChannelCode: "QRIS",
      });

      await doc.validate();

      expect(doc.isAutomated).toBe(true);
      expect(doc.kategori).toBe("non-tunai");
      expect(doc.xenditChannelCode).toBe("QRIS");
    });

    test("Gagal validasi jika isAutomated true tetapi menggunakan kategori tunai", async () => {
      const doc = new MetodePembayaran({
        ...validData,
        kategori: "tunai",
        isAutomated: true,
        xenditChannelCode: "QRIS",
      });

      let err;
      try {
        await doc.validate();
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.errors.kategori).toBeDefined();
      expect(err.errors.kategori.message).toMatch(/non-tunai/i);
    });

    test("Gagal validasi jika isAutomated true tetapi xenditChannelCode kosong", async () => {
      const doc = new MetodePembayaran({
        ...validData,
        isAutomated: true,
        xenditChannelCode: "",
      });

      let err;
      try {
        await doc.validate();
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.errors.xenditChannelCode).toBeDefined();
      expect(err.errors.xenditChannelCode.message).toMatch(
        /xenditchannelcode wajib diisi/i,
      );
    });

    test("Gagal validasi jika xenditChannelCode hanya berisi spasi saat isAutomated true", async () => {
      const doc = new MetodePembayaran({
        ...validData,
        isAutomated: true,
        xenditChannelCode: "    ",
      });

      let err;
      try {
        await doc.validate();
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.errors.xenditChannelCode).toBeDefined();
      expect(err.errors.xenditChannelCode.message).toMatch(
        /xenditchannelcode wajib diisi/i,
      );
    });

    test("Harus otomatis mengubah xenditChannelCode menjadi null jika isAutomated false", async () => {
      const doc = new MetodePembayaran({
        ...validData,
        isAutomated: false,
        xenditChannelCode: "SHOULD_REMOVE",
      });

      await doc.validate();

      expect(doc.xenditChannelCode).toBeNull();
    });

    test("Harus tetap null jika isAutomated false dan xenditChannelCode tidak dikirim", async () => {
      const doc = new MetodePembayaran({
        ...validData,
        isAutomated: false,
      });

      await doc.validate();

      expect(doc.xenditChannelCode).toBeNull();
    });
  });
});
