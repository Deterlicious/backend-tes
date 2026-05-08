const {
  validatePenggunaLogin,
  validatePenggunaPayload,
  validateDeviceAction,
} = require("../../../validators/penggunaValidator");

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
      expect.arrayContaining([
        expect.stringMatching(/Nama pengguna wajib diisi/i),
      ]),
    );
  });

  test("Menolak akses jika 'pin' tidak dicantumkan", () => {
    const payloadTanpaPin = { nama: "Kasir Andalan", deviceID: "DEV-001" };
    const result = validatePenggunaLogin(payloadTanpaPin);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/PIN wajib diisi/i)]),
    );
  });

  test("Lolos validasi sempurna jika 'nama' dan 'pin' dikirimkan", () => {
    const payloadValid = {
      nama: "Kasir Andalan",
      pin: "123456",
      deviceID: "DEV-001",
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
        expect.stringMatching(/PIN wajib diisi/i),
      ]),
    );
  });

  test("Menolak akses jika payload mengandung Injeksi NoSQL (Tipe data Objek)", () => {
    // Peretas mencoba membypass query Mongoose dengan operator $ne (Not Equal) dan $gt (Greater Than)
    const payloadHacker = {
      nama: { $ne: null },
      pin: { $gt: "0" },
      deviceID: "DEV-001",
    };

    const result = validatePenggunaLogin(payloadHacker);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Format nama tidak valid/i),
        expect.stringMatching(/Format PIN tidak valid/i),
      ]),
    );
  });

  describe("Unit Test Validator — validatePenggunaPayload", () => {
    const validId = "507f1f77bcf86cd799439011"; // Mock ObjectId yang valid

    test("Menolak dengan tegas jika payload benar-benar kosong", () => {
      const result = validatePenggunaPayload({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Data pengguna tidak ditemukan atau kosong",
      );
    });

    test("Mode Create: Menolak jika field wajib (Mandatory) tidak dikirim", () => {
      // Hanya mengirim nama, tanpa pin, tenantID, dan roleID
      const result = validatePenggunaPayload({ nama: "Kasir A" });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      expect(result.errors.some((e) => e.includes("pin wajib diisi"))).toBe(
        true,
      );
    });

    test("Memvalidasi batas panjang Nama (min 3, max 50)", () => {
      const resPendek = validatePenggunaPayload({ nama: "Ab" }, true);
      expect(resPendek.valid).toBe(false);
      expect(resPendek.errors).toContain("Nama minimal 3 karakter");

      const resPanjang = validatePenggunaPayload(
        { nama: "A".repeat(51) },
        true,
      );
      expect(resPanjang.valid).toBe(false);
      expect(resPanjang.errors).toContain("Nama maksimal 50 karakter");
    });

    test("Memvalidasi kekuatan PIN (min 6 karakter, harus angka murni)", () => {
      const resPendek = validatePenggunaPayload({ pin: "12345" }, true);
      expect(resPendek.valid).toBe(false);
      expect(resPendek.errors).toContain("PIN minimal 6 karakter");

      const resHuruf = validatePenggunaPayload({ pin: "12345a" }, true);
      expect(resHuruf.valid).toBe(false);
      expect(resHuruf.errors).toContain("PIN harus berupa angka");
    });

    test("Memvalidasi format nomor HP Indonesia", () => {
      const res = validatePenggunaPayload({ nomorHp: "0000" }, true);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toMatch(/Format nomor HP tidak valid/i);
    });

    test("Memvalidasi aturan aksesType dan kewajiban mutlak deviceID untuk 'app'", () => {
      const resAppTanpaDevice = validatePenggunaPayload(
        { aksesType: "app" },
        true,
      );
      expect(resAppTanpaDevice.valid).toBe(false);
      expect(resAppTanpaDevice.errors).toContain(
        "Device ID wajib disertakan untuk akses aplikasi.",
      );

      const resAppDenganDevice = validatePenggunaPayload(
        { aksesType: "app", deviceID: "DEV-123" },
        true,
      );
      expect(resAppDenganDevice.valid).toBe(true);

      const resWebTanpaDevice = validatePenggunaPayload(
        { aksesType: "web" },
        true,
      );
      expect(resWebTanpaDevice.valid).toBe(true); // Web tidak wajib deviceID
    });

    test("Memvalidasi format Mongoose ObjectId pada tenantID dan roleID", () => {
      // Simulasi format ID cacat saat Create
      const resultCreate = validatePenggunaPayload({
        nama: "Kasir C",
        pin: "123456",
        tenantID: "id-ngawur",
        roleID: "id-ngawur",
      });
      expect(resultCreate.valid).toBe(false);
      expect(
        resultCreate.errors.some((e) => e.includes("format yang valid")),
      ).toBe(true);

      // Simulasi format ID cacat saat Update
      const resultUpdate = validatePenggunaPayload(
        { roleID: "id-palsu" },
        true,
      );
      expect(resultUpdate.valid).toBe(false);
      expect(resultUpdate.errors).toContain("ID Role tidak valid");
    });

    test("Menolak input status yang di luar ketentuan (enum ilegal)", () => {
      const result = validatePenggunaPayload({ status: "cuti" }, true);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Status harus 'aktif' atau 'non-aktif'");
    });

    test("Menolak input aksesType yang di luar ketentuan (enum ilegal)", () => {
      const result = validatePenggunaPayload({ aksesType: "desktop" }, true);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("aksesType harus 'web' atau 'app'");
    });

    test("Lolos validasi 100% jika payload Create disi dengan sempurna", () => {
      const result = validatePenggunaPayload({
        nama: "Kasir Budi",
        pin: "123456",
        tenantID: validId,
        roleID: validId,
        aksesType: "web",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe("Unit Test Validator — validateDeviceAction", () => {
    test("Menolak jika deviceID tidak disertakan", () => {
      const result = validateDeviceAction({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Device ID wajib diisi.");
    });

    test("Lolos validasi jika deviceID dikirim", () => {
      const result = validateDeviceAction({ deviceID: "DEV-123" });
      expect(result.valid).toBe(true);
    });
  });
});
