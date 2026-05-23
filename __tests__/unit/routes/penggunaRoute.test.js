const express = require("express");
const request = require("supertest");
const authAkun = require("../../../middleware/authAkun");
const authPengguna = require("../../../middleware/authPengguna");
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
jest.mock("../../../controllers/penggunaController", () => ({
  refreshToken: jest.fn(),
  registerOwner: jest.fn(),
  loginPin: jest.fn(),
  checkOwner: jest.fn(),
  logout: jest.fn(),
  create: jest.fn(),
  getAll: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));
jest.mock("../../../middleware/authAkun");
jest.mock("../../../middleware/authPengguna");
jest.mock("../../../middleware/authorizePermission");

const penggunaController = require("../../../controllers/penggunaController");

describe("Integration Test — Pengguna Route Gateways", () => {
  let app;
  let mockAuthAkunFail = false;
  let mockAuthPenggunaFail = false;
  let mockPermissionFail = false;

  beforeAll(() => {
    // Setup Mock authAkun (Token A - Level Akun SaaS)
    authAkun.mockImplementation((req, res, next) => {
      if (mockAuthAkunFail) {
        return res.status(401).json({ message: "Akses ditolak. Token akun tidak ditemukan." });
      }
      req.akunContext = { tenantID: "mock-tenant-id-123" };
      next();
    });

    // Setup Mock authPengguna (Token C - Level Sesi Kasir)
    authPengguna.mockImplementation((req, res, next) => {
      if (mockAuthPenggunaFail) {
        return res.status(401).json({ message: "Akses ditolak. Token pengguna tidak ditemukan." });
      }
      req.pengguna = { id: "user-123", tenantID: "mock-tenant-id-123" };
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
    penggunaController.refreshToken.mockImplementation((req, res) => res.status(200).json({ trigger: "refreshToken" }));
    penggunaController.registerOwner.mockImplementation((req, res) => res.status(200).json({ trigger: "registerOwner" }));
    penggunaController.loginPin.mockImplementation((req, res) => res.status(200).json({ trigger: "loginPin" }));
    penggunaController.checkOwner.mockImplementation((req, res) => res.status(200).json({ trigger: "checkOwner" }));
    penggunaController.logout.mockImplementation((req, res) => res.status(200).json({ trigger: "logout" }));
    penggunaController.create.mockImplementation((req, res) => res.status(200).json({ trigger: "create" }));
    penggunaController.getAll.mockImplementation((req, res) => res.status(200).json({ trigger: "getAll" }));
    penggunaController.getById.mockImplementation((req, res) => res.status(200).json({ trigger: "getById" }));
    penggunaController.update.mockImplementation((req, res) => res.status(200).json({ trigger: "update" }));
    penggunaController.delete.mockImplementation((req, res) => res.status(200).json({ trigger: "delete" }));

    // Setup Express App
    const penggunaRoute = require("../../../routes/penggunaRoute");
    app = express();
    app.use(express.json());
    app.use("/api/pengguna", penggunaRoute);

    // Global Error Handler untuk menangkap error dari fungsi 'createError' di Validator
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    mockAuthAkunFail = false;
    mockAuthPenggunaFail = false;
    mockPermissionFail = false;
    jest.clearAllMocks();
  });

  // =====================================================================
  // BAGIAN 1: RUTE PUBLIK / SEMI-PUBLIK
  // =====================================================================
  describe("1. Rute Publik / Semi-Publik", () => {
    describe("POST /api/pengguna/pin-refresh", () => {
      test("Meloloskan (200) langsung ke Controller tanpa auth", async () => {
        const res = await request(app).post("/api/pengguna/pin-refresh").send({});
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("refreshToken");
      });
    });
  });

  // =====================================================================
  // BAGIAN 2: RUTE LEVEL AKUN (Membutuhkan Token A / authAkun)
  // =====================================================================
  describe("2. Rute Level Akun (authAkun)", () => {
    
    describe("POST /api/pengguna/register-owner", () => {
      test("Menolak (401) jika Token Akun tidak ada/invalid", async () => {
        mockAuthAkunFail = true;
        const res = await request(app).post("/api/pengguna/register-owner").send({});
        expect(res.status).toBe(401);
      });
      test("Meloloskan (200) ke Controller jika Token Akun valid", async () => {
        const res = await request(app).post("/api/pengguna/register-owner").send({});
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("registerOwner");
      });
    });

    describe("GET /api/pengguna/check-owner", () => {
      test("Menolak (401) jika Token Akun tidak ada/invalid", async () => {
        mockAuthAkunFail = true;
        const res = await request(app).get("/api/pengguna/check-owner");
        expect(res.status).toBe(401);
      });
      test("Meloloskan (200) ke Controller jika Token Akun valid", async () => {
        const res = await request(app).get("/api/pengguna/check-owner");
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("checkOwner");
      });
    });

    describe("POST /api/pengguna/pin-login (Dengan Validator Ketat)", () => {
      test("Mencegat (401) jika Token Akun (Token A) invalid", async () => {
        mockAuthAkunFail = true;
        const res = await request(app).post("/api/pengguna/pin-login").send({});
        expect(res.status).toBe(401);
      });

      test("Mencegat (400) jika payload login sama sekali kosong", async () => {
        const res = await request(app).post("/api/pengguna/pin-login").send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Data login kosong/i);
      });

      test("Mencegat (400) jika mencoba NoSQL Injection pada field nama", async () => {
        const res = await request(app).post("/api/pengguna/pin-login").send({
          nama: { $ne: null },
          pin: "123456",
          loginType: "web"
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Format nama tidak valid atau kosong/i);
      });

      test("Mencegat (400) jika loginType tidak disertakan", async () => {
        const res = await request(app).post("/api/pengguna/pin-login").send({
          nama: "Kasir Valid",
          pin: "123456"
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/loginType wajib disertakan/i);
      });

      test("Mencegat (400) jika loginType 'app' tapi installationId tidak disertakan", async () => {
        const res = await request(app).post("/api/pengguna/pin-login").send({
          nama: "Kasir Valid",
          pin: "123456",
          loginType: "app" 
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/installationId wajib disertakan/i);
      });

      test("Meloloskan (200) ke Controller jika semua format valid (App Login)", async () => {
        const res = await request(app).post("/api/pengguna/pin-login").send({
          nama: "Kasir Valid",
          pin: "123456",
          loginType: "app",
          installationId: "DEV-MAC-001"
        });
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("loginPin");
      });
    });
  });

  // =====================================================================
  // BAGIAN 3: RUTE LEVEL PENGGUNA (Membutuhkan Token C / authPengguna)
  // =====================================================================
  describe("3. Rute Level Pengguna (authPengguna & checkPermission)", () => {
    
    describe("POST /api/pengguna/pin-logout", () => {
      test("Menolak (401) jika Token Pengguna tidak ada/invalid", async () => {
        mockAuthPenggunaFail = true;
        const res = await request(app).post("/api/pengguna/pin-logout").send({});
        expect(res.status).toBe(401);
      });
      test("Meloloskan (200) ke Controller tanpa cek permission", async () => {
        const res = await request(app).post("/api/pengguna/pin-logout").send({});
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("logout");
      });
    });

    describe("POST /api/pengguna/register-pengguna", () => {
      test("Menolak (401) jika Token Pengguna tidak ada/invalid", async () => {
        mockAuthPenggunaFail = true;
        const res = await request(app).post("/api/pengguna/register-pengguna").send({});
        expect(res.status).toBe(401);
      });
      test("Menolak (403) jika tidak memegang izin 'create-pengguna'", async () => {
        mockPermissionFail = true;
        const res = await request(app).post("/api/pengguna/register-pengguna").send({});
        expect(res.status).toBe(403);
      });
      test("Meloloskan (200) ke Controller jika auth dan izin valid", async () => {
        const res = await request(app).post("/api/pengguna/register-pengguna").send({});
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("create");
      });
    });

    describe("GET /api/pengguna", () => {
      test("Menolak (403) jika tidak memegang izin 'read-pengguna'", async () => {
        mockPermissionFail = true;
        const res = await request(app).get("/api/pengguna");
        expect(res.status).toBe(403);
      });
      test("Meloloskan (200) ke Controller jika auth dan izin valid", async () => {
        const res = await request(app).get("/api/pengguna");
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("getAll");
      });
    });

    describe("GET /api/pengguna/:id", () => {
      test("Menolak (403) jika tidak memegang izin 'read-pengguna'", async () => {
        mockPermissionFail = true;
        const res = await request(app).get("/api/pengguna/user-123");
        expect(res.status).toBe(403);
      });
      test("Meloloskan (200) ke Controller jika auth dan izin valid", async () => {
        const res = await request(app).get("/api/pengguna/user-123");
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("getById");
      });
    });

    describe("PUT /api/pengguna/:id", () => {
      test("Menolak (403) jika tidak memegang izin 'update-pengguna'", async () => {
        mockPermissionFail = true;
        const res = await request(app).put("/api/pengguna/user-123").send({});
        expect(res.status).toBe(403);
      });
      test("Meloloskan (200) ke Controller jika auth dan izin valid", async () => {
        const res = await request(app).put("/api/pengguna/user-123").send({});
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("update");
      });
    });

    describe("DELETE /api/pengguna/:id", () => {
      test("Menolak (403) jika tidak memegang izin 'delete-pengguna'", async () => {
        mockPermissionFail = true;
        const res = await request(app).delete("/api/pengguna/user-123");
        expect(res.status).toBe(403);
      });
      test("Meloloskan (200) ke Controller jika auth dan izin valid", async () => {
        const res = await request(app).delete("/api/pengguna/user-123");
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("delete");
      });
    });
  });
});