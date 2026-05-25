const akunService = require("../../../services/akunService");
const Akun = require("../../../models/akunModel");
const redis = require("../../../config/redis");
const jwt = require("jsonwebtoken");

jest.mock("../../../models/akunModel", () => {
  const mAkun = {
    save: jest.fn(),
    toObject: jest.fn(),
    comparePassword: jest.fn(),
  };
  const mockModel = jest.fn(() => mAkun);
  mockModel.findOne = jest.fn();
  mockModel.findById = jest.fn();
  mockModel.findByIdAndUpdate = jest.fn();
  mockModel.findByIdAndDelete = jest.fn();
  mockModel.find = jest.fn();
  mockModel.updateMany = jest.fn();
  return mockModel;
});

jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe("Unit Test — Akun Service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("generateTokens()", () => {
    test("Payload accessToken harus mengandung id, role, dan version", () => {
      jwt.sign.mockReturnValue("mock_token");
      const mockAkun = {
        _id: "akun_123",
        role: "client",
        tokenVersion: 100,
        tenantID: null,
      };

      akunService.generateTokens(mockAkun);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "akun_123",
          role: "client",
          version: 100,
        }),
        expect.any(String),
        expect.objectContaining({ expiresIn: "15m" }),
      );
    });

    test("tenantID masuk ke payload jika akun sudah punya tenant", () => {
      jwt.sign.mockReturnValue("mock_token");
      const mockAkun = {
        _id: "akun_123",
        role: "client",
        tokenVersion: 100,
        tenantID: "tenant_456",
      };

      akunService.generateTokens(mockAkun);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tenantID: "tenant_456" }),
        expect.any(String),
        expect.any(Object),
      );
    });

    test("tenantID tidak masuk ke payload jika akun belum punya tenant", () => {
      jwt.sign.mockReturnValue("mock_token");
      const mockAkun = {
        _id: "akun_123",
        role: "client",
        tokenVersion: 100,
        tenantID: null,
      };

      akunService.generateTokens(mockAkun);

      // jwt.sign dipanggil 2x — accessToken dan refreshToken
      // pastikan tidak ada yang punya tenantID
      const calls = jwt.sign.mock.calls;
      calls.forEach((call) => {
        expect(call[0]).not.toHaveProperty("tenantID");
      });
    });

    test("refreshToken harus punya expiresIn 7d", () => {
      jwt.sign.mockReturnValue("mock_token");
      const mockAkun = {
        _id: "akun_123",
        role: "client",
        tokenVersion: 100,
        tenantID: null,
      };

      akunService.generateTokens(mockAkun);

      // jwt.sign dipanggil 2x, yang kedua adalah refreshToken
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ id: "akun_123", version: 100 }),
        expect.any(String),
        expect.objectContaining({ expiresIn: "7d" }),
      );
    });
  });

  // REGISTER
  describe("register()", () => {
    const payload = { email: "toko1@gmail.com", password: "Password123!" };

    test("Sukses mendaftarkan akun baru dan mengembalikan data tanpa password dan __v", async () => {
      Akun.findOne.mockResolvedValue(null);

      // FIX: Gunakan prototype untuk me-mock instance method bawaan Mongoose
      Akun.prototype.save = jest.fn().mockResolvedValue(true);
      Akun.prototype.toObject = jest.fn().mockReturnValue({
        _id: "mock_id_123",
        email: payload.email,
        password: "hashed_password",
        username: null,
        __v: 0,
      });

      const result = await akunService.register(payload);

      expect(Akun.findOne).toHaveBeenCalledWith({ email: payload.email });
      expect(Akun.prototype.save).toHaveBeenCalled();
      expect(result).toHaveProperty("email", payload.email);
      expect(result.password).toBeUndefined();
      expect(result.__v).toBeUndefined();
    });

    test("Gagal (409) jika email sudah terdaftar", async () => {
      Akun.findOne.mockResolvedValue({ email: payload.email });
      await expect(akunService.register(payload)).rejects.toThrow(
        "Email sudah terdaftar.",
      );
    });

    test("Gagal (400) jika format email tidak valid", async () => {
      const badPayload = { email: "bukan-email", password: "Password123!" };
      await expect(akunService.register(badPayload)).rejects.toThrow();
      expect(Akun.findOne).not.toHaveBeenCalled();
    });

    test("Gagal (400) jika payload kosong", async () => {
      await expect(akunService.register({})).rejects.toThrow();
      expect(Akun.findOne).not.toHaveBeenCalled();
    });

    test("Melempar error sistem jika MongoDB crash saat cek email", async () => {
      Akun.findOne.mockRejectedValue(
        new Error("MongoNetworkError: connection closed"),
      );
      await expect(akunService.register(payload)).rejects.toThrow(
        "MongoNetworkError",
      );
    });
  });

  // LOGIN
  describe("login()", () => {
    const payload = { email: "toko1@gmail.com", password: "Password123!" };

    test("Sukses login, tokenVersion diupdate, dan mengembalikan accessToken + refreshToken", async () => {
      const mockDbUser = {
        _id: "mock_id_123",
        email: payload.email,
        tokenVersion: 100,
        // FIX: comparePassword bukan comparePin
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ email: payload.email }),
      };

      Akun.findOne.mockResolvedValue(mockDbUser);
      jwt.sign.mockReturnValue("mocked_token");

      const result = await akunService.login(payload);

      expect(mockDbUser.comparePassword).toHaveBeenCalledWith(payload.password);
      expect(mockDbUser.save).toHaveBeenCalled();
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });

    test("Gagal (404) jika email tidak ditemukan", async () => {
      Akun.findOne.mockResolvedValue(null);
      await expect(akunService.login(payload)).rejects.toThrow(
        "Email tidak ditemukan.",
      );
    });

    test("Gagal (400) jika password salah", async () => {
      Akun.findOne.mockResolvedValue({
        // FIX: comparePassword bukan comparePin
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      await expect(akunService.login(payload)).rejects.toThrow(
        "Password salah.",
      );
    });

    test("Gagal (400) jika payload login kosong", async () => {
      await expect(akunService.login({})).rejects.toThrow();
      expect(Akun.findOne).not.toHaveBeenCalled();
    });
  });

  // GET PROFILE
  describe("getProfile()", () => {
    test("[CACHE HIT] Mengembalikan data dari Redis", async () => {
      const cachedProfile = { _id: "akun_123", email: "toko1@gmail.com" };
      redis.get.mockResolvedValue(JSON.stringify(cachedProfile));

      // FIX: Tambahkan mock untuk rantai Mongoose (findOne -> select -> lean)
      // karena Service akan selalu melakukan query ini DULU sebelum mengecek Redis
      Akun.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockResolvedValue({ _id: "akun_123", tenantID: "tenant_123" }),
        }),
      });

      const result = await akunService.getProfile("tenant_123");

      expect(Akun.findOne).toHaveBeenCalledWith({ tenantID: "tenant_123" });
      expect(redis.get).toHaveBeenCalledWith(
        expect.stringContaining("akun:profile:akun_123"),
      );
      expect(result).toEqual(cachedProfile);
    });

    test("[CACHE MISS] Query ke DB via findOne({ tenantID }) lalu simpan ke Redis", async () => {
      redis.get.mockResolvedValue(null);
      const dbAkun = { _id: "akun_123", email: "toko1@gmail.com" };

      // FIX: service pakai findOne({ tenantID }) bukan findById
      Akun.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(dbAkun),
        }),
      });

      const result = await akunService.getProfile("tenant_123");

      expect(Akun.findOne).toHaveBeenCalledWith({ tenantID: "tenant_123" });
      expect(redis.set).toHaveBeenCalled();
      expect(result).toEqual(dbAkun);
    });

    test("Gagal (404) jika cache miss dan akun tidak ditemukan di DB", async () => {
      redis.get.mockResolvedValue(null);

      // FIX: service throw 404, bukan return null
      Akun.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(akunService.getProfile("tenant_ghost")).rejects.toThrow(
        /Akun tidak ditemukan/i,
      );
      expect(redis.set).not.toHaveBeenCalled();
    });

    test("Melempar error jika Redis crash", async () => {
      // FIX: Sediakan jalan (mock) untuk Mongoose agar bisa lanjut ke baris Redis
      Akun.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockResolvedValue({ _id: "akun_123", tenantID: "tenant_123" }),
        }),
      });

      redis.get.mockRejectedValue(
        new Error("Redis connection to 127.0.0.1:6379 failed"),
      );

      await expect(akunService.getProfile("tenant_123")).rejects.toThrow(
        "Redis connection",
      );
    });
  });

  // REFRESH TOKEN
  describe("refreshToken()", () => {
    test("Sukses merotasi tokenVersion dan mengembalikan token baru", async () => {
      jwt.verify.mockReturnValue({ id: "akun_123", version: 100 });
      const mockDbUser = {
        _id: "akun_123",
        tokenVersion: 100,
        save: jest.fn().mockResolvedValue(true),
      };
      Akun.findById.mockResolvedValue(mockDbUser);
      jwt.sign.mockReturnValue("new_mock_token");

      const result = await akunService.refreshToken("valid_token");

      expect(mockDbUser.tokenVersion).not.toBe(100);
      expect(mockDbUser.save).toHaveBeenCalled();
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });

    test("Gagal (403) jika token kedaluwarsa atau tidak valid", async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });
      await expect(akunService.refreshToken("bad_token")).rejects.toThrow(
        /tidak valid atau kedaluwarsa/i,
      );
    });

    test("Gagal (403) jika tokenVersion tidak cocok — sesi sudah dicabut", async () => {
      jwt.verify.mockReturnValue({ id: "akun_123", version: 100 });
      Akun.findById.mockResolvedValue({ _id: "akun_123", tokenVersion: 200 });

      await expect(akunService.refreshToken("valid_token")).rejects.toThrow(
        /kedaluwarsa|login ulang/i,
      );
    });

    test("Gagal (401) jika token valid tapi akun sudah dihapus dari DB", async () => {
      jwt.verify.mockReturnValue({ id: "akun_123", version: 100 });
      Akun.findById.mockResolvedValue(null);

      await expect(
        akunService.refreshToken("valid_token_but_deleted_user"),
      ).rejects.toThrow(/Pengguna tidak ditemukan/i);
    });

    test("Gagal (401) jika token null atau tidak dikirim", async () => {
      await expect(akunService.refreshToken(null)).rejects.toThrow(
        /tidak ditemukan/i,
      );
    });

    test("Melempar error sistem jika MongoDB crash saat save rotasi token", async () => {
      jwt.verify.mockReturnValue({ id: "akun_123", version: 100 });
      const mockDbUser = {
        _id: "akun_123",
        tokenVersion: 100,
        save: jest
          .fn()
          .mockRejectedValue(
            new Error("ValidationError: tokenVersion is required"),
          ),
      };
      Akun.findById.mockResolvedValue(mockDbUser);

      await expect(akunService.refreshToken("valid_token")).rejects.toThrow(
        "ValidationError",
      );
    });
  });

  // LOGOUT
  describe("logout()", () => {
    test("Sukses — tokenVersion di-set ke 0 dan cache dihapus", async () => {
      jwt.verify.mockReturnValue({ id: "akun_123" });
      const mockDbUser = {
        _id: "akun_123",
        tokenVersion: 100,
        save: jest.fn().mockResolvedValue(true),
      };
      Akun.findById.mockResolvedValue(mockDbUser);

      await akunService.logout("some_token");

      expect(mockDbUser.tokenVersion).toBe(0);
      expect(mockDbUser.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
    });

    test("Diam-diam resolve jika refresh token tidak valid", async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("invalid token");
      });
      await expect(akunService.logout("bad_token")).resolves.not.toThrow();
    });

    test("Diam-diam resolve jika akun sudah dihapus dari DB saat logout", async () => {
      jwt.verify.mockReturnValue({ id: "akun_123" });
      Akun.findById.mockResolvedValue(null);

      await expect(
        akunService.logout("valid_token_but_deleted_user"),
      ).resolves.not.toThrow();
    });

    test("Tidak memanggil jwt.verify jika tidak ada token yang dikirim", async () => {
      await expect(akunService.logout(undefined)).resolves.not.toThrow();
      expect(jwt.verify).not.toHaveBeenCalled();
    });

    test("Sukses blacklist access token ke Redis jika dikirim", async () => {
      const fakeExp = Math.floor(Date.now() / 1000) + 900; // masih 15 menit
      jwt.verify
        .mockReturnValueOnce({ id: "akun_123" }) // untuk refresh token
        .mockReturnValueOnce({ exp: fakeExp }); // untuk access token

      const mockDbUser = {
        _id: "akun_123",
        tokenVersion: 100,
        save: jest.fn().mockResolvedValue(true),
      };
      Akun.findById.mockResolvedValue(mockDbUser);

      await akunService.logout("refresh_token", "access_token");

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining("bl_"),
        "blacklisted",
        "EX",
        expect.any(Number),
      );
    });
  });

  // UPDATE PROFILE
  describe("updateProfile()", () => {
    const createMockAkun = (overrides = {}) => ({
      _id: "akun_123",
      email: "toko1@gmail.com",
      username: "Toko Lama",
      password: "hashed_old",
      tenantID: "tenant_123",
      comparePassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnValue({
        _id: "akun_123",
        email: "toko1@gmail.com",
        username: "Toko Lama",
      }),
      ...overrides,
    });

    test("Sukses memperbarui username dan cache dihapus", async () => {
      const mockAkun = createMockAkun();
      // FIX: Gunakan findOne, bukan findById
      Akun.findOne.mockResolvedValue(mockAkun);

      const result = await akunService.updateProfile("tenant_123", {
        username: "Toko Baru",
      });

      expect(Akun.findOne).toHaveBeenCalledWith({ tenantID: "tenant_123" });
      expect(mockAkun.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
    });

    test("Cache KEY_ALL_USERS juga dihapus jika email ikut diperbarui", async () => {
      const mockAkun = createMockAkun();
      Akun.findOne.mockResolvedValue(mockAkun);

      await akunService.updateProfile("tenant_123", {
        email: "emailbaru@gmail.com",
      });

      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining("akun:profile:"),
      );
      expect(redis.del).toHaveBeenCalledWith("akun:all_users");
    });

    test("Sukses ganti password jika oldPassword benar", async () => {
      const mockAkun = createMockAkun({
        comparePassword: jest.fn().mockResolvedValue(true),
      });
      Akun.findOne.mockResolvedValue(mockAkun);

      await akunService.updateProfile("tenant_123", {
        password: "NewPassword123!",
        oldPassword: "OldPassword123!",
      });

      expect(mockAkun.comparePassword).toHaveBeenCalledWith("OldPassword123!");
      expect(mockAkun.password).toBe("NewPassword123!");
      expect(mockAkun.save).toHaveBeenCalled();
    });

    test("Gagal (400) jika mencoba ganti password tanpa menyertakan oldPassword", async () => {
      const mockAkun = createMockAkun();
      Akun.findOne.mockResolvedValue(mockAkun);

      await expect(
        akunService.updateProfile("tenant_123", {
          password: "NewPassword123!",
        }),
      ).rejects.toThrow(/Password lama wajib/i);
    });

    test("Gagal (400) jika oldPassword salah", async () => {
      const mockAkun = createMockAkun({
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      Akun.findOne.mockResolvedValue(mockAkun);

      await expect(
        akunService.updateProfile("tenant_123", {
          password: "NewPassword123!",
          oldPassword: "PasswordSalah!",
        }),
      ).rejects.toThrow(/Password lama tidak sesuai/i);
    });

    test("Gagal (404) jika akun tidak ditemukan", async () => {
      Akun.findOne.mockResolvedValue(null);

      await expect(
        akunService.updateProfile("tenant_ghost", { username: "Baru" }),
      ).rejects.toThrow(/Akun tidak ditemukan/i);
    });
  });

  // GET ALL AKUN (Admin Only)
  describe("getAllAkun()", () => {
    test("[CACHE HIT] Mengembalikan daftar semua akun dari Redis", async () => {
      const cachedUsers = [
        { _id: "1", email: "a@a.com" },
        { _id: "2", email: "b@b.com" },
      ];
      // Mock pengecekan role admin
      Akun.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ role: "admin" }),
        }),
      });
      redis.get.mockResolvedValue(JSON.stringify(cachedUsers));

      // FIX: nama fungsi getAllAkun bukan getAllUsers, dan butuh requesterId
      const result = await akunService.getAllAkun("admin_123");

      expect(redis.get).toHaveBeenCalledWith("akun:all_users");
      expect(Akun.find).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    test("[CACHE MISS] Query DB lalu simpan ke Redis", async () => {
      Akun.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ role: "admin" }),
        }),
      });
      redis.get.mockResolvedValue(null);
      const dbUsers = [{ _id: "1" }];
      Akun.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(dbUsers),
        }),
      });

      const result = await akunService.getAllAkun("admin_123");

      expect(Akun.find).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(
        "akun:all_users",
        JSON.stringify(dbUsers),
        "EX",
        60,
      );
      expect(result).toEqual(dbUsers);
    });

    test("Gagal (403) jika yang request bukan admin", async () => {
      // FIX: skenario baru — non-admin tidak boleh akses
      Akun.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ role: "client" }),
        }),
      });

      await expect(akunService.getAllAkun("client_123")).rejects.toThrow(
        /Forbidden/i,
      );
      expect(Akun.find).not.toHaveBeenCalled();
    });
  });

  // DELETE USER BY ADMIN (Admin Only)
  describe("deleteUserByAdmin()", () => {
    test("Sukses menghapus user dan membersihkan cache individu dan global", async () => {
      // FIX: harus mock pengecekan role admin
      Akun.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ role: "admin" }),
        }),
      });
      Akun.findByIdAndDelete.mockResolvedValue({ _id: "target_123" });

      const result = await akunService.deleteUserByAdmin(
        "target_123",
        "admin_123",
      );

      expect(Akun.findByIdAndDelete).toHaveBeenCalledWith("target_123");
      expect(redis.del).toHaveBeenCalledWith("akun:profile:target_123");
      expect(redis.del).toHaveBeenCalledWith("akun:all_users");
      expect(result).toBe(true);
    });

    test("Gagal (403) jika yang request bukan admin", async () => {
      // FIX: skenario baru — non-admin tidak boleh hapus
      Akun.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ role: "client" }),
        }),
      });

      await expect(
        akunService.deleteUserByAdmin("target_123", "client_123"),
      ).rejects.toThrow(/Forbidden/i);
      expect(Akun.findByIdAndDelete).not.toHaveBeenCalled();
    });

    test("Gagal (404) jika target user tidak ditemukan", async () => {
      Akun.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ role: "admin" }),
        }),
      });
      Akun.findByIdAndDelete.mockResolvedValue(null);

      await expect(
        akunService.deleteUserByAdmin("ghost_user", "admin_123"),
      ).rejects.toThrow("Pengguna tidak ditemukan.");
    });
  });
});
