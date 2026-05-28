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

// Mock Controller untuk mencegah eksekusi service dan database
jest.mock("../../../controllers/penjualanController", () => ({
  getAll: jest.fn((req, res) => res.json({ data: [] })),
  getById: jest.fn((req, res) => res.json({ data: { id: req.params.id } })),
  create: jest.fn((req, res) => res.status(201).json({ data: true })),
  update: jest.fn((req, res) => res.json({ data: true })),
  delete: jest.fn((req, res) => res.json({ data: true })),
}));

const penjualanController = require("../../../controllers/penjualanController");
const penjualanRoute = require("../../../routes/penjualanRoute");

describe("Integration Test — Route — Penjualan", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Pasang rute yang sedang diuji
    app.use("/api/penjualan", penjualanRoute);

    // Global error handler (Simulasi error handler Express Anda)
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    // Bersihkan catatan pemanggilan fungsi tanpa menghapus definisinya
    penjualanController.getAll.mockClear();
    penjualanController.getById.mockClear();
    penjualanController.create.mockClear();
    penjualanController.update.mockClear();
    penjualanController.delete.mockClear();
    mockAuth.mockClear();
  });

  describe("Middleware Otentikasi (authPengguna)", () => {
    test("Ditolak (401) jika pengguna belum login (Missing/Invalid Token)", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );

      const res = await request(app).get("/api/penjualan");
      expect(res.status).toBe(401);
      expect(penjualanController.getAll).not.toHaveBeenCalled();
    });
  });

  describe("Verifikasi Proteksi Izin (checkPermission / RBAC)", () => {
    test("POST / — Harus ditolak (403) jika tidak punya izin 'create-penjualan'", async () => {
      const res = await request(app)
        .post("/api/penjualan")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(penjualanController.create).not.toHaveBeenCalled();
    });

    test("GET / — Harus ditolak (403) jika tidak punya izin 'read-penjualan'", async () => {
      const res = await request(app)
        .get("/api/penjualan")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(penjualanController.getAll).not.toHaveBeenCalled();
    });

    test("GET /:id — Harus ditolak (403) jika tidak punya izin 'read-penjualan'", async () => {
      const res = await request(app)
        .get("/api/penjualan/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(penjualanController.getById).not.toHaveBeenCalled();
    });

    test("PUT /:id — Harus ditolak (403) jika tidak punya izin 'update-penjualan'", async () => {
      const res = await request(app)
        .put("/api/penjualan/123")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(penjualanController.update).not.toHaveBeenCalled();
    });

    test("DELETE /:id — Harus ditolak (403) jika tidak punya izin 'delete-penjualan'", async () => {
      const res = await request(app)
        .delete("/api/penjualan/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(penjualanController.delete).not.toHaveBeenCalled();
    });
  });

  describe("Endpoint Success Path & Controller Binding", () => {
    test("POST / — Sukses memanggil controller.create dengan izin yang tepat", async () => {
      const res = await request(app)
        .post("/api/penjualan")
        .send({ statusPenjualan: "DRAFT" });
      expect(res.status).toBe(201);
      expect(penjualanController.create).toHaveBeenCalled();
    });

    test("GET / — Sukses memanggil controller.getAll", async () => {
      const res = await request(app).get("/api/penjualan");
      expect(res.status).toBe(200);
      expect(penjualanController.getAll).toHaveBeenCalled();
    });

    test("GET /:id — Sukses memanggil controller.getById", async () => {
      const res = await request(app).get("/api/penjualan/123");
      expect(res.status).toBe(200);
      expect(penjualanController.getById).toHaveBeenCalled();
    });

    test("PUT /:id — Sukses memanggil controller.update", async () => {
      const res = await request(app)
        .put("/api/penjualan/123")
        .send({ statusPenjualan: "FINAL" });
      expect(res.status).toBe(200);
      expect(penjualanController.update).toHaveBeenCalled();
    });

    test("DELETE /:id — Sukses memanggil controller.delete", async () => {
      const res = await request(app).delete("/api/penjualan/123");
      expect(res.status).toBe(200);
      expect(penjualanController.delete).toHaveBeenCalled();
    });
  });

  describe("Validasi Parameter String RBAC & Error Wrapper", () => {
    test("Memastikan semua endpoints diikat dengan parameter izin yang tepat", () => {
      const calledPermissions = mockCheckPermission.mock.calls.map(
        (call) => call[0],
      );

      expect(calledPermissions).toContain("create-penjualan");
      expect(calledPermissions).toContain("read-penjualan");
      expect(calledPermissions).toContain("update-penjualan");
      expect(calledPermissions).toContain("delete-penjualan");
    });

    test("Membuktikan fungsi wrap() bekerja menangkap error asinkron dari controller", async () => {
      // Buat controller melempar error
      penjualanController.getAll.mockImplementationOnce(
        async (req, res, next) => {
          throw new Error("Ledakan di Controller Penjualan!");
        },
      );

      const res = await request(app).get("/api/penjualan");

      // Jika wrap() jalan, error akan dilempar ke next() lalu ditangkap Global Error Handler
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Ledakan di Controller Penjualan!");
    });
  });
});
