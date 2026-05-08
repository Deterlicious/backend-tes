const request = require("supertest");
const express = require("express");

// 1. Definisikan Mock Functions
const mockAuth = jest.fn((req, res, next) => {
  req.pengguna = { tenantID: "tenant_1" };
  next();
});

const mockCheckPermission = jest.fn((permission) => {
  return (req, res, next) => {
    // Simulasi penolakan akses jika header tertentu dikirim
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

jest.mock("../../../controllers/tarifController", () => ({
  getAll: jest.fn((req, res) => res.json({ data: [] })),
  getById: jest.fn((req, res) => res.json({ data: { id: req.params.id } })),
  create: jest.fn((req, res) => res.status(201).json({ data: true })),
  update: jest.fn((req, res) => res.json({ data: true })),
  delete: jest.fn((req, res) => res.json({ data: true })),
}));

const tarifController = require("../../../controllers/tarifController");
const tarifRoute = require("../../../routes/tarifRoute");

describe("Integration Test — Route — Tarif", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/tarif", tarifRoute);
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    // Hanya bersihkan mock spesifik yang dipanggil saat runtime request.
    // Dilarang menggunakan jest.clearAllMocks() agar rekaman checkPermission
    // (yang dipanggil saat rute inisialisasi) tidak hilang.
    tarifController.getAll.mockClear();
    tarifController.getById.mockClear();
    tarifController.create.mockClear();
    tarifController.update.mockClear();
    tarifController.delete.mockClear();
    mockAuth.mockClear();
  });

  describe("Middleware Otentikasi (Wajib Semua Rute)", () => {
    test("Ditolak (401) jika otentikasi gagal saat mengakses GET /", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).get("/api/tarif");
      expect(res.status).toBe(401);
    });

    test("Ditolak (401) jika otentikasi gagal saat mengakses POST /", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).post("/api/tarif").send({});
      expect(res.status).toBe(401);
    });
  });

  describe("Verifikasi Proteksi Permission (RBAC)", () => {
    // GET ALL - TERBUKA UNTUK SEMUA STAF
    test("GET / — TETAP SUKSES (200) meskipun disimulasikan tidak punya permission (terbuka untuk kasir/POS)", async () => {
      const res = await request(app)
        .get("/api/tarif")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(200);
    });

    // GET BY ID - TERBUKA UNTUK SEMUA STAF
    test("GET /:id — TETAP SUKSES (200) meskipun disimulasikan tidak punya permission", async () => {
      const res = await request(app)
        .get("/api/tarif/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(200);
    });

    // POST - DIBATASI
    test("POST / — Harus ditolak (403) jika tidak punya izin 'create-tarif'", async () => {
      const res = await request(app)
        .post("/api/tarif")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(tarifController.create).not.toHaveBeenCalled();
    });

    // PUT - DIBATASI
    test("PUT /:id — Harus ditolak (403) jika tidak punya izin 'update-tarif'", async () => {
      const res = await request(app)
        .put("/api/tarif/123")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(tarifController.update).not.toHaveBeenCalled();
    });

    // DELETE - DIBATASI
    test("DELETE /:id — Harus ditolak (403) jika tidak punya izin 'delete-tarif'", async () => {
      const res = await request(app)
        .delete("/api/tarif/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(tarifController.delete).not.toHaveBeenCalled();
    });
  });

  describe("Endpoint Success Path (Happy Path)", () => {
    test("GET / — Sukses mengakses daftar tarif", async () => {
      const res = await request(app).get("/api/tarif");
      expect(res.status).toBe(200);
      expect(tarifController.getAll).toHaveBeenCalled();
    });

    test("POST / — Sukses membuat tarif baru", async () => {
      const res = await request(app)
        .post("/api/tarif")
        .send({ namaTarif: "Promo Weekend" });
      expect(res.status).toBe(201);
      expect(tarifController.create).toHaveBeenCalled();
    });

    test("GET /:id — Sukses mengambil detail tarif", async () => {
      const res = await request(app).get("/api/tarif/123");
      expect(res.status).toBe(200);
      expect(tarifController.getById).toHaveBeenCalled();
    });

    test("PUT /:id — Sukses memperbarui tarif", async () => {
      const res = await request(app)
        .put("/api/tarif/123")
        .send({ harga: 75000 });
      expect(res.status).toBe(200);
      expect(tarifController.update).toHaveBeenCalled();
    });

    test("DELETE /:id — Sukses menghapus tarif", async () => {
      const res = await request(app).delete("/api/tarif/123");
      expect(res.status).toBe(200);
      expect(tarifController.delete).toHaveBeenCalled();
    });
  });

  describe("Konfigurasi String Izin (Binding Middleware)", () => {
    test("Memastikan rute modifikasi terikat dengan string permission yang benar", () => {
      const calledPermissions = mockCheckPermission.mock.calls.map(
        (call) => call[0],
      );

      expect(calledPermissions).toContain("create-tarif");
      expect(calledPermissions).toContain("update-tarif");
      expect(calledPermissions).toContain("delete-tarif");

      // Pastikan read-tarif tidak digunakan
      expect(calledPermissions).not.toContain("read-tarif");
    });
  });
});
