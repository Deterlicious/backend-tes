const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const penggunaService = require("../../../services/penggunaService");
const Pengguna = require("../../../models/penggunaModel");
// MOCKING DEPENDENCIE
jest.mock("../../../models/penggunaModel");
jest.mock("../../../models/roleModel");
jest.mock("../../../config/redis", () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
}));

const REFRESH_SECRET =
  process.env.PENGGUNA_JWT_REFRESH_SECRET || "pengguna_refresh_secret";

describe("Unit Test Service — penggunaService.refreshToken", () => {
  const tenantID_asli = new mongoose.Types.ObjectId().toString();
  const userID = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper pembuat token
  function makeToken(payload) {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
  }

  // 1: validasi dasar & isolasi tenant
  describe("Validasi Dasar & Isolasi Tenant", () => {
    test("Menolak jika token kosong (null/undefined)", async () => {
      await expect(penggunaService.refreshToken(null)).rejects.toMatchObject({
        status: 401,
      });
    });

    test("Menolak jika token tidak sah atau hasil manipulasi (signature salah)", async () => {
      await expect(
        penggunaService.refreshToken("token.ngawur.banget"),
      ).rejects.toMatchObject({
        status: 403,
      });
    });

    test("Menolak jika tenantID di token dipalsukan (berbeda dengan DB)", async () => {
      const tenantPalsu = new mongoose.Types.ObjectId().toString();
      const token = makeToken({
        id: userID,
        tenantID: tenantPalsu,
        version: 1,
      });

      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: userID,
          tenantID: tenantID_asli, // DB pakai tenant asli
          tokenVersion: 1,
          roleID: { namaRole: "Staff" },
        }),
      });

      await expect(penggunaService.refreshToken(token)).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Token tidak valid untuk tenant ini/i),
      });
    });
  });

  // 2: validasi pengguna di web (Dashboard)
  describe("Validasi Refresh Token — Akses Web", () => {
    test("Menolak jika tokenVersion Root tertinggal (Sesi di-revoke)", async () => {
      // Token memiliki versi 1
      const token = makeToken({
        id: userID,
        tenantID: tenantID_asli,
        version: 1,
      });

      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: userID,
          tenantID: tenantID_asli,
          aksesType: "web",
          tokenVersion: 2, // DB sudah naik ke versi 2 (misal setelah ganti password)
          roleID: { namaRole: "Staff" },
        }),
      });

      await expect(penggunaService.refreshToken(token)).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Sesi tidak valid/i),
      });
    });

    test("Berhasil memperbarui token Web dan melakukan rotasi tokenVersion", async () => {
      const token = makeToken({
        id: userID,
        tenantID: tenantID_asli,
        version: 5,
      });

      const mockUser = {
        _id: userID,
        tenantID: tenantID_asli,
        aksesType: "web",
        tokenVersion: 5,
        roleID: { namaRole: "Manager" },
        save: jest.fn().mockResolvedValue(true),
        markModified: jest.fn(),
      };

      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await penggunaService.refreshToken(token);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      // Memastikan fungsi rotasi token (date.now) dipanggil sebelum save
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.tokenVersion).toBeGreaterThan(5);
    });
  });

  // 3: validasi pengguna di aplikasi (Kasir POS)
  describe("Validasi Refresh Token — Akses App (Device Binding)", () => {
    test("Menolak jika payload token tidak mencantumkan deviceID sama sekali", async () => {
      // Token tidak punya deviceID
      const token = makeToken({
        id: userID,
        tenantID: tenantID_asli,
        version: 1,
      });

      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: userID,
          tenantID: tenantID_asli,
          aksesType: "app", // Tipe aplikasi
          roleID: { namaRole: "Kasir" },
        }),
      });

      await expect(penggunaService.refreshToken(token)).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Device ID tidak ditemukan/i),
      });
    });

    test("Menolak jika deviceID di token tidak terdaftar di database (Device Hantu)", async () => {
      const token = makeToken({
        id: userID,
        tenantID: tenantID_asli,
        deviceID: "DEV-HANTU",
        version: 1,
      });

      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: userID,
          tenantID: tenantID_asli,
          aksesType: "app",
          device: [{ deviceID: "DEV-ASLI", tokenVersion: 1 }], // Dev hantu tidak ada di array
          roleID: { namaRole: "Kasir" },
        }),
      });

      await expect(penggunaService.refreshToken(token)).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Perangkat tidak dikenali/i),
      });
    });

    test("Menolak jika tokenVersion spesifik perangkat tertinggal (Device di-reset)", async () => {
      // Token membawa versi 1
      const token = makeToken({
        id: userID,
        tenantID: tenantID_asli,
        deviceID: "DEV-ASLI",
        version: 1,
      });

      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: userID,
          tenantID: tenantID_asli,
          aksesType: "app",
          device: [{ deviceID: "DEV-ASLI", tokenVersion: 2 }], // Versi perangkat sudah 2
          roleID: { namaRole: "Kasir" },
        }),
      });

      await expect(penggunaService.refreshToken(token)).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Sesi kedaluwarsa/i),
      });
    });

    test("Berhasil memperbarui token App dan melakukan rotasi spesifik pada perangkat", async () => {
      const token = makeToken({
        id: userID,
        tenantID: tenantID_asli,
        deviceID: "DEV-ASLI",
        version: 3,
      });

      const mockUser = {
        _id: userID,
        tenantID: tenantID_asli,
        aksesType: "app",
        roleID: { namaRole: "Kasir" },
        device: [
          {
            deviceID: "DEV-ASLI",
            tokenVersion: 3,
            lastUsed: new Date("2020-01-01"),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
        markModified: jest.fn(),
      };

      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await penggunaService.refreshToken(token);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(mockUser.markModified).toHaveBeenCalledWith("device");
      expect(mockUser.save).toHaveBeenCalled();

      // Pastikan hanya tokenVersion device yang berputar
      const rotatedDevice = mockUser.device[0];
      expect(rotatedDevice.tokenVersion).toBeGreaterThan(3);
      expect(rotatedDevice.lastUsed.getFullYear()).toBeGreaterThan(2020); // Pastikan lastUsed update
    });
  });

  // 4: validasi entitas hilang (orphan data)
  describe("Validasi Entitas Hilang (Orphan Data)", () => {
    test("Menolak dengan 401 jika pengguna sudah dihapus dari database", async () => {
      const token = makeToken({
        id: userID,
        tenantID: tenantID_asli,
        version: 1,
      });

      // Query database mengembalikan null (staf sudah dipecat/dihapus)
      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(penggunaService.refreshToken(token)).rejects.toMatchObject({
        status: 401,
      });
    });

    test("Menolak dengan 403/401 jika Role pengguna telah dihapus (Mencegah Fatal Crash)", async () => {
      const token = makeToken({
        id: userID,
        tenantID: tenantID_asli,
        version: 1,
      });

      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: userID,
          tenantID: tenantID_asli,
          aksesType: "web",
          tokenVersion: 1,
          roleID: null, // Role sudah dihapus, menyebabkan data orphan
        }),
      });

      // Menolak dengan elegan alih-alih melempar TypeError: Cannot read properties of null (reading '_id')
      await expect(penggunaService.refreshToken(token)).rejects.toMatchObject({
        status: expect.any(Number), // Memastikan melempar error HTTP, bukan TypeError bawaan Node.js
      });
    });
  });

  // 5: anomali transisi akses & sesi (bug fix regression tests)
  describe("Anomali Transisi Akses dan Sesi", () => {
    test("Menolak celah Cross-Platform: Token Web dipakai setelah akses diubah ke App", async () => {
      // Skenario: Pengguna awalnya punya akses "web". Dia login dan dapat refresh token (tanpa deviceID).
      const tokenWebLama = makeToken({
        id: userID,
        tenantID: tenantID_asli,
        version: 1,
      });

      // Tiba-tiba, manajer mengubah tipe akses pengguna ini menjadi "app" di database.
      Pengguna.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: userID,
          tenantID: tenantID_asli,
          aksesType: "app", // Tipe akses telah bermutasi!
          roleID: { namaRole: "Staff" },
          device: [],
        }),
      });

      // Saat token web lama mencoba refresh, sistem harus memperlakukannya sebagai akses app
      // dan langsung memblokirnya karena token tersebut tidak membawa deviceID.
      await expect(
        penggunaService.refreshToken(tokenWebLama),
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Device ID tidak ditemukan/i),
      });
    });

    test("Menolak dengan 403 spesifik saat Refresh Token benar-benar kedaluwarsa secara alami", async () => {
      const tokenExpired = "token.yang.sudah.basi.waktunya";
      
      const expiredError = new Error("jwt expired");
      expiredError.name = "TokenExpiredError";
      
      // GUNAKAN jest.spyOn UNTUK MEMBAJAK FUNGSI ASLI SEMENTARA
      const verifySpy = jest.spyOn(jwt, "verify").mockImplementationOnce(() => { 
        throw expiredError; 
      });

      await expect(penggunaService.refreshToken(tokenExpired)).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/tidak valid atau kadaluwarsa/i),
      });

      // KEMBALIKAN FUNGSI KE ASLINYA SETELAH TEST SELESAI
      verifySpy.mockRestore();
    });
  });
});
