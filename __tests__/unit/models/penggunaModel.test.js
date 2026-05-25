const mongoose = require("mongoose");
const Pengguna = require("../../../models/penggunaModel");
const bcrypt = require("bcrypt");

// Mocking bcrypt agar tidak perlu mengeksekusi proses hashing asli yang memakan waktu di unit test
jest.mock("bcrypt");

describe("Unit Test Model — Pengguna", () => {
  // Data fundamental yang valid
  const validData = {
    nama: "Kasir Andalan",
    pin: "123456",
    roleID: new mongoose.Types.ObjectId(),
    tenantID: new mongoose.Types.ObjectId(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Skenario A: Validasi Struktur Default
  test("Skenario A — sukses membuat instance pengguna dengan nilai default yang benar", () => {
    const user = new Pengguna(validData);
    const err = user.validateSync();

    expect(err).toBeUndefined();
    expect(user.aksesType).toEqual(["app"]);
    expect(user.tokenVersion).toBe(0);
    expect(user.status).toBe("aktif");
    expect(user.nomorHp).toBeNull();
    expect(user.fotoKaryawan).toBeNull();
  });

  // Skenario B: Perlindungan Mandatory Fields
  test("Skenario B — gagal validasi jika properti wajib (nama, pin, role, tenant) kosong", () => {
    const user = new Pengguna({});
    const err = user.validateSync();

    expect(err.errors.nama).toBeDefined();
    expect(err.errors.pin).toBeDefined();
    expect(err.errors.roleID).toBeDefined();
    expect(err.errors.tenantID).toBeDefined();
  });

  // Skenario C: Penolakan Enum aksesType Ilegal
  test("Skenario C — gagal validasi jika aksesType diisi dengan string ngawur", () => {
    const user = new Pengguna({ ...validData, aksesType: ["desktop_ilegal"] });
    const err = user.validateSync();

    expect(err.errors["aksesType.0"]).toBeDefined();
    expect(err.errors["aksesType.0"].message).toMatch(/enum/i);
  });

  // Skenario D: Penolakan Enum Status Ilegal
  test("Skenario D — gagal validasi jika status diisi dengan nilai di luar enum", () => {
    const user = new Pengguna({ ...validData, status: "dibekukan" });
    const err = user.validateSync();

    expect(err.errors.status).toBeDefined();
    expect(err.errors.status.message).toMatch(/enum/i);
  });

  // Skenario E: Fungsi Komparasi PIN (Method Testing)
  test("Skenario E — method comparePin mengeksekusi bcrypt.compare dengan benar", async () => {
    const user = new Pengguna(validData);
    user.pin = "hashed_pin_simulasi";

    bcrypt.compare.mockResolvedValue(true);

    const isMatch = await user.comparePin("123456");

    expect(bcrypt.compare).toHaveBeenCalledWith(
      "123456",
      "hashed_pin_simulasi",
    );
    expect(isMatch).toBe(true);
  });

  // Skenario F: Sanitasi Data Otomatis (Trim)
  test("Skenario F — harus otomatis memotong spasi liar (trim) pada nama dan nomorHp", () => {
    const user = new Pengguna({
      ...validData,
      nama: "   Kasir Depan   ",
      nomorHp: "   08123456789   ",
    });

    expect(user.nama).toBe("Kasir Depan");
    expect(user.nomorHp).toBe("08123456789");
  });

  // Skenario G: Validasi aksesType Kombinasi Sah
  test("Skenario G — sukses jika aksesType diisi kombinasi web dan app sekaligus", () => {
    const user = new Pengguna({ ...validData, aksesType: ["app", "web"] });
    const err = user.validateSync();

    expect(err).toBeUndefined();
    expect(user.aksesType).toEqual(["app", "web"]);
  });

  // Skenario H: Penolakan aksesType Array Kosong
  test("Skenario H — gagal validasi jika aksesType dikirim sebagai array kosong", () => {
    const user = new Pengguna({ ...validData, aksesType: [] });
    const err = user.validateSync();

    expect(err).toBeDefined();
    expect(err.errors.aksesType).toBeDefined();
    expect(err.errors.aksesType.message).toBe("aksesType tidak boleh kosong");
  });

  // Skenario I: Penolakan roleID Format Ilegal
  test("Skenario I — gagal validasi jika roleID bukan ObjectId yang valid", () => {
    const user = new Pengguna({ ...validData, roleID: "bukan-object-id" });
    const err = user.validateSync();

    expect(err.errors.roleID).toBeDefined();
    expect(err.errors.roleID.name).toBe("CastError");
  });

  // Skenario K: Compound unique index terdefinisi di skema
  test("Skenario K — compound index { tenantID, nama } harus terdaftar di skema", () => {
    const indexes = Pengguna.schema.indexes();
    const hasCompoundUnique = indexes.some(
      ([fields, options]) =>
        fields.tenantID === 1 && fields.nama === 1 && options.unique === true,
    );

    expect(hasCompoundUnique).toBe(true);
  });

  // Skenario J: tokenVersion bisa di-increment
  test("Skenario J — tokenVersion harus bisa dinaikkan nilainya secara programatik", () => {
    const user = new Pengguna(validData);

    expect(user.tokenVersion).toBe(0);
    user.tokenVersion += 1;
    expect(user.tokenVersion).toBe(1);

    const err = user.validateSync();
    expect(err).toBeUndefined();
  });

  // Skenario Middleware: Hashing PIN
  describe("Middleware Pre-save (PIN Hashing)", () => {
    test("harus melakukan hashing PIN jika PIN diubah/baru", async () => {
      bcrypt.genSalt.mockResolvedValue("random_salt");
      bcrypt.hash.mockResolvedValue("hashed_pin_baru");

      const user = new Pengguna({ ...validData, pin: "pin_mentah" });

      const pres = user.schema.s.hooks._pres.get("save");
      const saveHook = pres.find((h) => h.fn.toString().includes("bcrypt")).fn;

      user.isModified = jest.fn().mockReturnValue(true);
      const mockNext = jest.fn();

      await saveHook.call(user, mockNext);

      expect(user.isModified).toHaveBeenCalledWith("pin");
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith("pin_mentah", "random_salt");
      expect(user.pin).toBe("hashed_pin_baru");
      expect(mockNext).toHaveBeenCalled();
    });

    test("tidak boleh melakukan hashing ulang jika PIN tidak dimodifikasi", async () => {
      const user = new Pengguna({ ...validData, pin: "hashed_lama" });

      const pres = user.schema.s.hooks._pres.get("save");
      const saveHook = pres.find((h) => h.fn.toString().includes("bcrypt")).fn;

      user.isModified = jest.fn().mockReturnValue(false);
      const mockNext = jest.fn();

      await saveHook.call(user, mockNext);

      expect(user.isModified).toHaveBeenCalledWith("pin");
      expect(bcrypt.genSalt).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    test("harus melempar error ke next() jika proses hashing gagal", async () => {
      const mockError = new Error("Bcrypt gagal");
      bcrypt.genSalt.mockRejectedValue(mockError);

      const user = new Pengguna({ ...validData, pin: "pin_mentah" });

      const pres = user.schema.s.hooks._pres.get("save");
      const saveHook = pres.find((h) => h.fn.toString().includes("bcrypt")).fn;

      user.isModified = jest.fn().mockReturnValue(true);
      const mockNext = jest.fn();

      await saveHook.call(user, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });
});
