const express = require("express");
const request = require("supertest");
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
jest.mock("../../../controllers/roleController", () => ({
  getAll: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));
jest.mock("../../../middleware/authPengguna");
jest.mock("../../../middleware/authorizePermission");

const roleController = require("../../../controllers/roleController");

describe("Integration Test — Role Route Gateways", () => {
  let app;
  let mockAuthPenggunaFail = false;
  let mockPermissionFail = false;

  beforeAll(() => {
    // Setup Mock authPengguna — dipasang global via router.use()
    authPengguna.mockImplementation((req, res, next) => {
      if (mockAuthPenggunaFail) {
        return res.status(401).json({ message: "Akses ditolak. Token pengguna tidak ditemukan." });
      }
      req.pengguna = { id: "user-123", tenantID: "mock-tenant-id-123" };
      req.userDecoded = { id: "user-123", tenantID: "mock-tenant-id-123" };
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
    roleController.getAll.mockImplementation((req, res) => res.status(200).json({ trigger: "getAll" }));
    roleController.getById.mockImplementation((req, res) => res.status(200).json({ trigger: "getById" }));
    roleController.create.mockImplementation((req, res) => res.status(200).json({ trigger: "create" }));
    roleController.update.mockImplementation((req, res) => res.status(200).json({ trigger: "update" }));
    roleController.delete.mockImplementation((req, res) => res.status(200).json({ trigger: "delete" }));

    // Setup Express App
    const roleRoute = require("../../../routes/roleRoute");
    app = express();
    app.use(express.json());
    app.use("/role", roleRoute);

    // Global Error Handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    mockAuthPenggunaFail = false;
    mockPermissionFail = false;
    jest.clearAllMocks();
  });

  // =====================================================================
  // CATATAN ARSITEKTUR:
  // authPengguna dipasang GLOBAL via router.use() — semua rute di bawah
  // wajib lolos authPengguna dulu, baru checkPermission per-rute dicek.
  // Urutan rejection selalu: 401 (auth) → 403 (permission) → 200 (lolos)
  // =====================================================================

  // =====================================================================
  // BAGIAN 1: GET / — Daftar Semua Role
  // =====================================================================
  describe("1. GET /role — Daftar Semua Role (authPengguna → checkPermission 'read-role')", () => {

    test("Menolak (401) jika Token Pengguna tidak ada/invalid", async () => {
      mockAuthPenggunaFail = true;
      const res = await request(app).get("/role");
      expect(res.status).toBe(401);
    });

    test("Menolak (403) jika Token Pengguna valid tapi tidak memegang izin 'read-role'", async () => {
      mockPermissionFail = true;
      const res = await request(app).get("/role");
      expect(res.status).toBe(403);
    });

    test("Meloloskan (200) ke Controller jika Token Pengguna valid dan memegang izin", async () => {
      const res = await request(app).get("/role");
      expect(res.status).toBe(200);
      expect(res.body.trigger).toBe("getAll");
    });
  });

  // =====================================================================
  // BAGIAN 2: GET /:id — Detail Role
  // =====================================================================
  describe("2. GET /role/:id — Detail Role (authPengguna → checkPermission 'read-role')", () => {

    test("Menolak (401) jika Token Pengguna tidak ada/invalid", async () => {
      mockAuthPenggunaFail = true;
      const res = await request(app).get("/role/mock-role-id-123");
      expect(res.status).toBe(401);
    });

    test("Menolak (403) jika Token Pengguna valid tapi tidak memegang izin 'read-role'", async () => {
      mockPermissionFail = true;
      const res = await request(app).get("/role/mock-role-id-123");
      expect(res.status).toBe(403);
    });

    test("Meloloskan (200) ke Controller jika Token Pengguna valid dan memegang izin", async () => {
      const res = await request(app).get("/role/mock-role-id-123");
      expect(res.status).toBe(200);
      expect(res.body.trigger).toBe("getById");
    });
  });

  // =====================================================================
  // BAGIAN 3: POST / — Buat Role Baru
  // =====================================================================
  describe("3. POST /role — Buat Role Baru (authPengguna → checkPermission 'create-role')", () => {

    test("Menolak (401) jika Token Pengguna tidak ada/invalid", async () => {
      mockAuthPenggunaFail = true;
      const res = await request(app).post("/role").send({});
      expect(res.status).toBe(401);
    });

    test("Menolak (403) jika Token Pengguna valid tapi tidak memegang izin 'create-role'", async () => {
      mockPermissionFail = true;
      const res = await request(app).post("/role").send({});
      expect(res.status).toBe(403);
    });

    test("Meloloskan (200) ke Controller jika Token Pengguna valid dan memegang izin", async () => {
      const res = await request(app).post("/role").send({});
      expect(res.status).toBe(200);
      expect(res.body.trigger).toBe("create");
    });
  });

  // =====================================================================
  // BAGIAN 4: PUT /:id — Perbarui Role
  // =====================================================================
  describe("4. PUT /role/:id — Perbarui Role (authPengguna → checkPermission 'update-role')", () => {

    test("Menolak (401) jika Token Pengguna tidak ada/invalid", async () => {
      mockAuthPenggunaFail = true;
      const res = await request(app).put("/role/mock-role-id-123").send({});
      expect(res.status).toBe(401);
    });

    test("Menolak (403) jika Token Pengguna valid tapi tidak memegang izin 'update-role'", async () => {
      mockPermissionFail = true;
      const res = await request(app).put("/role/mock-role-id-123").send({});
      expect(res.status).toBe(403);
    });

    test("Meloloskan (200) ke Controller jika Token Pengguna valid dan memegang izin", async () => {
      const res = await request(app).put("/role/mock-role-id-123").send({});
      expect(res.status).toBe(200);
      expect(res.body.trigger).toBe("update");
    });
  });

  // =====================================================================
  // BAGIAN 5: DELETE /:id — Hapus Role
  // =====================================================================
  describe("5. DELETE /role/:id — Hapus Role (authPengguna → checkPermission 'delete-role')", () => {

    test("Menolak (401) jika Token Pengguna tidak ada/invalid", async () => {
      mockAuthPenggunaFail = true;
      const res = await request(app).delete("/role/mock-role-id-123");
      expect(res.status).toBe(401);
    });

    test("Menolak (403) jika Token Pengguna valid tapi tidak memegang izin 'delete-role'", async () => {
      mockPermissionFail = true;
      const res = await request(app).delete("/role/mock-role-id-123");
      expect(res.status).toBe(403);
    });

    test("Meloloskan (200) ke Controller jika Token Pengguna valid dan memegang izin", async () => {
      const res = await request(app).delete("/role/mock-role-id-123");
      expect(res.status).toBe(200);
      expect(res.body.trigger).toBe("delete");
    });
  });
});