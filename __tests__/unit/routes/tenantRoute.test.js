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
jest.mock("../../../controllers/tenantController", () => ({
  getAll: jest.fn(),
  createWithOwner: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));
jest.mock("../../../middleware/authAkun");
jest.mock("../../../middleware/authPengguna");
jest.mock("../../../middleware/authorize");
jest.mock("../../../middleware/authorizePermission");

const tenantController = require("../../../controllers/tenantController");

describe("Integration Test — Tenant Route Gateways", () => {
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

    // Setup Mock Controller Responses
    tenantController.getAll.mockImplementation((req, res) => res.status(200).json({ trigger: "getAll" }));
    tenantController.createWithOwner.mockImplementation((req, res) => res.status(200).json({ trigger: "createWithOwner" }));
    tenantController.getById.mockImplementation((req, res) => res.status(200).json({ trigger: "getById" }));
    tenantController.update.mockImplementation((req, res) => res.status(200).json({ trigger: "update" }));
    tenantController.delete.mockImplementation((req, res) => res.status(200).json({ trigger: "delete" }));

    // Setup Express App
    const tenantRoute = require("../../../routes/tenantRoute");
    app = express();
    app.use(express.json());
    app.use("/tenant", tenantRoute);

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
  // BAGIAN 1: GET / — Daftar Semua Tenant (adminOnly + authAkun)
  // =====================================================================
  describe("1. GET /tenant — Daftar Semua Tenant (adminOnly → authAkun)", () => {
    // CATATAN: Urutan middleware di route adalah adminOnly DULU, baru authAkun.
    // Maka 403 dari adminOnly bisa muncul bahkan sebelum token akun dicek.

    test("Menolak (403) jika bukan admin (adminOnly gagal lebih dulu)", async () => {
      mockAdminOnlyFail = true;
      const res = await request(app).get("/tenant");
      expect(res.status).toBe(403);
    });

    test("Menolak (401) jika adminOnly lolos tapi Token Akun tidak ada/invalid", async () => {
      mockAuthAkunFail = true;
      const res = await request(app).get("/tenant");
      expect(res.status).toBe(401);
    });

    test("Meloloskan (200) ke Controller jika admin dan Token Akun valid", async () => {
      const res = await request(app).get("/tenant");
      expect(res.status).toBe(200);
      expect(res.body.trigger).toBe("getAll");
    });
  });

  // =====================================================================
  // BAGIAN 2: POST / — Registrasi Tenant Baru (authAkun)
  // =====================================================================
  describe("2. POST /tenant — Registrasi Tenant Baru (authAkun)", () => {

    test("Menolak (401) jika Token Akun tidak ada/invalid", async () => {
      mockAuthAkunFail = true;
      const res = await request(app).post("/tenant").send({});
      expect(res.status).toBe(401);
    });

    test("Meloloskan (200) ke Controller jika Token Akun valid", async () => {
      const res = await request(app).post("/tenant").send({});
      expect(res.status).toBe(200);
      expect(res.body.trigger).toBe("createWithOwner");
    });
  });

  // =====================================================================
  // BAGIAN 3: GET /:id — Detail Tenant (authPengguna)
  // =====================================================================
  describe("3. GET /tenant/:id — Detail Tenant (authPengguna)", () => {

    test("Menolak (401) jika Token Pengguna tidak ada/invalid", async () => {
      mockAuthPenggunaFail = true;
      const res = await request(app).get("/tenant/mock-tenant-id-123");
      expect(res.status).toBe(401);
    });

    test("Meloloskan (200) ke Controller jika Token Pengguna valid", async () => {
      const res = await request(app).get("/tenant/mock-tenant-id-123");
      expect(res.status).toBe(200);
      expect(res.body.trigger).toBe("getById");
    });
  });

  // =====================================================================
  // BAGIAN 4: PUT /:id — Perbarui Tenant (authPengguna + checkPermission)
  // =====================================================================
  describe("4. PUT /tenant/:id — Perbarui Tenant (authPengguna → checkPermission)", () => {
    // CATATAN: Urutan middleware di route adalah authPengguna DULU, baru checkPermission.
    // Maka 401 dari authPengguna muncul sebelum izin dicek.

    test("Menolak (401) jika Token Pengguna tidak ada/invalid", async () => {
      mockAuthPenggunaFail = true;
      const res = await request(app).put("/tenant/mock-tenant-id-123").send({});
      expect(res.status).toBe(401);
    });

    test("Menolak (403) jika Token Pengguna valid tapi tidak memegang izin 'update-tenant'", async () => {
      mockPermissionFail = true;
      const res = await request(app).put("/tenant/mock-tenant-id-123").send({});
      expect(res.status).toBe(403);
    });

    test("Meloloskan (200) ke Controller jika Token Pengguna valid dan memegang izin", async () => {
      const res = await request(app).put("/tenant/mock-tenant-id-123").send({});
      expect(res.status).toBe(200);
      expect(res.body.trigger).toBe("update");
    });
  });

  // =====================================================================
  // BAGIAN 5: DELETE /:id — Hapus Tenant (authPengguna + checkPermission)
  // =====================================================================
  describe("5. DELETE /tenant/:id — Hapus Tenant (authPengguna → checkPermission)", () => {

    test("Menolak (401) jika Token Pengguna tidak ada/invalid", async () => {
      mockAuthPenggunaFail = true;
      const res = await request(app).delete("/tenant/mock-tenant-id-123");
      expect(res.status).toBe(401);
    });

    test("Menolak (403) jika Token Pengguna valid tapi tidak memegang izin 'delete-tenant'", async () => {
      mockPermissionFail = true;
      const res = await request(app).delete("/tenant/mock-tenant-id-123");
      expect(res.status).toBe(403);
    });

    test("Meloloskan (200) ke Controller jika Token Pengguna valid dan memegang izin", async () => {
      const res = await request(app).delete("/tenant/mock-tenant-id-123");
      expect(res.status).toBe(200);
      expect(res.body.trigger).toBe("delete");
    });
  });
});