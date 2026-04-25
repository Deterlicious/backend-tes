const { validateRegister, isDisposableEmail } = require("../../../validators/akunValidator");

describe("akunValidator - validateRegister", () => {
  // =====================
  // MASALAH 1: Password
  // =====================
  describe("Password validation", () => {
    test("tolak password kurang dari 8 karakter", () => {
      const result = validateRegister({ email: "test@gmail.com", password: "Ab1234" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/minimal 8 karakter/i);
    });

    test("tolak password tanpa huruf kapital", () => {
      const result = validateRegister({ email: "test@gmail.com", password: "abcdefg1" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/huruf kapital/i);
    });

    test("tolak password tanpa angka", () => {
      const result = validateRegister({ email: "test@gmail.com", password: "Abcdefgh" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/angka/i);
    });

    test("terima password yang memenuhi semua syarat", () => {
      const result = validateRegister({ email: "test@gmail.com", password: "Abcdefg1" });
      expect(result.valid).toBe(true);
    });
  });

  // =====================
  // MASALAH 2: Email disposable
  // =====================
  describe("Email disposable validation", () => {
    test("tolak email dari mailinator.com", () => {
      const result = validateRegister({ email: "test@mailinator.com", password: "Abcdefg1" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/disposable/i);
    });

    test("tolak email dari yopmail.com", () => {
      const result = validateRegister({ email: "test@yopmail.com", password: "Abcdefg1" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/disposable/i);
    });

    test("tolak email dari 10minutemail.com", () => {
      const result = validateRegister({ email: "test@10minutemail.com", password: "Abcdefg1" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/disposable/i);
    });

    test("terima email dari domain legit", () => {
      const result = validateRegister({ email: "user@gmail.com", password: "Abcdefg1" });
      expect(result.valid).toBe(true);
    });

    test("terima email dari domain perusahaan", () => {
      const result = validateRegister({ email: "admin@tachyon.co.id", password: "Abcdefg1" });
      expect(result.valid).toBe(true);
    });
  });

  // =====================
  // Helper isDisposableEmail
  // =====================
  describe("isDisposableEmail helper", () => {
    test("return true untuk domain disposable", () => {
      expect(isDisposableEmail("abc@mailinator.com")).toBe(true);
      expect(isDisposableEmail("abc@guerrillamail.com")).toBe(true);
      expect(isDisposableEmail("abc@tempmail.com")).toBe(true);
    });

    test("return false untuk domain legit", () => {
      expect(isDisposableEmail("abc@gmail.com")).toBe(false);
      expect(isDisposableEmail("abc@yahoo.com")).toBe(false);
      expect(isDisposableEmail("abc@outlook.com")).toBe(false);
    });

    test("case insensitive - domain uppercase tetap terdeteksi", () => {
      expect(isDisposableEmail("abc@MAILINATOR.COM")).toBe(true);
    });
  });
});