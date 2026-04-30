const { 
  validateRegister, 
  validateLogin, 
  validateDeviceAction, 
  isDisposableEmail 
} = require("../../../validators/akunValidator");

describe("Unit Test Service — akunValidator", () => {

  // 1. validasi registrasi (validateRegister)
  describe("validateRegister", () => {
    test("Menolak jika email atau password kosong sama sekali", () => {
      const result1 = validateRegister({ password: "Password123!" });
      expect(result1.valid).toBe(false);
      expect(result1.errors[0]).toMatch(/Format email tidak valid/i);

      const result2 = validateRegister({ email: "owner@tachyon.co.id" });
      expect(result2.valid).toBe(false);
      expect(result2.errors[0]).toMatch(/Password wajib diisi/i);
    });

    test("Menolak format email yang cacat", () => {
      const result = validateRegister({ email: "bukan-format-email", password: "Password123!" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Format email tidak valid/i);
    });

    // MASALAH 1: Password
    describe("Keamanan Password", () => {
      test("Menolak password kurang dari 8 karakter", () => {
        const result = validateRegister({ email: "owner@tachyon.co.id", password: "Ab1" });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/minimal 8 karakter/i);
      });

      test("Menolak password tanpa huruf kapital", () => {
        const result = validateRegister({ email: "owner@tachyon.co.id", password: "abcdefg1" });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/huruf kapital/i);
      });

      test("Menolak password tanpa angka", () => {
        const result = validateRegister({ email: "owner@tachyon.co.id", password: "Abcdefgh" });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/angka/i);
      });
    });

    // MASALAH 2: Email Disposable
    describe("Pemblokiran Email Disposable", () => {
      test("Menolak email dari layanan sampah (mailinator, yopmail, 10minutemail)", () => {
        const domains = ["test@mailinator.com", "test@yopmail.com", "test@10minutemail.com"];
        domains.forEach(email => {
          const result = validateRegister({ email, password: "Password123!" });
          expect(result.valid).toBe(false);
          expect(result.errors[0]).toMatch(/disposable/i);
        });
      });

      test("Menerima email dari domain legit dan korporat", () => {
        const domains = ["user@gmail.com", "admin@tachyon.co.id"];
        domains.forEach(email => {
          const result = validateRegister({ email, password: "Password123!" });
          expect(result.valid).toBe(true);
        });
      });
    });
  });

  // 2. validasi login (validateLogin)
  describe("validateLogin", () => {
    test("Menolak jika input email atau password kosong", () => {
      const result = validateLogin({ email: "", password: "" });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("Sukses memvalidasi login (Meskipun tanpa deviceID sesuai arsitektur baru)", () => {
      // Pembuktian bahwa deviceID sudah tidak lagi dibutuhkan di entitas Akun SaaS
      const result = validateLogin({ 
        email: "admin@tachyon.co.id", 
        password: "Password123!" 
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  // 3. validasi aksi perangkat (validateDeviceAction)
  describe("validateDeviceAction", () => {
    test("Menolak payload jika deviceID kosong", () => {
      const result = validateDeviceAction({ type: "primary" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Device ID wajib diisi/i);
    });

    test("Lolos validasi jika parameter perangkat lengkap", () => {
      const result = validateDeviceAction({ deviceID: "DEV-001", type: "primary" });
      expect(result.valid).toBe(true);
    });
  });

  // 4. helper (isDisposableEmail)
  describe("isDisposableEmail Helper", () => {
    test("Deteksi akurat untuk domain disposable", () => {
      expect(isDisposableEmail("abc@mailinator.com")).toBe(true);
      expect(isDisposableEmail("abc@tempmail.com")).toBe(true);
    });

    test("Deteksi case-insensitive (huruf besar/kecil tidak berpengaruh)", () => {
      expect(isDisposableEmail("abc@MAILINATOR.COM")).toBe(true);
    });

    test("Mengabaikan domain resmi", () => {
      expect(isDisposableEmail("abc@gmail.com")).toBe(false);
      expect(isDisposableEmail("admin@tachyon.co.id")).toBe(false);
    });
  });
});