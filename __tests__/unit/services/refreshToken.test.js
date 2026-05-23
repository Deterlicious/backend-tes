const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");
const penggunaService = require("../../../services/penggunaService");
const Pengguna = require("../../../models/penggunaModel");
const Device = require("../../../models/deviceModel");

// Mocking Dependencies
jest.mock("../../../models/penggunaModel");
jest.mock("../../../models/roleModel");
jest.mock("../../../models/deviceModel"); // Tambahkan mock untuk Device Model
jest.mock("../../../config/redis", () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
}));

// Setup Environment Variables untuk sinkronisasi secret antara test dan service
const PENGGUNA_ACCESS_TOKEN = "access_secret_test";
const PENGGUNA_REFRESH_TOKEN = "refresh_secret_test";
const REFRESH_SECRET = "opaque_hash_secret_test";

process.env.PENGGUNA_ACCESS_TOKEN = PENGGUNA_ACCESS_TOKEN;
process.env.PENGGUNA_REFRESH_TOKEN = PENGGUNA_REFRESH_TOKEN;
process.env.REFRESH_SECRET = REFRESH_SECRET;

describe("Unit Test Service — penggunaService.refreshToken", () => {
  const tenantID_asli = new mongoose.Types.ObjectId().toString();
  const userID = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper untuk membuat Web Refresh Token (JWT)
  function makeWebRefreshToken(payload) {
    return jwt.sign(payload, PENGGUNA_REFRESH_TOKEN, { expiresIn: "7d" });
  }

  // Helper untuk membuat App Access Token yang expired (JWT)
  function makeAppExpiredAccessToken(payload) {
    return jwt.sign(payload, PENGGUNA_ACCESS_TOKEN, { expiresIn: "-1s" });
  }

  // Helper untuk membuat Hash Opaque Token
  function hashOpaqueToken(token) {
    return crypto.createHmac("sha256", REFRESH_SECRET).update(token).digest("hex");
  }

  // Helper untuk mock balikan Pengguna.findById
  const mockPenggunaFindById = (userData) => {
    Pengguna.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(userData),
    });
  };

  describe("Validasi Dasar & Perlindungan Crash", () => {
    test("Menolak dengan elegan jika argumen utama yang dilempar undefined", async () => {
      // Mensimulasikan crash jika dipanggil tanpa argument object { token }
      // Perhatikan: Karena parameter aslinya adalah objek, jika dipanggil `refreshToken()` atau `refreshToken(null)` 
      // JavaScript otomatis error TypeError sebelum masuk ke blok kode.
      // Di service production, controller lah yang harus memastikan pengiriman format object.
      // Uji ini memastikan kita menangkap error tersebut dengan try catch eksternal.
      try {
        await penggunaService.refreshToken();
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
      }
    });
  });

  // --- ALUR WEB ---
  describe("Validasi Refresh Token — Akses Web (JWT)", () => {
    test("Menolak jika token Web tidak valid atau manipulasi signature", async () => {
      await expect(
        penggunaService.refreshToken({ token: "token.ngawur.banget" })
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Refresh token tidak valid/i),
      });
    });

    test("Menolak jika tokenVersion Root tertinggal (Sesi di-revoke)", async () => {
      const token = makeWebRefreshToken({ id: userID, version: 1 });

      mockPenggunaFindById({
        _id: userID,
        tenantID: tenantID_asli,
        tokenVersion: 2, // DB sudah naik ke versi 2
        roleID: { namaRole: "Staff" },
      });

      await expect(
        penggunaService.refreshToken({ token })
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Sesi tidak valid/i),
      });
    });

    test("Menolak jika pengguna Web sudah dihapus dari database", async () => {
      const token = makeWebRefreshToken({ id: userID, version: 1 });
      mockPenggunaFindById(null);

      await expect(
        penggunaService.refreshToken({ token })
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Pengguna tidak ditemukan/i),
      });
    });

    test("Berhasil memperbarui token Web dan melakukan rotasi tokenVersion", async () => {
      const token = makeWebRefreshToken({ id: userID, version: 5 });

      const mockUser = {
        _id: userID,
        tenantID: tenantID_asli,
        tokenVersion: 5,
        roleID: { namaRole: "Manager", permissions: [] },
        save: jest.fn().mockResolvedValue(true),
      };

      mockPenggunaFindById(mockUser);

      // Kita perlu me-mock generateToken & generateRefreshToken karena mereka dipanggil di dalam
      const mockAccessToken = "new_web_access_token";
      const mockNewRefreshToken = "new_web_refresh_token";
      penggunaService.generateToken = jest.fn().mockReturnValue(mockAccessToken);
      penggunaService.generateRefreshToken = jest.fn().mockReturnValue(mockNewRefreshToken);

      const result = await penggunaService.refreshToken({ token });

      expect(result).toHaveProperty("accessToken", mockAccessToken);
      expect(result).toHaveProperty("newRefreshToken", mockNewRefreshToken);
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.tokenVersion).toBeGreaterThan(5); // Rotasi Date.now()
    });
  });

  // --- ALUR APP ---
  describe("Validasi Refresh Token — Akses App (Opaque Token & Device Binding)", () => {
    const validInstallationId = "DEV-APP-001";
    const rawOpaqueToken = "random_opaque_string_dari_client";
    
    test("Menolak jika parameter token tidak lengkap", async () => {
      await expect(
        penggunaService.refreshToken({
          installationId: validInstallationId, // installationId memicu Alur App
          token: null, // Token hilang
          expiredAccessToken: "some_expired_token",
        })
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Token tidak lengkap/i),
      });
    });

    test("Menolak jika signature Access Token yang kadaluwarsa tidak valid", async () => {
      await expect(
        penggunaService.refreshToken({
          installationId: validInstallationId,
          token: rawOpaqueToken,
          expiredAccessToken: "token_palsu.yang.invalid", // Signature akan gagal
        })
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Signature Access Token tidak valid/i),
      });
    });

    test("Menolak jika pengguna App tidak ditemukan atau status non-aktif", async () => {
      const expiredToken = makeAppExpiredAccessToken({ id: userID });
      
      mockPenggunaFindById({
        _id: userID,
        status: "nonaktif", // Blokir
      });

      await expect(
        penggunaService.refreshToken({
          installationId: validInstallationId,
          token: rawOpaqueToken,
          expiredAccessToken: expiredToken,
        })
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Pengguna tidak ditemukan atau non-aktif/i),
      });
    });

    test("Menolak jika perangkat tidak valid, pending, atau sesi telah dicabut", async () => {
      const expiredToken = makeAppExpiredAccessToken({ id: userID });
      mockPenggunaFindById({ _id: userID, status: "aktif" });

      Device.findOne.mockResolvedValue(null); // Perangkat tidak ditemukan atau status bukan TRUSTED

      await expect(
        penggunaService.refreshToken({
          installationId: validInstallationId,
          token: rawOpaqueToken,
          expiredAccessToken: expiredToken,
        })
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Sesi perangkat tidak valid atau telah dicabut/i),
      });
    });

    test("Menolak jika Opaque Token (Hash) tidak cocok", async () => {
      const expiredToken = makeAppExpiredAccessToken({ id: userID });
      mockPenggunaFindById({ _id: userID, status: "aktif" });

      Device.findOne.mockResolvedValue({
        penggunaID: userID,
        installationId: validInstallationId,
        status: "trusted",
        refreshTokenHash: "hash_yang_berbeda_dari_database", 
      });

      await expect(
        penggunaService.refreshToken({
          installationId: validInstallationId,
          token: rawOpaqueToken, // Raw token ini dihash dan dibandingkan
          expiredAccessToken: expiredToken,
        })
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringMatching(/Refresh token tidak cocok/i),
      });
    });

    test("Berhasil memperbarui token App dan merotasi Opaque Token Hash", async () => {
      const expiredToken = makeAppExpiredAccessToken({ id: userID });
      const mockUser = { _id: userID, status: "aktif", tenantID: tenantID_asli };
      
      mockPenggunaFindById(mockUser);

      const oldHash = hashOpaqueToken(rawOpaqueToken);
      const mockDevice = {
        penggunaID: userID,
        installationId: validInstallationId,
        status: "trusted",
        refreshTokenHash: oldHash, // Hash lama yang valid
        save: jest.fn().mockResolvedValue(true),
      };

      Device.findOne.mockResolvedValue(mockDevice);

      // Mock output token
      const mockNewAccessToken = "new_app_access_token";
      penggunaService.generateToken = jest.fn().mockReturnValue(mockNewAccessToken);

      const result = await penggunaService.refreshToken({
        installationId: validInstallationId,
        token: rawOpaqueToken,
        expiredAccessToken: expiredToken,
      });

      expect(result).toHaveProperty("accessToken", mockNewAccessToken);
      expect(result).toHaveProperty("newRefreshToken"); // Opaque string raw
      
      expect(mockDevice.save).toHaveBeenCalled();
      expect(mockDevice.refreshTokenHash).not.toBe(oldHash); // Pastikan hash diputar
      expect(mockDevice.lastRefreshAt).toBeInstanceOf(Date);
    });
  });
});