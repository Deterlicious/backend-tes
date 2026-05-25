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
      const akun = new Akun({
        email: "owner@toko.com",
        password: "rahasia123",
      });

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

    test("harus melempar error validasi jika role tidak sesuai enum (bukan client/admin)", () => {
      const akun = new Akun({
        email: "owner@toko.com",
        password: "123",
        role: "superadmin", // Role ilegal
      });
      const error = akun.validateSync();

      expect(error.errors.role).toBeDefined();
      expect(error.errors.role.message).toMatch(/enum/i);
    });

    test("harus melakukan sanitasi otomatis (lowercase dan trim) pada email dan username", () => {
      const akun = new Akun({
        username: "   Bos Besar   ",
        email: "   TESTING@TOKO.COM  ",
        password: "123",
      });

      // Mongoose harus otomatis membersihkannya saat instance dibuat
      expect(akun.username).toBe("Bos Besar");
      expect(akun.email).toBe("testing@toko.com");
    });
  });

  describe("Logika Kriptografi (comparePassword)", () => {
    test("harus mengembalikan true jika password kandidat cocok dengan hash", async () => {
      // Mengatur agar bcrypt.compare seolah-olah berhasil
      bcrypt.compare.mockResolvedValue(true);

      const akun = new Akun({ password: "hashed_password_di_db" });
      const isMatch = await akun.comparePassword("rahasia123"); // FIX: Gunakan comparePassword

      expect(bcrypt.compare).toHaveBeenCalledWith(
        "rahasia123",
        "hashed_password_di_db",
      );
      expect(isMatch).toBe(true);
    });

    test("harus mengembalikan false jika password kandidat salah", async () => {
      // Mengatur agar bcrypt.compare menolak password
      bcrypt.compare.mockResolvedValue(false);

      const akun = new Akun({ password: "hashed_password_di_db" });
      const isMatch = await akun.comparePassword("password_salah"); // FIX: Gunakan comparePassword

      expect(isMatch).toBe(false);
    });
  });

  describe("Middleware Pre-save (Password Hashing)", () => {
    test("harus melakukan hashing password jika password diubah/baru", async () => {
      bcrypt.genSalt.mockResolvedValue("random_salt");
      bcrypt.hash.mockResolvedValue("hashed_password_baru");

      const akun = new Akun({
        email: "test@toko.com",
        password: "password_mentah",
      });

      // FIX: Mongoose punya hook bawaan. Kita cari spesifik hook kita yang ada "bcrypt"-nya.
      const pres = akun.schema.s.hooks._pres.get("save");
      const saveHook = pres.find((h) => h.fn.toString().includes("bcrypt")).fn;

      // Amankan status isModified agar konsisten di lingkungan Jest
      akun.isModified = jest.fn().mockReturnValue(true);

      const mockNext = jest.fn();
      await saveHook.call(akun, mockNext);

      expect(akun.isModified).toHaveBeenCalledWith("password");
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith(
        "password_mentah",
        "random_salt",
      );
      expect(akun.password).toBe("hashed_password_baru");
      expect(mockNext).toHaveBeenCalled();
    });

    test("tidak boleh melakukan hashing ulang jika password tidak dimodifikasi", async () => {
      const akun = new Akun({
        email: "test@toko.com",
        password: "hashed_lama",
      });

      // FIX: Ekstrak hook yang tepat
      const pres = akun.schema.s.hooks._pres.get("save");
      const saveHook = pres.find((h) => h.fn.toString().includes("bcrypt")).fn;

      akun.isModified = jest.fn().mockReturnValue(false);

      const mockNext = jest.fn();
      await saveHook.call(akun, mockNext);

      expect(akun.isModified).toHaveBeenCalledWith("password");
      expect(bcrypt.genSalt).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    test("harus melempar error ke next() jika proses hashing gagal (Coverage Catch Block)", async () => {
      const mockError = new Error("Bcrypt kehabisan memori");
      // Paksa bcrypt melempar error
      bcrypt.genSalt.mockRejectedValue(mockError);

      const akun = new Akun({ email: "error@toko.com", password: "password_mentah" });
      
      const pres = akun.schema.s.hooks._pres.get('save');
      const saveHook = pres.find(h => h.fn.toString().includes('bcrypt')).fn;
      
      akun.isModified = jest.fn().mockReturnValue(true);
      const mockNext = jest.fn();
      
      await saveHook.call(akun, mockNext);

      // Pastikan error ditangkap dan dilempar ke next()
      expect(mockNext).toHaveBeenCalledWith(mockError);
    }); 
  });
});
