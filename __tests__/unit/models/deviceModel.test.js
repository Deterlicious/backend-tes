const mongoose = require("mongoose");
// Sesuaikan path ini dengan letak file asli Anda
const Device = require("../../../models/deviceModel");
const { DEVICE_STATUS } = require("../../../config/constants");

describe("Unit Test — Device Model", () => {
  // Membuat mock ObjectId untuk simulasi relasi
  const mockPenggunaID = new mongoose.Types.ObjectId();
  const mockApprovedByID = new mongoose.Types.ObjectId();

  test("1. Harus sukses membuat instance perangkat dengan atribut wajib saja", () => {
    const validDevice = new Device({
      penggunaID: mockPenggunaID,
      installationId: "DEV-UUID-12345",
    });

    const error = validDevice.validateSync();
    
    // Ekspektasi: Tidak ada error validasi
    expect(error).toBeUndefined();

    // Ekspektasi Default Values (Bawaan)
    expect(validDevice.status).toBe(DEVICE_STATUS.PENDING);
    expect(validDevice.deviceName).toBe("Unknown Device");
    expect(validDevice.platform).toBe("Unknown");
    expect(validDevice.refreshTokenHash).toBeNull();
    expect(validDevice.lastIpAddress).toBeNull();
  });

  test("2. Harus menolak jika 'penggunaID' (Relasi ke Kasir) tidak disertakan", () => {
    const deviceTanpaPengguna = new Device({
      installationId: "DEV-UUID-12345",
    });

    const error = deviceTanpaPengguna.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.penggunaID).toBeDefined();
    expect(error.errors.penggunaID.message).toMatch(/Path `penggunaID` is required/i);
  });

  test("3. Harus menolak jika 'installationId' tidak disertakan", () => {
    const deviceTanpaInstalasi = new Device({
      penggunaID: mockPenggunaID,
    });

    const error = deviceTanpaInstalasi.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.installationId).toBeDefined();
    expect(error.errors.installationId.message).toMatch(/Path `installationId` is required/i);
  });

  test("4. Harus menolak jika 'status' diisi dengan nilai di luar enum DEVICE_STATUS", () => {
    const deviceStatusIlegal = new Device({
      penggunaID: mockPenggunaID,
      installationId: "DEV-UUID-12345",
      status: "HACKED_STATUS", // Ilegal
    });

    const error = deviceStatusIlegal.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.status).toBeDefined();
    expect(error.errors.status.message).toMatch(/is not a valid enum value for path `status`/i);
  });

  test("5. Harus memotong spasi berlebih (trim) pada 'installationId' dan 'deviceName'", () => {
    const deviceKotor = new Device({
      penggunaID: mockPenggunaID,
      installationId: "   DEV-UUID-123   ",
      deviceName: "   Tablet Kasir   ",
    });

    // Validasi sinkron
    deviceKotor.validateSync();

    expect(deviceKotor.installationId).toBe("DEV-UUID-123");
    expect(deviceKotor.deviceName).toBe("Tablet Kasir");
  });

  test("6. Harus menolak jika panjang karakter metadata melebihi batas maksimum (maxlength)", () => {
    const stringPanjang101 = "A".repeat(101); // Batas deviceName adalah 100
    const stringPanjang51 = "B".repeat(51);   // Batas platform adalah 50

    const deviceOverload = new Device({
      penggunaID: mockPenggunaID,
      installationId: "DEV-UUID-12345",
      deviceName: stringPanjang101,
      platform: stringPanjang51,
    });

    const error = deviceOverload.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.deviceName).toBeDefined();
    expect(error.errors.platform).toBeDefined();
  });

  test("7. Audit Trails: Harus menerima referensi ID Pengguna yang menyetujui (approvedBy)", () => {
    const deviceDiAprove = new Device({
      penggunaID: mockPenggunaID,
      installationId: "DEV-UUID-12345",
      status: DEVICE_STATUS.TRUSTED,
      approvedBy: mockApprovedByID,
      approvedAt: new Date(),
    });

    const error = deviceDiAprove.validateSync();

    expect(error).toBeUndefined();
    expect(deviceDiAprove.approvedBy).toEqual(mockApprovedByID);
    expect(deviceDiAprove.approvedAt).toBeInstanceOf(Date);
  });
});