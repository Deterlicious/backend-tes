const { validatePenggunaLogin } = require("../../../validators/penggunaValidator");

describe("Unit Test Validator — validatePenggunaLogin", () => {
  test("Menolak dengan tegas jika payload benar-benar kosong", () => {
    const result1 = validatePenggunaLogin({});
    expect(result1.valid).toBe(false);
    expect(result1.errors[0]).toMatch(/Data login kosong/i);

    const result2 = validatePenggunaLogin(null);
    expect(result2.valid).toBe(false);
    expect(result2.errors[0]).toMatch(/Data login kosong/i);
  });

  test("Menolak akses jika 'nama' tidak dicantumkan atau kosong", () => {
    // Skenario: Kasir mencoba login hanya pakai PIN dan deviceID (Skenario cacat dokumentasi)
    const payloadTanpaNama = { pin: "123456", deviceID: "DEV-001" };
    const result = validatePenggunaLogin(payloadTanpaNama);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/Nama pengguna wajib diisi/i)])
    );
  });

  test("Menolak akses jika 'pin' tidak dicantumkan", () => {
    const payloadTanpaPin = { nama: "Kasir Andalan", deviceID: "DEV-001" };
    const result = validatePenggunaLogin(payloadTanpaPin);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/PIN wajib diisi/i)])
    );
  });

  test("Lolos validasi sempurna jika 'nama' dan 'pin' dikirimkan", () => {
    const payloadValid = { 
      nama: "Kasir Andalan", 
      pin: "123456", 
      deviceID: "DEV-001" 
    };
    const result = validatePenggunaLogin(payloadValid);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test("Menolak akses jika 'nama' atau 'pin' hanya berisi spasi kosong (Whitespace)", () => {
    const payloadSpasi = { nama: "   ", pin: "   ", deviceID: "DEV-001" };
    const result = validatePenggunaLogin(payloadSpasi);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Nama pengguna wajib diisi/i),
        expect.stringMatching(/PIN wajib diisi/i)
      ])
    );
  });

  test("Menolak akses jika payload mengandung Injeksi NoSQL (Tipe data Objek)", () => {
    // Peretas mencoba membypass query Mongoose dengan operator $ne (Not Equal) dan $gt (Greater Than)
    const payloadHacker = { 
      nama: { $ne: null }, 
      pin: { $gt: "0" }, 
      deviceID: "DEV-001" 
    };
    
    const result = validatePenggunaLogin(payloadHacker);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Format nama tidak valid/i),
        expect.stringMatching(/Format PIN tidak valid/i)
      ])
    );
  });
});