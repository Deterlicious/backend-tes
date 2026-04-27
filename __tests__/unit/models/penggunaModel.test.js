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
    const err = user.validateSync(); // Validasi skema tanpa save() ke DB

    expect(err).toBeUndefined();
    // Memastikan fondasi penutupan celah bypass (Default selalu 'app')
    expect(user.aksesType).toBe("app");
    expect(user.maxPrimaryDevice).toBe(1);
    expect(user.maxDevice).toBe(1);
    expect(user.tokenVersion).toBe(0);
    expect(user.device).toHaveLength(0); // Array device harus kosong saat pertama kali dibuat
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
    // Klien memaksa memasukkan tipe akses tidak sah
    const user = new Pengguna({ ...validData, aksesType: "desktop_ilegal" });
    const err = user.validateSync();

    expect(err.errors.aksesType).toBeDefined();
    expect(err.errors.aksesType.message).toMatch(/is not a valid enum value/i);
  });

  // Skenario D: Restriksi Batas Maksimal Kuota Device
  test("Skenario D — menolak input yang melanggar batas maksimal device (maxDevice & maxPrimary)", () => {
    const user = new Pengguna({
      ...validData,
      maxPrimaryDevice: 4, // Melebihi max 3 dari skema
      maxDevice: 10, // Melebihi max 6 dari skema
    });
    const err = user.validateSync();

    expect(err.errors.maxPrimaryDevice).toBeDefined();
    expect(err.errors.maxDevice).toBeDefined();
  });

  // Skenario E: Restriksi Batas Minimal Kuota Device
  test("Skenario E — menolak input jika batas device disetel kurang dari 1 (0 atau minus)", () => {
    const user = new Pengguna({
      ...validData,
      maxPrimaryDevice: 0,
      maxDevice: -1,
    });
    const err = user.validateSync();

    expect(err.errors.maxPrimaryDevice).toBeDefined();
    expect(err.errors.maxDevice).toBeDefined();
  });

  // Skenario F: Fungsi Komparasi PIN (Method Testing)
  test("Skenario F — method comparePin mengeksekusi bcrypt.compare dengan benar", async () => {
    const user = new Pengguna(validData);
    user.pin = "hashed_pin_simulasi";

    // Simulasikan bcrypt mereturn true
    bcrypt.compare.mockResolvedValue(true);

    const isMatch = await user.comparePin("123456");

    expect(bcrypt.compare).toHaveBeenCalledWith(
      "123456",
      "hashed_pin_simulasi",
    );
    expect(isMatch).toBe(true);
  });

  // Skenario G: Validasi Ketat Sub-dokumen (Device & History)
  test("Skenario G — gagal validasi jika sub-dokumen device atau riwayat disusupi format ilegal", () => {
    const user = new Pengguna({
      ...validData,
      device: [
        { type: "primary" }, // Sengaja mengosongkan deviceID (padahal wajib)
      ],
      deviceHistory: [
        {
          deviceID: "DEV-999",
          type: "primary",
          action: "hacked", // 'hacked' tidak ada di enum ["added", "removed", "promoted", "demoted"]
        },
      ],
    });

    const err = user.validateSync();

    // Memastikan Mongoose mendeteksi ketiadaan deviceID di index ke-0
    expect(err.errors["device.0.deviceID"]).toBeDefined();

    // Memastikan Mongoose mendeteksi enum yang salah di riwayat index ke-0
    expect(err.errors["deviceHistory.0.action"]).toBeDefined();
    expect(err.errors["deviceHistory.0.action"].message).toMatch(
      /is not a valid enum value/i,
    );
  });
});
