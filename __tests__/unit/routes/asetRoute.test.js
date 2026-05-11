const request = require("supertest");
const express = require("express");

// 1. Definisikan Mock Functions untuk Middleware
const mockAuth = jest.fn((req, res, next) => {
  req.pengguna = { tenantID: "tenant_1" };
  next();
});

const mockCheckPermission = jest.fn((permission) => {
  return (req, res, next) => {
    // Simulasi penolakan akses (403) jika header ini dikirim oleh test
    if (req.headers["x-deny-permission"] === "true") {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.permissionName = permission;
    next();
  };
});

// 2. Mocking Dependencies
jest.mock("../../../middleware/authPengguna", () => mockAuth);
jest.mock("../../../middleware/authorizePermission", () => ({
  checkPermission: mockCheckPermission,
}));

// Mock Controller agar tidak memanggil logic Service/Database sesungguhnya
jest.mock("../../../controllers/asetController", () => ({
  getAll: jest.fn((req, res) => res.json({ data: [] })),
  getById: jest.fn((req, res) => res.json({ data: { id: req.params.id } })),
  create: jest.fn((req, res) => res.status(201).json({ data: true })),
  update: jest.fn((req, res) => res.json({ data: true })),
  delete: jest.fn((req, res) => res.json({ data: true })),
}));

const asetController = require("../../../controllers/asetController");
const asetRoute = require("../../../routes/asetRoute");

describe("Integration Test — Route — Aset", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Prefix rute disesuaikan untuk Aset
    app.use("/api/aset", asetRoute);

    // Global error handler untuk menangkap error dari fungsi wrap()
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    // Bersihkan mock controller.
    // JANGAN gunakan jest.clearAllMocks() di sini agar binding
    // permission mockCheckPermission yang terjadi saat inisialisasi router tidak hilang.
    asetController.getAll.mockClear();
    asetController.getById.mockClear();
    asetController.create.mockClear();
    asetController.update.mockClear();
    asetController.delete.mockClear();
    mockAuth.mockClear();
  });

  describe("Middleware Otentikasi (Wajib Semua Rute)", () => {
    test("Ditolak (401) jika pengguna belum login saat mengakses GET /", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).get("/api/aset");
      expect(res.status).toBe(401);
    });

    test("Ditolak (401) jika pengguna belum login saat mengakses POST /", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).post("/api/aset").send({});
      expect(res.status).toBe(401);
    });
  });

  describe("Verifikasi Proteksi Permission (RBAC)", () => {
    // GET ALL - PENGECUALIAN (Terbuka untuk Kasir/Booking)
    test("GET / — TETAP SUKSES (200) meskipun disimulasikan tidak punya permission khusus", async () => {
      const res = await request(app)
        .get("/api/aset")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(200);
    });

    // GET BY ID - PENGECUALIAN
    test("GET /:id — TETAP SUKSES (200) meskipun disimulasikan tidak punya permission khusus", async () => {
      const res = await request(app)
        .get("/api/aset/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(200);
    });

    // POST - DIBATASI
    test("POST / — Harus ditolak (403) jika staf tidak punya izin 'create-aset'", async () => {
      const res = await request(app)
        .post("/api/aset")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(asetController.create).not.toHaveBeenCalled();
    });

    // PUT - DIBATASI
    test("PUT /:id — Harus ditolak (403) jika staf tidak punya izin 'update-aset'", async () => {
      const res = await request(app)
        .put("/api/aset/123")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(asetController.update).not.toHaveBeenCalled();
    });

    // DELETE - DIBATASI
    test("DELETE /:id — Harus ditolak (403) jika staf tidak punya izin 'delete-aset'", async () => {
      const res = await request(app)
        .delete("/api/aset/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(asetController.delete).not.toHaveBeenCalled();
    });
  });

  describe("Endpoint Success Path (Happy Path)", () => {
    test("GET / — Sukses mengakses daftar aset", async () => {
      const res = await request(app).get("/api/aset");
      expect(res.status).toBe(200);
      expect(asetController.getAll).toHaveBeenCalled();
    });

    test("POST / — Sukses membuat aset baru", async () => {
      const res = await request(app)
        .post("/api/aset")
        .send({ namaAset: "Meja Billiard B" });
      expect(res.status).toBe(201);
      expect(asetController.create).toHaveBeenCalled();
    });

    test("GET /:id — Sukses mengambil detail aset spesifik", async () => {
      const res = await request(app).get("/api/aset/123");
      expect(res.status).toBe(200);
      expect(asetController.getById).toHaveBeenCalled();
    });

    test("PUT /:id — Sukses memperbarui data aset", async () => {
      const res = await request(app)
        .put("/api/aset/123")
        .send({ status: "perbaikan" });
      expect(res.status).toBe(200);
      expect(asetController.update).toHaveBeenCalled();
    });

    test("DELETE /:id — Sukses menghapus data aset", async () => {
      const res = await request(app).delete("/api/aset/123");
      expect(res.status).toBe(200);
      expect(asetController.delete).toHaveBeenCalled();
    });
  });

  describe("Konfigurasi String Izin (Binding Middleware)", () => {
    test("Memastikan rute yang dimodifikasi terikat dengan string permission (RBAC) yang benar", () => {
      const calledPermissions = mockCheckPermission.mock.calls.map(
        (call) => call[0],
      );

      expect(calledPermissions).toContain("create-aset");
      expect(calledPermissions).toContain("update-aset");
      expect(calledPermissions).toContain("delete-aset");
    });
  });
});
