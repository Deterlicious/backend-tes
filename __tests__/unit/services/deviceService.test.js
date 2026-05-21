const deviceService = require("../../../services/deviceService");
const Device = require("../../../models/deviceModel");
const { DEVICE_STATUS } = require("../../../config/constants");

// Melakukan Mocking pada Mongoose Model
jest.mock("../../../models/deviceModel");

describe("Unit Test — Device Service", () => {
  // REVISI 1: Deklarasi mockTenantID yang sempat hilang
  const mockTenantID = "tenant-xyz";

  // Setup global cache mock
  beforeAll(() => {
    global.deviceCache = {
      del: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper untuk membuat instance perangkat tiruan
  const mockDeviceInstance = (overrides = {}) => ({
    status: DEVICE_STATUS.PENDING,
    penggunaID: {
      _id: "user-123",
      tenantID: mockTenantID, // Menggunakan variabel yang sudah dideklarasikan
    },
    installationId: "DEV-123",
    refreshTokenHash: "secret-hash",
    save: jest.fn().mockResolvedValue(true),
    toObject: function () {
      return { ...this };
    },
    ...overrides,
  });

  describe("1. getDevices", () => {
    test("Gagal (400) jika userId atau tenantID tidak disertakan", async () => {
      await expect(
        deviceService.getDevices(null, mockTenantID),
      ).rejects.toThrow("Parameter tidak lengkap");
    });

    test("Gagal (404) jika pengguna target tidak ditemukan atau beda tenant", async () => {
      const mockFindOne = jest.fn().mockResolvedValue(null);
      const mongoose = require("mongoose");
      mongoose.model = jest.fn().mockReturnValue({ findOne: mockFindOne });

      await expect(
        deviceService.getDevices("user-123", mockTenantID),
      ).rejects.toThrow(
        "Perangkat tidak ditemukan atau Anda tidak memiliki hak akses",
      );
    });

    test("Sukses mengambil daftar perangkat jika pengguna valid dan 1 tenant", async () => {
      const mockFindOne = jest
        .fn()
        .mockResolvedValue({ _id: "user-123", tenantID: mockTenantID });
      const mongoose = require("mongoose");
      mongoose.model = jest.fn().mockReturnValue({ findOne: mockFindOne });

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ installationId: "DEV-123" }]),
      };
      Device.find.mockReturnValue(mockChain);

      const result = await deviceService.getDevices("user-123", mockTenantID);

      expect(Device.find).toHaveBeenCalledWith({ penggunaID: "user-123" });
      expect(result).toHaveLength(1);
    });
  });

  describe("2. approveDevice (Otoritas Owner)", () => {
    test("Gagal (400) jika parameter tidak lengkap", async () => {
      await expect(
        deviceService.approveDevice({ installationId: "DEV-1" }),
      ).rejects.toThrow("Parameter tidak lengkap");
    });

    test("Gagal (404) jika perangkat tidak ditemukan atau beda tenant", async () => {
      Device.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await expect(
        deviceService.approveDevice({
          installationId: "DEV-X",
          approvedByUserId: "owner-1",
          tenantID: mockTenantID,
        }),
      ).rejects.toThrow("Perangkat tidak ditemukan");
    });

    test("Gagal (400) jika perangkat sudah berstatus TRUSTED", async () => {
      // REVISI 2: Menggunakan pola populate pada mock
      Device.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDeviceInstance({ status: DEVICE_STATUS.TRUSTED }))
      });
      await expect(
        deviceService.approveDevice({
          installationId: "DEV-1",
          approvedByUserId: "owner-1",
          tenantID: mockTenantID,
        }),
      ).rejects.toThrow("sudah memiliki status Trusted");
    });

    test("Gagal (403) jika mencoba menyetujui perangkat yang sudah di-REVOKE", async () => {
      Device.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDeviceInstance({ status: DEVICE_STATUS.REVOKED }))
      });
      await expect(
        deviceService.approveDevice({
          installationId: "DEV-1",
          approvedByUserId: "owner-1",
          tenantID: mockTenantID,
        }),
      ).rejects.toThrow("telah dicabut (Revoked) tidak dapat disetujui ulang");
    });

    test("Gagal (403) jika kuota maksimal perangkat telah penuh", async () => {
      Device.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDeviceInstance())
      });
      Device.countDocuments.mockResolvedValue(3); 
      process.env.MAX_DEVICES_PER_USER = "3";

      await expect(
        deviceService.approveDevice({
          installationId: "DEV-1",
          approvedByUserId: "owner-1",
          tenantID: mockTenantID,
        }),
      ).rejects.toThrow("Kuota maksimal (3) untuk kasir ini telah penuh");
    });

    test("Sukses menyetujui perangkat dan tidak membocorkan hash ke response", async () => {
      const mockDevice = mockDeviceInstance();
      Device.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDevice)
      });
      Device.countDocuments.mockResolvedValue(1);

      const result = await deviceService.approveDevice({
        installationId: "DEV-1",
        approvedByUserId: "owner-1",
        tenantID: mockTenantID, // REVISI 3: Menambahkan parameter yang hilang
      });

      expect(mockDevice.status).toBe(DEVICE_STATUS.TRUSTED);
      expect(mockDevice.approvedBy).toBe("owner-1");
      expect(mockDevice.pendingExpiresAt).toBeUndefined();
      expect(mockDevice.save).toHaveBeenCalled();
      expect(result.refreshTokenHash).toBeUndefined();
    });
  });

  describe("3. revokeDevice (Cabut Akses Paksa)", () => {
    test("Gagal (400) jika parameter tidak lengkap (installationId atau revokedByUserId kosong)", async () => {
      await expect(
        deviceService.revokeDevice({ installationId: "DEV-1" }),
      ).rejects.toThrow("Parameter tidak lengkap");
    });

    test("Skenario Idempotent: Mengembalikan sukses jika perangkat sudah dalam status REVOKED", async () => {
      const mockDevice = mockDeviceInstance({ status: DEVICE_STATUS.REVOKED });
      Device.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDevice) // REVISI: Pola populate
      });

      const result = await deviceService.revokeDevice({
        installationId: "DEV-1",
        revokedByUserId: "owner-1",
        tenantID: mockTenantID,
      });
      
      expect(mockDevice.save).not.toHaveBeenCalled();
      expect(result.status).toBe(DEVICE_STATUS.REVOKED);
    });

    test("Sukses mencabut akses, menghancurkan hash, mencatat jejak audit, dan memutus Cache", async () => {
      // REVISI: Tidak boleh meng-override penggunaID menjadi string "user-1", biarkan struktur aslinya (objek)
      const mockDevice = mockDeviceInstance(); 
      Device.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDevice)
      });

      const result = await deviceService.revokeDevice({
        installationId: "DEV-1",
        revokedByUserId: "owner-1",
        tenantID: mockTenantID,
      });

      expect(mockDevice.status).toBe(DEVICE_STATUS.REVOKED);
      expect(mockDevice.refreshTokenHash).toBeNull(); 
      expect(mockDevice.revokedBy).toBe("owner-1"); 
      expect(mockDevice.save).toHaveBeenCalled();
      expect(result.refreshTokenHash).toBeUndefined();
    });
  });

  describe("4. selfApproveDevice (Kepercayaan Terdelegasi Budi)", () => {
    // Pengujian di fungsi ini tetap aman dari TypeError karena fungsi ini di Service 
    // TIDAK menggunakan .populate(). Kita bisa memakai mockResolvedValue biasa.
    test("Gagal (404) jika Budi mencoba menyetujui perangkat milik orang lain", async () => {
      Device.findOne.mockResolvedValue(null);

      await expect(
        deviceService.selfApproveDevice({
          installationId: "HAPE-SITI",
          penggunaId: "budi-1",
        }),
      ).rejects.toThrow("Perangkat tidak ditemukan di antrean Anda");
    });

    test("Gagal (403) jika Budi mencoba menyetujui ulang perangkatnya yang sudah di-Revoke Owner", async () => {
      Device.findOne.mockResolvedValue(
        mockDeviceInstance({ status: DEVICE_STATUS.REVOKED }),
      );
      await expect(
        deviceService.selfApproveDevice({
          installationId: "BUDI-DEV2",
          penggunaId: "budi-1",
        }),
      ).rejects.toThrow("telah dicabut tidak dapat disetujui ulang");
    });

    test("Sukses self-approve perangkat sendiri jika kuota masih tersedia", async () => {
      const mockDevice = mockDeviceInstance({ penggunaID: "budi-1" }); // Ini aman menjadi string karena tidak ada .populate()
      Device.findOne.mockResolvedValue(mockDevice);
      Device.countDocuments.mockResolvedValue(1);

      const result = await deviceService.selfApproveDevice({
        installationId: "BUDI-DEV2",
        penggunaId: "budi-1",
      });

      expect(mockDevice.status).toBe(DEVICE_STATUS.TRUSTED);
      expect(mockDevice.approvedBy).toBe("budi-1");
      expect(mockDevice.save).toHaveBeenCalled();
      expect(result.status).toBe(DEVICE_STATUS.TRUSTED);
    });

    test("Gagal (400) jika Budi mencoba self-approve perangkat yang sudah TRUSTED", async () => {
      Device.findOne.mockResolvedValue(
        mockDeviceInstance({ status: DEVICE_STATUS.TRUSTED }),
      );
      await expect(
        deviceService.selfApproveDevice({
          installationId: "BUDI-DEV1",
          penggunaId: "budi-1",
        }),
      ).rejects.toThrow("sudah memiliki status Trusted");
    });

    test("Gagal (403) jika Budi mencoba self-approve namun kuota maksimal telah penuh", async () => {
      Device.findOne.mockResolvedValue(mockDeviceInstance());
      Device.countDocuments.mockResolvedValue(3);
      process.env.MAX_DEVICES_PER_USER = "3";

      await expect(
        deviceService.selfApproveDevice({
          installationId: "BUDI-DEV4",
          penggunaId: "budi-1",
        }),
      ).rejects.toThrow("Kuota maksimal (3) penuh");
    });
  });
});