const mongoose = require("mongoose");
const AkunKas = require("../../../models/akunKasModel");

describe("Unit Test — Model — Akun Kas", () => {
  const validTenantID = new mongoose.Types.ObjectId();

  const validData = {
    namaAkun: "Kas Toko Utama",
    tipeAkun: "Kas Fisik",
    nomorAkun: "111-001",
    tenantID: validTenantID,
  };

  describe("Konfigurasi Skema & Default Value", () => {
    test("Sukses membuat instance valid dan memastikan default value (saldo, status, keterangan)", () => {
      const doc = new AkunKas(validData);
      const err = doc.validateSync();

      expect(err).toBeUndefined(); // Lolos validasi

      // Pengecekan nilai default
      expect(doc.saldo).toBe(0);
      expect(doc.status).toBe("aktif");
      expect(doc.keterangan).toBeNull();
    });

    test("Memastikan opsi Schema (timestamps & versionKey) dikonfigurasi dengan benar", () => {
      const schemaOptions = AkunKas.schema.options;
      expect(schemaOptions.timestamps).toBe(true);
      expect(schemaOptions.versionKey).toBe(false);
    });

    test("Harus melakukan trim (menghapus spasi berlebih) pada namaAkun dan nomorAkun", () => {
      const doc = new AkunKas({
        ...validData,
        namaAkun: "   Bank BCA   ",
        nomorAkun: "   111-002   ",
      });

      expect(doc.namaAkun).toBe("Bank BCA");
      expect(doc.nomorAkun).toBe("111-002");
    });
  });

  describe("Validasi Field Wajib (Required) & Tipe Data", () => {
    test("Gagal validasi jika field wajib dikosongkan (namaAkun, tipeAkun, nomorAkun, tenantID)", () => {
      const doc = new AkunKas({});
      const err = doc.validateSync();

      expect(err.errors.namaAkun).toBeDefined();
      expect(err.errors.tipeAkun).toBeDefined();
      expect(err.errors.nomorAkun).toBeDefined();
      expect(err.errors.tenantID).toBeDefined();
    });

    test("Gagal validasi jika tenantID diisi dengan format ObjectId yang tidak valid (CastError)", () => {
      const doc = new AkunKas({
        ...validData,
        tenantID: "bukan-object-id-valid",
      });

      const err = doc.validateSync();
      expect(err.errors.tenantID.name).toBe("CastError");
    });
  });

  describe("Validasi Enum & Batasan Angka (Min)", () => {
    test("Gagal validasi jika tipeAkun diisi di luar Enum ('Kas Fisik', 'Rekening Bank')", () => {
      const doc = new AkunKas({
        ...validData,
        tipeAkun: "E-Wallet", // Invalid enum
      });

      const err = doc.validateSync();
      expect(err.errors.tipeAkun).toBeDefined();
      expect(err.errors.tipeAkun.message).toMatch(/is not a valid enum value/i);
    });

    test("Gagal validasi jika status diisi di luar Enum ('aktif', 'non-aktif')", () => {
      const doc = new AkunKas({
        ...validData,
        status: "suspended", // Invalid enum
      });

      const err = doc.validateSync();
      expect(err.errors.status).toBeDefined();
      expect(err.errors.status.message).toMatch(/is not a valid enum value/i);
    });

    test("Gagal validasi jika saldo bernilai negatif (kurang dari 0)", () => {
      const doc = new AkunKas({
        ...validData,
        saldo: -50000, // Invalid min
      });

      const err = doc.validateSync();
      expect(err.errors.saldo).toBeDefined();
      expect(err.errors.saldo.message).toMatch(/Saldo tidak boleh negatif/i);
    });
  });
});
