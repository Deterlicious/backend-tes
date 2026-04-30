const akunController = require("../../../controllers/akunController");
const akunService = require("../../../services/akunService");

jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}));

// 2. MOCKING SERVICE EKSPLISIT (PASTIKAN SEMUANYA ADA DI SINI)
jest.mock("../../../services/akunService", () => ({
  register: jest.fn(),
  login: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  logout: jest.fn(),
  getAllAkun: jest.fn(),
  deleteUser: jest.fn(),
  refreshToken: jest.fn(), // <--- Titik krusial yang dicari oleh Jest
}));

// 3. FUNGSI PEMBANTU UNTUK MOCK REQ, RES, NEXT
const mockRequest = (data = {}) => ({ ...data });
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn();

describe("Unit Test — Akun Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Fungsi register()", () => {
    test("Harus mengembalikan status 201 dan JSON saat sukses", async () => {
      const req = mockRequest({ body: { email: "test@gmail.com", password: "123" } });
      const res = mockResponse();
      
      const mockResult = { id: "123", email: "test@gmail.com" };
      akunService.register.mockResolvedValue(mockResult);

      await akunController.register(req, res, mockNext);

      expect(akunService.register).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Registrasi berhasil.",
        data: mockResult,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("Harus melempar error ke next() jika service gagal", async () => {
      const req = mockRequest({ body: {} });
      const res = mockResponse();
      const error = new Error("Validasi gagal");
      
      akunService.register.mockRejectedValue(error);

      await akunController.register(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("Fungsi login()", () => {
    test("Harus sukses login dan mengembalikan JSON dengan token", async () => {
      const req = mockRequest({ body: { email: "test@gmail.com", password: "123" } });
      const res = mockResponse();
      
      const mockResult = {
        user: { id: "123", email: "test@gmail.com" },
        accessToken: "access_token_123",
        refreshToken: "refresh_token_123"
      };
      akunService.login.mockResolvedValue(mockResult);

      // Karena setRefreshTokenCookie memanipulasi 'res', 
      // kita asumsikan fungsi aslinya akan memanggil res.cookie
      // Jika error, pastikan path/mocking helper cookie disesuaikan
      await akunController.login(req, res, mockNext);

      expect(akunService.login).toHaveBeenCalledWith(req.body);
      expect(res.json).toHaveBeenCalledWith({
        message: "Login berhasil.",
        data: mockResult.user,
        accessToken: mockResult.accessToken,
        refreshToken: mockResult.refreshToken,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("Fungsi getProfile()", () => {
    test("Harus mengambil profile berdasarkan ID dari token (req.akun.id)", async () => {
      const req = mockRequest({ akun: { id: "user_123" } });
      const res = mockResponse();
      const mockResult = { email: "test@gmail.com" };
      
      akunService.getProfile.mockResolvedValue(mockResult);

      await akunController.getProfile(req, res, mockNext);

      expect(akunService.getProfile).toHaveBeenCalledWith("user_123");
      expect(res.json).toHaveBeenCalledWith({
        message: "Profil berhasil diambil.",
        data: mockResult,
      });
    });
  });

  describe("Fungsi updateProfile()", () => {
    test("Harus meneruskan req.akun.id dan req.body ke service", async () => {
      const req = mockRequest({ 
        akun: { id: "user_123" },
        body: { username: "Toko 1" } 
      });
      const res = mockResponse();
      
      akunService.updateProfile.mockResolvedValue({ username: "Toko 1" });

      await akunController.updateProfile(req, res, mockNext);

      expect(akunService.updateProfile).toHaveBeenCalledWith("user_123", req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: "Profil berhasil diperbarui."
      }));
    });
  });

  describe("Fungsi logout()", () => {
    test("Harus memanggil service logout dan membersihkan cookie", async () => {
      const req = mockRequest({ cookies: { refreshToken: "token_123" } });
      const res = mockResponse();
      
      akunService.logout.mockResolvedValue(true);

      await akunController.logout(req, res, mockNext);

      expect(akunService.logout).toHaveBeenCalledWith("token_123");
      // Menguji apakah res.cookie dipanggil dengan instruksi penghancuran (maxAge: 0)
      expect(res.cookie).toHaveBeenCalledWith("refreshToken", "", expect.objectContaining({
        maxAge: 0,
      }));
      expect(res.json).toHaveBeenCalledWith({ message: "Logout berhasil." });
    });

    test("Harus bisa mengambil token dari body jika cookie kosong", async () => {
      const req = mockRequest({ body: { refreshToken: "token_body_123" } });
      const res = mockResponse();

      await akunController.logout(req, res, mockNext);

      expect(akunService.logout).toHaveBeenCalledWith("token_body_123");
    });
  });

  describe("Rute Admin (getAllAkun & deleteUserByAdmin)", () => {
    test("getAllAkun: Harus mengembalikan list user", async () => {
      const req = mockRequest();
      const res = mockResponse();
      const mockList = [{ id: "1" }, { id: "2" }];
      
      akunService.getAllAkun.mockResolvedValue(mockList);

      await akunController.getAllAkun(req, res, mockNext);

      expect(akunService.getAllAkun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Semua akun berhasil diambil.",
        data: mockList,
      });
    });

    test("deleteUserByAdmin: Harus meneruskan req.params.id ke service", async () => {
      const req = mockRequest({ params: { id: "target_123" } });
      const res = mockResponse();

      akunService.deleteUser.mockResolvedValue(true);

      await akunController.deleteUserByAdmin(req, res, mockNext);

      expect(akunService.deleteUser).toHaveBeenCalledWith("target_123");
      expect(res.json).toHaveBeenCalledWith({
        message: "Akun berhasil dihapus oleh admin.",
      });
    });
  });

  describe("Fungsi refreshToken() (Jalur yang Terlupakan)", () => {
    test("Harus sukses merotasi token dan mengembalikan JSON", async () => {
      // Skenario: Token dikirim lewat cookie
      const req = mockRequest({ cookies: { refreshToken: "old_token_123" } });
      const res = mockResponse();
      
      const mockResult = {
        accessToken: "new_access_123",
        refreshToken: "new_refresh_123"
      };
      akunService.refreshToken.mockResolvedValue(mockResult);

      await akunController.refreshToken(req, res, mockNext);

      expect(akunService.refreshToken).toHaveBeenCalledWith("old_token_123");
      expect(res.json).toHaveBeenCalledWith({
        message: "Token berhasil diperbarui.",
        accessToken: mockResult.accessToken,
        refreshToken: mockResult.refreshToken,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("Harus mengambil token dari body jika cookie kosong", async () => {
      const req = mockRequest({ cookies: {}, body: { refreshToken: "body_token" } });
      const res = mockResponse();
      akunService.refreshToken.mockResolvedValue({ accessToken: "a", refreshToken: "b" });

      await akunController.refreshToken(req, res, mockNext);
      expect(akunService.refreshToken).toHaveBeenCalledWith("body_token");
    });
  });

  describe("Keandalan Error Handling (Propagasi ke next)", () => {
    const errorSistem = new Error("Database Meledak");

    test("login: Harus melempar error ke next()", async () => {
      const req = mockRequest({ body: {} });
      const res = mockResponse();
      akunService.login.mockRejectedValue(errorSistem);

      await akunController.login(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(errorSistem);
    });

    test("getProfile: Harus melempar error ke next()", async () => {
      const req = mockRequest({ akun: { id: "1" } });
      const res = mockResponse();
      akunService.getProfile.mockRejectedValue(errorSistem);

      await akunController.getProfile(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(errorSistem);
    });

    test("updateProfile: Harus melempar error ke next()", async () => {
      const req = mockRequest({ akun: { id: "1" }, body: {} });
      const res = mockResponse();
      akunService.updateProfile.mockRejectedValue(errorSistem);

      await akunController.updateProfile(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(errorSistem);
    });

    test("logout: Harus melempar error ke next()", async () => {
      const req = mockRequest({ cookies: { refreshToken: "x" } });
      const res = mockResponse();
      akunService.logout.mockRejectedValue(errorSistem);

      await akunController.logout(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(errorSistem);
    });

    test("refreshToken: Harus melempar error ke next()", async () => {
      const req = mockRequest({ cookies: { refreshToken: "x" } });
      const res = mockResponse();
      akunService.refreshToken.mockRejectedValue(errorSistem);

      await akunController.refreshToken(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(errorSistem);
    });

    test("Rute Admin: Harus melempar error ke next()", async () => {
      const req = mockRequest({ params: { id: "1" } });
      const res = mockResponse();
      
      akunService.getAllAkun.mockRejectedValue(errorSistem);
      await akunController.getAllAkun(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(errorSistem);

      // Reset mockNext untuk pengetesan kedua
      mockNext.mockClear(); 

      akunService.deleteUser.mockRejectedValue(errorSistem);
      await akunController.deleteUserByAdmin(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(errorSistem);
    });
  });

  describe("Pertahanan Internal Controller (Edge Cases & Kehampaan Data)", () => {
    test("refreshToken: Harus melempar error 401 langsung dari Controller jika token mutlak tidak ada", async () => {
      // Skenario: Tidak ada token di cookies, tidak ada token di body
      const req = mockRequest({ cookies: {}, body: {} });
      const res = mockResponse();

      await akunController.refreshToken(req, res, mockNext);

      // Pastikan Service SAMA SEKALI TIDAK dipanggil karena sudah dicegat Controller
      expect(akunService.refreshToken).not.toHaveBeenCalled();
      
      // Pastikan error dilempar ke next()
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    test("logout: Harus diam-diam clear cookie tanpa memanggil service jika token kosong", async () => {
      // Skenario: User memanggil logout tapi tokennya memang sudah tidak ada
      const req = mockRequest({ cookies: {}, body: {} });
      const res = mockResponse();

      await akunController.logout(req, res, mockNext);

      // Service tidak boleh dipanggil untuk membuang-buang resource
      expect(akunService.logout).not.toHaveBeenCalled();
      
      // Tapi cookie tetap harus dipastikan hancur
      expect(res.cookie).toHaveBeenCalledWith("refreshToken", "", expect.objectContaining({ maxAge: 0 }));
      expect(res.json).toHaveBeenCalledWith({ message: "Logout berhasil." });
    });

    test("Defensif: Aplikasi tidak boleh crash (TypeError) jika req.cookies undefined dari Express", async () => {
      // Skenario: Middleware cookie parser bocor/mati sehingga req.cookies adalah undefined
      // Sistem harus cerdas dan fallback menggunakan {} secara aman
      const req = mockRequest({ body: { refreshToken: "token_darurat" } });
      delete req.cookies; // Memaksa undefined
      const res = mockResponse();
      
      akunService.refreshToken.mockResolvedValue({ accessToken: "a", refreshToken: "b" });

      await akunController.refreshToken(req, res, mockNext);

      // Harus berhasil mengambil dari body tanpa crash
      expect(akunService.refreshToken).toHaveBeenCalledWith("token_darurat");
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});