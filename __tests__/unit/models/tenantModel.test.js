const mongoose = require("mongoose");
const Tenant = require("../../../models/tenantModel");

describe("Unit Test Tenant Model", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Validasi Skema & Nilai Default", () => {
    test("harus lolos validasi dan menyuntikkan semua nilai default jika hanya namaToko yang diisi", () => {
      const tenant = new Tenant({ namaToko: "Toko Sinar Jaya" });
      const error = tenant.validateSync();

      expect(error).toBeUndefined(); // Lolos validasi tanpa error

      // Pastikan nilai default teraplikasikan dengan presisi
      expect(tenant.namaToko).toBe("Toko Sinar Jaya");
      expect(tenant.status).toBe("aktif");
      expect(tenant.persenPajak).toBe(0);
      expect(tenant.tipePajak).toBe("Sudah Termasuk (Inclusive)");
      expect(tenant.isSetupComplete).toBe(false);
      
      // Pastikan field lain default ke null sesuai skema
      expect(tenant.alamat).toBeNull();
      expect(tenant.emailBisnis).toBeNull();
      expect(tenant.idNPWP).toBeNull();
    });

    test("harus melempar error validasi jika field wajib (namaToko) kosong", () => {
      const tenant = new Tenant({}); // Kosong melompong
      const error = tenant.validateSync();

      expect(error.errors.namaToko).toBeDefined();
      expect(error.errors.namaToko.message).toMatch(/required/i);
    });
  });

  describe("Validasi Enum", () => {
    test("harus melempar error validasi jika status diisi dengan enum ilegal", () => {
      const tenant = new Tenant({ namaToko: "Toko A", status: "banned" });
      const error = tenant.validateSync();

      expect(error.errors.status).toBeDefined();
      expect(error.errors.status.message).toMatch(/enum/i);
    });

    test("harus melempar error validasi jika tipePajak diisi dengan enum ilegal", () => {
      const tenant = new Tenant({ namaToko: "Toko A", tipePajak: "Pajak Ilegal" });
      const error = tenant.validateSync();

      expect(error.errors.tipePajak).toBeDefined();
      expect(error.errors.tipePajak.message).toMatch(/enum/i);
    });
  });

  describe("Validasi Numerik (persenPajak: min 0, max 100)", () => {
    test("harus melempar error validasi jika persenPajak bernilai negatif (di bawah min)", () => {
      const tenant = new Tenant({ namaToko: "Toko B", persenPajak: -5 });
      const error = tenant.validateSync();

      expect(error.errors.persenPajak).toBeDefined();
      expect(error.errors.persenPajak.message).toMatch(/min/i);
    });

    test("harus melempar error validasi jika persenPajak lebih besar dari 100 (di atas max)", () => {
      const tenant = new Tenant({ namaToko: "Toko B", persenPajak: 110 });
      const error = tenant.validateSync();

      expect(error.errors.persenPajak).toBeDefined();
      expect(error.errors.persenPajak.message).toMatch(/max/i);
    });
  });

  describe("Sanitasi Data Otomatis (Trim & Lowercase)", () => {
    test("harus otomatis memotong spasi liar (trim) dan mengubah email menjadi huruf kecil (lowercase)", () => {
      const tenant = new Tenant({
        namaToko: "   Toko Indah Makmur   ",
        emailBisnis: "   ADMIN@TOKO-INDAH.COM   ",
        kota: "   Pontianak   "
      });

      // Mongoose harus membersihkannya seketika saat instance dibuat
      expect(tenant.namaToko).toBe("Toko Indah Makmur");
      expect(tenant.emailBisnis).toBe("admin@toko-indah.com");
      expect(tenant.kota).toBe("Pontianak");
    });
  });
});