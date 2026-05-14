const request = require("supertest");
const express = require("express");

// 1. Definisikan Mock Functions untuk Middleware
const mockAuth = jest.fn((req, res, next) => {
  req.pengguna = { tenantID: "tenant_1", _id: "user_1" };
  next();
});

const mockCheckPermission = jest.fn((permission) => {
  return (req, res, next) => {
    // Simulasi penolakan akses (403) jika header spesifik ini dikirim saat test
    if (req.headers["x-deny-permission"] === "true") {
      return res.status(403).json({ message: "Forbidden Access" });
    }
    req.permissionName = permission; // Penanda bahwa middleware tereksekusi
    next();
  };
});

// 2. Mocking Dependencies
jest.mock("../../../middleware/authPengguna", () => mockAuth);
jest.mock("../../../middleware/authorizePermission", () => ({
  checkPermission: mockCheckPermission,
}));

// Mock Controller untuk mencegah eksekusi service sesungguhnya
jest.mock("../../../controllers/akunKasController", () => ({
  getAll: jest.fn((req, res) => res.json({ data: [] })),
  getById: jest.fn((req, res) => res.json({ data: { id: req.params.id } })),
  create: jest.fn((req, res) => res.status(201).json({ data: true })),
  update: jest.fn((req, res) => res.json({ data: true })),
  delete: jest.fn((req, res) => res.json({ data: true })),
}));

const akunKasController = require("../../../controllers/akunKasController");
const akunKasRoute = require("../../../routes/akunKasRoute");

describe("Integration Test — Route — Akun Kas", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Pasang rute yang sedang diuji
    app.use("/api/akunkas", akunKasRoute);

    // Global error handler (Simulasi error handler Express)
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    // Bersihkan catatan pemanggilan fungsi tanpa menghapus definisinya
    akunKasController.getAll.mockClear();
    akunKasController.getById.mockClear();
    akunKasController.create.mockClear();
    akunKasController.update.mockClear();
    akunKasController.delete.mockClear();
    mockAuth.mockClear();
  });

  describe("Middleware Otentikasi (authPengguna)", () => {
    test("Ditolak (401) jika pengguna belum login (Missing/Invalid Token)", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );

      const res = await request(app).get("/api/akunkas");
      expect(res.status).toBe(401);
      expect(akunKasController.getAll).not.toHaveBeenCalled();
    });
  });

  describe("Verifikasi Proteksi Izin Spesifik (checkPermission / RBAC)", () => {
    test("GET / — Harus ditolak (403) jika tidak punya izin 'read-akunkas'", async () => {
      const res = await request(app)
        .get("/api/akunkas")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(akunKasController.getAll).not.toHaveBeenCalled();
    });

    test("POST / — Harus ditolak (403) jika tidak punya izin 'create-akunkas'", async () => {
      const res = await request(app)
        .post("/api/akunkas")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(akunKasController.create).not.toHaveBeenCalled();
    });

    test("GET /:id — Harus ditolak (403) jika tidak punya izin 'read-akunkas'", async () => {
      const res = await request(app)
        .get("/api/akunkas/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(akunKasController.getById).not.toHaveBeenCalled();
    });

    test("PUT /:id — Harus ditolak (403) jika tidak punya izin 'update-akunkas'", async () => {
      const res = await request(app)
        .put("/api/akunkas/123")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(akunKasController.update).not.toHaveBeenCalled();
    });

    test("DELETE /:id — Harus ditolak (403) jika tidak punya izin 'delete-akunkas'", async () => {
      const res = await request(app)
        .delete("/api/akunkas/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(akunKasController.delete).not.toHaveBeenCalled();
    });
  });

  describe("Endpoint Success Path & Controller Binding", () => {
    test("GET / — Sukses memanggil controller.getAll", async () => {
      const res = await request(app).get("/api/akunkas");
      expect(res.status).toBe(200);
      expect(akunKasController.getAll).toHaveBeenCalled();
    });

    test("POST / — Sukses memanggil controller.create", async () => {
      const res = await request(app)
        .post("/api/akunkas")
        .send({ namaAkun: "Kas Baru" });
      expect(res.status).toBe(201);
      expect(akunKasController.create).toHaveBeenCalled();
    });

    test("GET /:id — Sukses memanggil controller.getById", async () => {
      const res = await request(app).get("/api/akunkas/123");
      expect(res.status).toBe(200);
      expect(akunKasController.getById).toHaveBeenCalled();
    });

    test("PUT /:id — Sukses memanggil controller.update", async () => {
      const res = await request(app)
        .put("/api/akunkas/123")
        .send({ status: "aktif" });
      expect(res.status).toBe(200);
      expect(akunKasController.update).toHaveBeenCalled();
    });

    test("DELETE /:id — Sukses memanggil controller.delete", async () => {
      const res = await request(app).delete("/api/akunkas/123");
      expect(res.status).toBe(200);
      expect(akunKasController.delete).toHaveBeenCalled();
    });
  });

  describe("Validasi String RBAC & Error Wrapper (wrap)", () => {
    test("Memastikan semua endpoints diikat dengan parameter izin (RBAC) yang tepat", () => {
      const calledPermissions = mockCheckPermission.mock.calls.map(
        (call) => call[0],
      );

      expect(calledPermissions).toContain("read-akunkas");
      expect(calledPermissions).toContain("create-akunkas");
      expect(calledPermissions).toContain("update-akunkas");
      expect(calledPermissions).toContain("delete-akunkas");
    });

    test("Membuktikan fungsi wrap() bekerja menangkap error asinkron dari controller", async () => {
      // Buat controller melempar error
      akunKasController.getAll.mockImplementationOnce(
        async (req, res, next) => {
          throw new Error("Ledakan di Controller Akun Kas!");
        },
      );

      const res = await request(app).get("/api/akunkas");

      // Jika wrap() jalan, error akan dilempar ke next() lalu ditangkap Global Error Handler
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Ledakan di Controller Akun Kas!");
    });
  });
});
