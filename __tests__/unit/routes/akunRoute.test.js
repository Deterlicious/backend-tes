const express = require("express");
const request = require("supertest");
const authAkun = require("../../../middleware/authAkun");
const authPengguna = require("../../../middleware/authPengguna");
const { adminOnly } = require("../../../middleware/authorize");
const { checkPermission } = require("../../../middleware/authorizePermission");

// 1. MOCK REDIS (Mencegah Open Handles dari utilitas luar)
jest.mock("../../../config/redis", () => ({
  on: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}));

// 2. MOCK CONTROLLER & MIDDLEWARE
jest.mock("../../../controllers/akunController", () => ({
  register: jest.fn(),
  login: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
  getAllAkun: jest.fn(),
  deleteUserByAdmin: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
}));
jest.mock("../../../middleware/authAkun");
jest.mock("../../../middleware/authPengguna");
jest.mock("../../../middleware/authorize");
jest.mock("../../../middleware/authorizePermission");

const akunController = require("../../../controllers/akunController");

describe("Integration Test — Akun Route Gateways", () => {
  let app;
  let mockAuthAkunFail = false;
  let mockAuthPenggunaFail = false;
  let mockAdminOnlyFail = false;
  let mockPermissionFail = false;

  beforeAll(() => {
    // Setup Mock authAkun (Token A - Level Akun SaaS)
    authAkun.mockImplementation((req, res, next) => {
      if (mockAuthAkunFail) {
        return res.status(401).json({ message: "Akses ditolak. Token akun tidak ditemukan." });
      }
      req.akunContext = { akunID: "mock-akun-id-123", roleAkun: "owner", tenantID: "mock-tenant-id-123" };
      req.userDecoded = { id: "mock-akun-id-123", tenantID: "mock-tenant-id-123" };
      next();
    });

    // Setup Mock authPengguna (Token C - Level Sesi Kasir)
    authPengguna.mockImplementation((req, res, next) => {
      if (mockAuthPenggunaFail) {
        return res.status(401).json({ message: "Akses ditolak. Token pengguna tidak ditemukan." });
      }
      req.pengguna = { id: "user-123", tenantID: "mock-tenant-id-123" };
      req.userDecoded = { id: "user-123", tenantID: "mock-tenant-id-123" };
      next();
    });

    // Setup Mock adminOnly
    adminOnly.mockImplementation((req, res, next) => {
      if (mockAdminOnlyFail) {
        return res.status(403).json({ message: "Akses ditolak. Rute ini hanya untuk admin." });
      }
      next();
    });

    // Setup Mock checkPermission
    checkPermission.mockImplementation((...allowedPermissions) => (req, res, next) => {
      if (mockPermissionFail) {
        return res.status(403).json({ message: "Akses ditolak. Anda tidak memiliki salah satu dari izin berikut." });
      }
      next();
    });

    // Setup Mock Controller Responses agar me-return 200 jika berhasil lewat middleware
    akunController.register.mockImplementation((req, res) => res.status(200).json({ trigger: "register" }));
    akunController.login.mockImplementation((req, res) => res.status(200).json({ trigger: "login" }));
    akunController.refreshToken.mockImplementation((req, res) => res.status(200).json({ trigger: "refreshToken" }));
    akunController.logout.mockImplementation((req, res) => res.status(200).json({ trigger: "logout" }));
    akunController.getAllAkun.mockImplementation((req, res) => res.status(200).json({ trigger: "getAllAkun" }));
    akunController.deleteUserByAdmin.mockImplementation((req, res) => res.status(200).json({ trigger: "deleteUserByAdmin" }));
    akunController.getProfile.mockImplementation((req, res) => res.status(200).json({ trigger: "getProfile" }));
    akunController.updateProfile.mockImplementation((req, res) => res.status(200).json({ trigger: "updateProfile" }));

    // Setup Express App
    const akunRoute = require("../../../routes/akunRoute");
    app = express();
    app.use(express.json());
    app.use("/akun", akunRoute);

    // Global Error Handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    mockAuthAkunFail = false;
    mockAuthPenggunaFail = false;
    mockAdminOnlyFail = false;
    mockPermissionFail = false;
    jest.clearAllMocks();
  });

  // =====================================================================
  // BAGIAN 1: RUTE PUBLIK (Tanpa Token)
  // =====================================================================
  describe("1. Rute Publik (Tanpa Auth)", () => {

    describe("POST /akun/auth/register", () => {
      test("Meloloskan (200) langsung ke Controller tanpa auth", async () => {
        const res = await request(app).post("/akun/auth/register").send({});
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("register");
      });
    });

    describe("POST /akun/auth/login", () => {
      test("Meloloskan (200) langsung ke Controller tanpa auth", async () => {
        const res = await request(app).post("/akun/auth/login").send({});
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("login");
      });
    });

    describe("POST /akun/auth/refreshtoken", () => {
      test("Meloloskan (200) langsung ke Controller tanpa auth", async () => {
        const res = await request(app).post("/akun/auth/refreshtoken").send({});
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("refreshToken");
      });
    });

    describe("POST /akun/auth/logout", () => {
      test("Meloloskan (200) langsung ke Controller tanpa auth", async () => {
        const res = await request(app).post("/akun/auth/logout").send({});
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("logout");
      });
    });
  });

  // =====================================================================
  // BAGIAN 2: RUTE ADMIN (authAkun + adminOnly)
  // =====================================================================
  describe("2. Rute Admin (authAkun + adminOnly)", () => {

    describe("GET /akun/admin/all", () => {
      test("Menolak (401) jika Token Akun tidak ada/invalid", async () => {
        mockAuthAkunFail = true;
        const res = await request(app).get("/akun/admin/all");
        expect(res.status).toBe(401);
      });

      test("Menolak (403) jika Token Akun valid tapi bukan admin", async () => {
        mockAdminOnlyFail = true;
        const res = await request(app).get("/akun/admin/all");
        expect(res.status).toBe(403);
      });

      test("Meloloskan (200) ke Controller jika Token Akun valid dan role admin", async () => {
        const res = await request(app).get("/akun/admin/all");
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("getAllAkun");
      });
    });

    describe("DELETE /akun/admin/users/:id", () => {
      test("Menolak (401) jika Token Akun tidak ada/invalid", async () => {
        mockAuthAkunFail = true;
        const res = await request(app).delete("/akun/admin/users/mock-akun-id-999");
        expect(res.status).toBe(401);
      });

      test("Menolak (403) jika Token Akun valid tapi bukan admin", async () => {
        mockAdminOnlyFail = true;
        const res = await request(app).delete("/akun/admin/users/mock-akun-id-999");
        expect(res.status).toBe(403);
      });

      test("Meloloskan (200) ke Controller jika Token Akun valid dan role admin", async () => {
        const res = await request(app).delete("/akun/admin/users/mock-akun-id-999");
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("deleteUserByAdmin");
      });
    });
  });

  // =====================================================================
  // BAGIAN 3: RUTE PROFIL (checkPermission + authPengguna)
  // =====================================================================
  describe("3. Rute Profil (checkPermission + authPengguna)", () => {

    describe("GET /akun/profil", () => {
      test("Menolak (403) jika tidak memegang izin 'read-akun'", async () => {
        mockPermissionFail = true;
        const res = await request(app).get("/akun/profil");
        expect(res.status).toBe(403);
      });

      test("Menolak (401) jika izin valid tapi Token Pengguna tidak ada/invalid", async () => {
        mockAuthPenggunaFail = true;
        const res = await request(app).get("/akun/profil");
        expect(res.status).toBe(401);
      });

      test("Meloloskan (200) ke Controller jika izin dan Token Pengguna valid", async () => {
        const res = await request(app).get("/akun/profil");
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("getProfile");
      });
    });

    describe("PUT /akun/profil/update", () => {
      test("Menolak (403) jika tidak memegang izin 'update-akun'", async () => {
        mockPermissionFail = true;
        const res = await request(app).put("/akun/profil/update").send({});
        expect(res.status).toBe(403);
      });

      test("Menolak (401) jika izin valid tapi Token Pengguna tidak ada/invalid", async () => {
        mockAuthPenggunaFail = true;
        const res = await request(app).put("/akun/profil/update").send({});
        expect(res.status).toBe(401);
      });

      test("Meloloskan (200) ke Controller jika izin dan Token Pengguna valid", async () => {
        const res = await request(app).put("/akun/profil/update").send({});
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("updateProfile");
      });
    });
  });
});