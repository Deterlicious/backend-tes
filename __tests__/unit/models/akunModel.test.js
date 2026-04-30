const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Akun = require("../../../models/akunModel");

// Memalsukan library bcrypt agar pengujian berjalan secepat kilat 
// tanpa harus melakukan komputasi kriptografi sungguhan
jest.mock("bcrypt");

describe("Unit Test Akun Model", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Validasi Skema (Schema Rules)", () => {
    test("harus lolos validasi jika field wajib (email, password) terisi", () => {
      const akun = new Akun({ email: "owner@toko.com", password: "rahasia123" });
      
      // validateSync() mengecek aturan skema di memori tanpa perlu hit ke database
      const error = akun.validateSync();
      
      expect(error).toBeUndefined(); // Tidak boleh ada error
    });

    test("harus melempar error validasi jika email kosong", () => {
      const akun = new Akun({ password: "rahasia123" });
      const error = akun.validateSync();
      
      expect(error.errors.email).toBeDefined();
      expect(error.errors.email.message).toMatch(/required/i);
    });

    test("harus melempar error validasi jika password kosong", () => {
      const akun = new Akun({ email: "owner@toko.com" });
      const error = akun.validateSync();
      
      expect(error.errors.password).toBeDefined();
    });

    test("harus menyuntikkan nilai default yang absolut (role: client, tokenVersion: 0)", () => {
      const akun = new Akun({ email: "owner@toko.com", password: "123" });
      
      expect(akun.role).toBe("client");
      expect(akun.tokenVersion).toBe(0);
      expect(akun.tenantID).toBeNull(); // Karena saat baru mendaftar, toko belum dibuat
    });
  });

  describe("Logika Kriptografi (comparePin)", () => {
    test("harus mengembalikan true jika password kandidat cocok dengan hash", async () => {
      // Mengatur agar bcrypt.compare seolah-olah berhasil
      bcrypt.compare.mockResolvedValue(true);
      
      const akun = new Akun({ password: "hashed_password_di_db" });
      const isMatch = await akun.comparePin("rahasia123");
      
      // Memastikan bcrypt menerima urutan argumen yang benar: (kandidat, hash)
      expect(bcrypt.compare).toHaveBeenCalledWith("rahasia123", "hashed_password_di_db");
      expect(isMatch).toBe(true);
    });

    test("harus mengembalikan false jika password kandidat salah", async () => {
      // Mengatur agar bcrypt.compare menolak password
      bcrypt.compare.mockResolvedValue(false);
      
      const akun = new Akun({ password: "hashed_password_di_db" });
      const isMatch = await akun.comparePin("password_salah");
      
      expect(isMatch).toBe(false);
    });
  });
});