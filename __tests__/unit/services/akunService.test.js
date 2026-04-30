const akunService = require("../../../services/akunService");
const Akun = require("../../../models/akunModel");
const redis = require("../../../config/redis");
const jwt = require("jsonwebtoken");

// 1. MOCKING DATABASE (MONGOOSE)
jest.mock("../../../models/akunModel", () => {
  const mAkun = {
    save: jest.fn(),
    toObject: jest.fn(),
    comparePin: jest.fn(),
  };
  const mockModel = jest.fn(() => mAkun);
  mockModel.findOne = jest.fn();
  mockModel.findById = jest.fn();
  mockModel.findByIdAndUpdate = jest.fn();
  mockModel.findByIdAndDelete = jest.fn();
  mockModel.find = jest.fn();
  return mockModel;
});

// 2. MOCKING CACHE (REDIS)
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}));

// 3. MOCKING JWT
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe("Unit Test — Akun Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Fungsi register()", () => {
    const payload = { email: "toko1@gmail.com", password: "Password123!" };

    test("Harus sukses mendaftarkan akun baru dan mengembalikan data tanpa password", async () => {
      Akun.findOne.mockResolvedValue(null);
      const mockInstance = new Akun();
      mockInstance.save.mockResolvedValue(true);
      mockInstance.toObject.mockReturnValue({
        _id: "mock_id_123",
        email: payload.email,
        password: "hashed_password",
        username: null,
        __v: 0,
      });

      const result = await akunService.register(payload);

      expect(Akun.findOne).toHaveBeenCalledWith({ email: payload.email });
      expect(mockInstance.save).toHaveBeenCalled();
      expect(result).toHaveProperty("email", payload.email);
      expect(result.password).toBeUndefined();
      expect(result.__v).toBeUndefined();
    });

    test("Harus melempar error 400 jika email sudah terdaftar", async () => {
      Akun.findOne.mockResolvedValue({ email: payload.email });
      await expect(akunService.register(payload)).rejects.toThrow("Email sudah terdaftar.");
    });
  });

  describe("Fungsi login()", () => {
    const payload = { email: "toko1@gmail.com", password: "Password123!" };

    test("Harus sukses login, update tokenVersion, dan kembalikan token", async () => {
      const mockDbUser = {
        _id: "mock_id_123",
        email: payload.email,
        tokenVersion: 100,
        comparePin: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ email: payload.email }),
      };

      Akun.findOne.mockResolvedValue(mockDbUser);
      jwt.sign.mockReturnValue("mocked_token"); // Mock hasil JWT

      const result = await akunService.login(payload);

      expect(mockDbUser.comparePin).toHaveBeenCalledWith(payload.password);
      expect(mockDbUser.save).toHaveBeenCalled();
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });

    test("Harus melempar error 404 jika email tidak ditemukan", async () => {
      Akun.findOne.mockResolvedValue(null);
      await expect(akunService.login(payload)).rejects.toThrow("Email tidak ditemukan.");
    });

    test("Harus melempar error 400 jika password salah", async () => {
      Akun.findOne.mockResolvedValue({
        comparePin: jest.fn().mockResolvedValue(false),
      });
      await expect(akunService.login(payload)).rejects.toThrow("Password salah.");
    });
  });

  describe("Fungsi getProfile()", () => {
    test("Harus mengambil data dari Redis (Cache Hit) jika tersedia", async () => {
      const cachedProfile = { _id: "123", email: "toko1@gmail.com" };
      redis.get.mockResolvedValue(JSON.stringify(cachedProfile));

      const result = await akunService.getProfile("123");

      expect(Akun.findById).not.toHaveBeenCalled();
      expect(result).toEqual(cachedProfile);
    });

    test("Harus query ke DB (Cache Miss) jika redis kosong", async () => {
      redis.get.mockResolvedValue(null);
      Akun.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "123" }) })
      });

      await akunService.getProfile("123");
      expect(Akun.findById).toHaveBeenCalledWith("123");
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe("Fungsi refreshToken()", () => {
    test("Harus melempar 403 jika token kedaluwarsa atau JWT tidak valid", async () => {
      jwt.verify.mockImplementation(() => { throw new Error("jwt expired"); });
      
      await expect(akunService.refreshToken("bad_token")).rejects.toThrow(/tidak valid atau kedaluwarsa/i);
    });

    test("Harus melempar 403 jika tokenVersion tidak cocok (Sesi dibajak/dicabut)", async () => {
      // Token membawa versi 100
      jwt.verify.mockReturnValue({ id: "123", version: 100 });
      // Database mencatat versi 200 (Berarti user sudah ganti password/logout)
      Akun.findById.mockResolvedValue({ _id: "123", tokenVersion: 200 });

      await expect(akunService.refreshToken("valid_token")).rejects.toThrow(/kedaluwarsa|login ulang/i);
    });

    test("Harus sukses merotasi tokenVersion dan mengembalikan token baru", async () => {
      jwt.verify.mockReturnValue({ id: "123", version: 100 });
      
      const mockDbUser = {
        _id: "123",
        tokenVersion: 100, // Versi cocok
        save: jest.fn().mockResolvedValue(true),
      };
      Akun.findById.mockResolvedValue(mockDbUser);
      jwt.sign.mockReturnValue("new_mock_token");

      const result = await akunService.refreshToken("valid_token");

      // Pastikan tokenVersion diupdate
      expect(mockDbUser.tokenVersion).not.toBe(100); 
      expect(mockDbUser.save).toHaveBeenCalled();
      expect(result).toHaveProperty("accessToken");
    });
  });

  describe("Fungsi logout()", () => {
    test("Harus membunuh sesi dengan mengubah tokenVersion menjadi 0", async () => {
      jwt.verify.mockReturnValue({ id: "123" });
      const mockDbUser = {
        _id: "123",
        tokenVersion: 100,
        save: jest.fn().mockResolvedValue(true),
      };
      Akun.findById.mockResolvedValue(mockDbUser);

      await akunService.logout("some_token");

      expect(mockDbUser.tokenVersion).toBe(0); // Sesi mutlak mati
      expect(mockDbUser.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled(); // Cache harus dibersihkan
    });

    test("Harus diam-diam mengabaikan jika token sudah tidak valid (Graceful exit)", async () => {
      jwt.verify.mockImplementation(() => { throw new Error("invalid token"); });
      
      // Seharusnya tidak melempar error, hanya return/abaikan
      await expect(akunService.logout("bad_token")).resolves.not.toThrow();
    });
  });

  describe("Fungsi updateProfile()", () => {
    test("Harus sukses memperbarui profile dan membersihkan cache redis", async () => {
      const payload = { username: "Toko Baru" };
      Akun.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: "123", username: "Toko Baru" })
        })
      });

      const result = await akunService.updateProfile("123", payload);

      expect(Akun.findByIdAndUpdate).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled(); // Memastikan cache profile dihapus
      expect(result.username).toBe("Toko Baru");
    });
  });

  describe("Keamanan Validasi Input (Register & Login)", () => {
    test("Harus melempar error 400 jika payload register tidak valid (misal: format email salah)", async () => {
      const badPayload = { email: "bukan-email", password: "123" };
      await expect(akunService.register(badPayload)).rejects.toThrow();
      expect(Akun.findOne).not.toHaveBeenCalled(); // Pastikan DB tidak disentuh jika validasi gagal
    });

    test("Harus melempar error 400 jika payload login kosong", async () => {
      await expect(akunService.login({})).rejects.toThrow();
      expect(Akun.findOne).not.toHaveBeenCalled();
    });
  });

  describe("Skenario Spesifik Fungsi updateProfile()", () => {
    test("Harus menghapus cache KEY_ALL_USERS jika email ikut diperbarui", async () => {
      const payload = { email: "emailbaru@gmail.com" };
      Akun.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: "123", email: "emailbaru@gmail.com" })
        })
      });

      await akunService.updateProfile("123", payload);

      // Pastikan redis.del dipanggil dua kali (1 untuk profil individu, 1 untuk list all users)
      expect(redis.del).toHaveBeenCalledWith("akun:profile:123");
      expect(redis.del).toHaveBeenCalledWith("akun:all_users");
    });
  });

  describe("Fungsi getAllUsers() (Admin Only)", () => {
    test("Harus mengambil daftar semua pengguna dari Redis (Cache Hit)", async () => {
      const cachedUsers = [{ _id: "1", email: "a@a.com" }, { _id: "2", email: "b@b.com" }];
      redis.get.mockResolvedValue(JSON.stringify(cachedUsers));

      const result = await akunService.getAllUsers();

      expect(redis.get).toHaveBeenCalledWith("akun:all_users");
      expect(Akun.find).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    test("Harus query DB jika Redis kosong dan menyimpannya ke cache", async () => {
      redis.get.mockResolvedValue(null);
      const dbUsers = [{ _id: "1" }];
      Akun.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(dbUsers)
        })
      });

      const result = await akunService.getAllUsers();

      expect(Akun.find).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith("akun:all_users", JSON.stringify(dbUsers), "EX", 60);
      expect(result).toEqual(dbUsers);
    });
  });

  describe("Fungsi deleteUserByAdmin() (Admin Only)", () => {
    test("Harus melempar error 400 jika admin mencoba menghapus akunnya sendiri", async () => {
      // targetUserId == requesterId
      await expect(akunService.deleteUserByAdmin("admin123", "admin123")).rejects.toThrow(
        "Tidak dapat menghapus akun Anda sendiri."
      );
      expect(Akun.findByIdAndDelete).not.toHaveBeenCalled();
    });

    test("Harus melempar error 404 jika target user yang akan dihapus tidak ditemukan", async () => {
      Akun.findByIdAndDelete.mockResolvedValue(null);

      await expect(akunService.deleteUserByAdmin("ghostUser", "admin123")).rejects.toThrow(
        "Pengguna tidak ditemukan."
      );
    });

    test("Harus sukses menghapus user dan membersihkan cache individu & global", async () => {
      Akun.findByIdAndDelete.mockResolvedValue({ _id: "target123" });

      const result = await akunService.deleteUserByAdmin("target123", "admin123");

      expect(Akun.findByIdAndDelete).toHaveBeenCalledWith("target123");
      // Memastikan cache dihapus secara tuntas
      expect(redis.del).toHaveBeenCalledWith("akun:profile:target123");
      expect(redis.del).toHaveBeenCalledWith("akun:all_users");
      expect(result).toBe(true);
    });
  });

  describe("Skenario Edge Cases (Anomali & Pertahanan Lapis Baja)", () => {
    test("refreshToken: Harus melempar 401 jika pengguna sudah dihapus dari DB (Orphan Token)", async () => {
      // Skenario: JWT Valid, tapi user sudah lenyap dari database
      jwt.verify.mockReturnValue({ id: "123", version: 100 });
      Akun.findById.mockResolvedValue(null);

      await expect(akunService.refreshToken("valid_token_but_deleted_user")).rejects.toThrow(
        /Pengguna tidak ditemukan/i
      );
    });

    test("refreshToken: Harus melempar 401 jika parameter token sama sekali tidak ada", async () => {
      await expect(akunService.refreshToken(null)).rejects.toThrow(
        /tidak ditemukan/i
      );
    });

    test("logout: Harus berhenti dengan aman (graceful) jika tidak ada token yang dikirim", async () => {
      // Tidak boleh melempar error, harus langsung return diam-diam
      await expect(akunService.logout(undefined)).resolves.not.toThrow();
      expect(jwt.verify).not.toHaveBeenCalled();
    });

    test("getProfile: Harus mengembalikan null jika Cache Miss dan data benar-benar tidak ada di DB", async () => {
      redis.get.mockResolvedValue(null);
      // Rantai Mongoose mengembalikan null
      Akun.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null)
        })
      });

      const result = await akunService.getProfile("ghost_id");
      expect(result).toBeNull();
      // Pastikan redis.set tidak dipanggil untuk menyimpan data null
      expect(redis.set).not.toHaveBeenCalled();
    });

    test("updateProfile: Harus mengabaikan field berbahaya (Mencegah Mass Assignment)", async () => {
      // Skenario: Peretas mencoba menyelundupkan perubahan hak akses dan password
      const maliciousPayload = { 
        username: "Toko Aman", 
        role: "admin", 
        password: "hacked_password" 
      };
      
      Akun.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: "123", username: "Toko Aman" })
        })
      });

      await akunService.updateProfile("123", maliciousPayload);

      // Verifikasi bahwa findByIdAndUpdate MENGABAIKAN properti role dan password,
      // dan HANYA meneruskan properti yang aman
      expect(Akun.findByIdAndUpdate).toHaveBeenCalledWith(
        "123",
        expect.not.objectContaining({ role: "admin", password: "hacked_password" }),
        expect.any(Object)
      );
    });
  });

  describe("Simulasi Bencana Infrastruktur & Anomali Ekstrim (Disaster Recovery)", () => {
    test("Database Crash: Harus melempar error sistem jika koneksi MongoDB terputus saat register", async () => {
      // Skenario: MongoDB mati mendadak saat sedang mencari email
      Akun.findOne.mockRejectedValue(new Error("MongoNetworkError: connection closed"));

      await expect(akunService.register({ email: "toko1@gmail.com", password: "Passworcx123!" }))
        .rejects.toThrow("MongoNetworkError");
    });

    test("Redis Crash: Harus melempar error jika server Redis mati mendadak saat getProfile", async () => {
      // Skenario: Redis down atau kehabisan memori
      redis.get.mockRejectedValue(new Error("Redis connection to 127.0.0.1:6379 failed"));

      await expect(akunService.getProfile("123"))
        .rejects.toThrow("Redis connection");
      
      // Pastikan database tidak ikut diserang jika Redis sedang kacau balau
      expect(Akun.findById).not.toHaveBeenCalled(); 
    });

    test("Database Crash: Harus melempar error sistem jika MongoDB gagal menyimpan rotasi refreshToken", async () => {
      jwt.verify.mockReturnValue({ id: "123", version: 100 });
      
      const mockDbUser = {
        _id: "123",
        tokenVersion: 100,
        save: jest.fn().mockRejectedValue(new Error("ValidationError: tokenVersion is required")),
      };
      Akun.findById.mockResolvedValue(mockDbUser);

      await expect(akunService.refreshToken("valid_token"))
        .rejects.toThrow("ValidationError");
    });

    test("Logout Anomaly: Harus tetap aman (graceful exit) jika akun terhapus dari DB di detik yang sama saat logout", async () => {
      // Skenario: Token sah, tetapi user sudah dihapus oleh Admin (Orphan User)
      jwt.verify.mockReturnValue({ id: "123" });
      Akun.findById.mockResolvedValue(null); // Database mengembalikan kosong

      // Sistem tidak boleh crash (TypeError: Cannot read properties of null), 
      // melainkan harus diam-diam membiarkan sesi mati.
      await expect(akunService.logout("valid_token_but_deleted_user")).resolves.not.toThrow();
    });
  });
});