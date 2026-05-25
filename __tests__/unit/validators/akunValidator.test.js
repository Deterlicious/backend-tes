const {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  isDisposableEmail,
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
      const result = validateRegister({
        email: "bukan-format-email",
        password: "Password123!",
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Format email tidak valid/i);
    });

    describe("Validasi Username (Opsional tapi ketat)", () => {
      test("Menolak username jika bukan teks (string)", () => {
        const result = validateRegister({
          email: "valid@toko.com",
          password: "Password123!",
          username: 12345,
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/berupa teks/i);
      });

      test("Menolak username di bawah 3 karakter atau di atas 25 karakter", () => {
        const resultShort = validateRegister({
          email: "valid@toko.com",
          password: "Password123!",
          username: "Ab",
        });
        expect(resultShort.valid).toBe(false);
        expect(resultShort.errors[0]).toMatch(/minimal 3 karakter/i);

        const resultLong = validateRegister({
          email: "valid@toko.com",
          password: "Password123!",
          username: "A".repeat(26),
        });
        expect(resultLong.valid).toBe(false);
        expect(resultLong.errors[0]).toMatch(/maksimal 25 karakter/i);
      });

      test("Sukses memvalidasi payload registrasi lengkap beserta username valid", () => {
        const result = validateRegister({
          email: "ceo@tachyon.co.id",
          password: "StrongPassword123!",
          username: "MoltenZarak"
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });
    });

    // MASALAH 1: Password
    describe("Keamanan Password", () => {
      test("Menolak password kurang dari 8 karakter", () => {
        const result = validateRegister({
          email: "owner@tachyon.co.id",
          password: "Ab1",
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/minimal 8 karakter/i);
      });

      test("Menolak password tanpa huruf kapital", () => {
        const result = validateRegister({
          email: "owner@tachyon.co.id",
          password: "abcdefg1",
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/huruf kapital/i);
      });

      test("Menolak password tanpa angka", () => {
        const result = validateRegister({
          email: "owner@tachyon.co.id",
          password: "Abcdefgh",
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/angka/i);
      });
    });

    // MASALAH 2: Email Disposable
    describe("Pemblokiran Email Disposable", () => {
      test("Menolak email dari layanan sampah (mailinator, yopmail, 10minutemail)", () => {
        const domains = [
          "test@mailinator.com",
          "test@yopmail.com",
          "test@10minutemail.com",
        ];
        domains.forEach((email) => {
          const result = validateRegister({ email, password: "Password123!" });
          expect(result.valid).toBe(false);
          expect(result.errors[0]).toMatch(/disposable/i);
        });
      });

      test("Menerima email dari domain legit dan korporat", () => {
        const domains = ["user@gmail.com", "admin@tachyon.co.id"];
        domains.forEach((email) => {
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
        password: "Password123!",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  // 3. validasi update profil (validateUpdateProfile)
  describe("validateUpdateProfile", () => {
    test("Lolos validasi jika tidak ada data yang dikirim (payload kosong)", () => {
      const result = validateUpdateProfile({});
      expect(result.valid).toBe(true);
    });

    test("Menolak format email baru yang cacat atau disposable", () => {
      const resultCacat = validateUpdateProfile({ email: "bukan-email" });
      expect(resultCacat.valid).toBe(false);

      const resultSampah = validateUpdateProfile({
        email: "hacker@mailinator.com",
      });
      expect(resultSampah.valid).toBe(false);
    });

    test("Menolak username dengan panjang tidak wajar (Batas max 50 karakter)", () => {
      const result = validateUpdateProfile({ username: "B".repeat(51) });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/maksimal 50 karakter/i);
    });

    test("Menolak pembaruan username jika bukan teks atau kurang dari 3 karakter", () => {
      const resultTipe = validateUpdateProfile({ username: 123456 });
      expect(resultTipe.valid).toBe(false);
      expect(resultTipe.errors[0]).toMatch(/berupa teks/i);

      const resultPendek = validateUpdateProfile({ username: "Al" });
      expect(resultPendek.valid).toBe(false);
      expect(resultPendek.errors[0]).toMatch(/minimal 3 karakter/i);
    });

    test("Menolak pembaruan password jika oldPassword tidak disertakan", () => {
      const result = validateUpdateProfile({ password: "PasswordBaru123!" }); // Tanpa oldPassword
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Password lama wajib diisi/i);
    });

    test("Menolak pembaruan password jika tidak memenuhi standar keamanan", () => {
      const result = validateUpdateProfile({
        oldPassword: "OldPassword1!",
        password: "lemah",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("minimal 8 karakter"))).toBe(
        true,
      );
    });

    test("Sukses jika payload pembaruan valid", () => {
      const result = validateUpdateProfile({
        email: "baru@tachyon.co.id",
        username: "Bos Baru",
        oldPassword: "OldPassword1!",
        password: "NewPassword123!",
      });
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
