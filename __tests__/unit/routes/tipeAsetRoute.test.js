const request = require("supertest");
const express = require("express");

// 1. Definisikan Mock Functions
const mockAuth = jest.fn((req, res, next) => {
  req.pengguna = { tenantID: "tenant_1" };
  next();
});

const mockCheckPermission = jest.fn((permission) => {
  return (req, res, next) => {
    // Simulasi penolakan akses jika header x-deny-permission dikirim
    if (req.headers["x-deny-permission"] === "true") {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.permissionName = permission;
    next();
  };
});

// 2. Mocking Middleware & Controller
jest.mock("../../../middleware/authPengguna", () => mockAuth);
jest.mock("../../../middleware/authorizePermission", () => ({
  checkPermission: mockCheckPermission,
}));

jest.mock("../../../controllers/tipeAsetController", () => ({
  getAll: jest.fn((req, res) => res.json({ data: [] })),
  getById: jest.fn((req, res) => res.json({ data: { id: req.params.id } })),
  create: jest.fn((req, res) => res.status(201).json({ data: true })),
  update: jest.fn((req, res) => res.json({ data: true })),
  delete: jest.fn((req, res) => res.json({ data: true })),
}));

const tipeAsetController = require("../../../controllers/tipeAsetController");
const tipeAsetRoute = require("../../../routes/tipeAsetRoute");

describe("Integration Test — Route — Tipe Aset", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Prefix rute disesuaikan
    app.use("/api/tipe-aset", tipeAsetRoute);
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    // Bersihkan mock controller, jangan gunakan jest.clearAllMocks()
    // agar binding permission mockCheckPermission di router tidak terhapus.
    tipeAsetController.getAll.mockClear();
    tipeAsetController.getById.mockClear();
    tipeAsetController.create.mockClear();
    tipeAsetController.update.mockClear();
    tipeAsetController.delete.mockClear();
    mockAuth.mockClear();
  });

  describe("Middleware Otentikasi (Wajib Semua Rute)", () => {
    test("Ditolak (401) jika otentikasi gagal saat mengakses GET /", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).get("/api/tipe-aset");
      expect(res.status).toBe(401);
    });

    test("Ditolak (401) jika otentikasi gagal saat mengakses POST /", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).post("/api/tipe-aset").send({});
      expect(res.status).toBe(401);
    });
  });

  describe("Verifikasi Proteksi Permission (RBAC)", () => {
    // GET ALL - PENGECUALIAN (Terbuka untuk Dropdown/Kasir)
    test("GET / — TETAP SUKSES (200) meskipun disimulasikan tidak punya permission", async () => {
      const res = await request(app)
        .get("/api/tipe-aset")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(200);
    });

    // GET BY ID - PENGECUALIAN
    test("GET /:id — TETAP SUKSES (200) meskipun disimulasikan tidak punya permission", async () => {
      const res = await request(app)
        .get("/api/tipe-aset/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(200);
    });

    // POST - DIBATASI
    test("POST / — Harus ditolak (403) jika tidak punya izin 'create-tipe-aset'", async () => {
      const res = await request(app)
        .post("/api/tipe-aset")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(tipeAsetController.create).not.toHaveBeenCalled();
    });

    // PUT - DIBATASI
    test("PUT /:id — Harus ditolak (403) jika tidak punya izin 'update-tipe-aset'", async () => {
      const res = await request(app)
        .put("/api/tipe-aset/123")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(tipeAsetController.update).not.toHaveBeenCalled();
    });

    // DELETE - DIBATASI
    test("DELETE /:id — Harus ditolak (403) jika tidak punya izin 'delete-tipe-aset'", async () => {
      const res = await request(app)
        .delete("/api/tipe-aset/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(tipeAsetController.delete).not.toHaveBeenCalled();
    });
  });

  describe("Endpoint Success Path (Happy Path)", () => {
    test("GET / — Sukses mengakses daftar tipe aset", async () => {
      const res = await request(app).get("/api/tipe-aset");
      expect(res.status).toBe(200);
      expect(tipeAsetController.getAll).toHaveBeenCalled();
    });

    test("POST / — Sukses membuat tipe aset baru", async () => {
      const res = await request(app)
        .post("/api/tipe-aset")
        .send({ namaTipeAset: "Ruang Rapat" });
      expect(res.status).toBe(201);
      expect(tipeAsetController.create).toHaveBeenCalled();
    });

    test("GET /:id — Sukses mengambil detail tipe aset", async () => {
      const res = await request(app).get("/api/tipe-aset/123");
      expect(res.status).toBe(200);
      expect(tipeAsetController.getById).toHaveBeenCalled();
    });

    test("PUT /:id — Sukses memperbarui tipe aset", async () => {
      const res = await request(app)
        .put("/api/tipe-aset/123")
        .send({ namaTipeAset: "Ruang Rapat VIP" });
      expect(res.status).toBe(200);
      expect(tipeAsetController.update).toHaveBeenCalled();
    });

    test("DELETE /:id — Sukses menghapus tipe aset", async () => {
      const res = await request(app).delete("/api/tipe-aset/123");
      expect(res.status).toBe(200);
      expect(tipeAsetController.delete).toHaveBeenCalled();
    });
  });

  describe("Konfigurasi String Izin (Binding Middleware)", () => {
    test("Memastikan rute modifikasi terikat dengan string permission yang benar", () => {
      const calledPermissions = mockCheckPermission.mock.calls.map(
        (call) => call[0],
      );

      expect(calledPermissions).toContain("create-tipe-aset");
      expect(calledPermissions).toContain("update-tipe-aset");
      expect(calledPermissions).toContain("delete-tipe-aset");
    });
  });
});
