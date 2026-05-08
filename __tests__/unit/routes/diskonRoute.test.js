const request = require("supertest");
const express = require("express");

// 1. Definisikan Mock Functions
const mockAuth = jest.fn((req, res, next) => {
  req.pengguna = { tenantID: "tenant_1" };
  next();
});

const mockCheckPermission = jest.fn((permission) => {
  return (req, res, next) => {
    // Jika header ini ada, kita simulasi penolakan akses (Forbidden)
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

jest.mock("../../../controllers/diskonController", () => ({
  getAll: jest.fn((req, res) => res.json({ data: [] })),
  getById: jest.fn((req, res) => res.json({ data: { id: req.params.id } })),
  create: jest.fn((req, res) => res.status(201).json({ data: true })),
  update: jest.fn((req, res) => res.json({ data: true })),
  delete: jest.fn((req, res) => res.json({ data: true })),
}));

const diskonController = require("../../../controllers/diskonController");
const diskonRoute = require("../../../routes/diskonRoute");

describe("Integration Test — Route — Diskon", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/diskon", diskonRoute);
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    // Bersihkan mock data controller sebelum setiap test
    diskonController.getAll.mockClear();
    diskonController.getById.mockClear();
    diskonController.create.mockClear();
    diskonController.update.mockClear();
    diskonController.delete.mockClear();
    mockAuth.mockClear();
  });

  describe("Middleware Otentikasi (Wajib untuk semua rute)", () => {
    test("Ditolak (401) jika otentikasi gagal saat mengakses GET /", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).get("/api/diskon");
      expect(res.status).toBe(401);
    });

    test("Ditolak (401) jika otentikasi gagal saat mengakses POST /", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).post("/api/diskon").send({});
      expect(res.status).toBe(401);
    });
  });

  describe("Verifikasi Proteksi Permission (Role Based Access Control)", () => {
    // GET ALL - PENGECUALIAN
    test("GET / — TETAP SUKSES (200) meskipun tidak punya permission khusus (Karena terbuka untuk semua staf yang login)", async () => {
      const res = await request(app)
        .get("/api/diskon")
        .set("x-deny-permission", "true"); // Simulasi penolakan permission spesifik

      // Harus tetap 200 karena rute ini TIDAK menggunakan middleware checkPermission
      expect(res.status).toBe(200);
    });

    // GET BY ID - PENGECUALIAN
    test("GET /:id — TETAP SUKSES (200) meskipun tidak punya permission khusus", async () => {
      const res = await request(app)
        .get("/api/diskon/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(200);
    });

    // POST
    test("POST / — Harus ditolak (403) jika tidak punya izin 'create-diskon'", async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(diskonController.create).not.toHaveBeenCalled();
    });

    // PUT
    test("PUT /:id — Harus ditolak (403) jika tidak punya izin 'update-diskon'", async () => {
      const res = await request(app)
        .put("/api/diskon/123")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(diskonController.update).not.toHaveBeenCalled();
    });

    // DELETE
    test("DELETE /:id — Harus ditolak (403) jika tidak punya izin 'delete-diskon'", async () => {
      const res = await request(app)
        .delete("/api/diskon/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(diskonController.delete).not.toHaveBeenCalled();
    });
  });

  describe("Endpoint Success Path (Happy Path)", () => {
    test("GET / — Sukses mengakses daftar diskon", async () => {
      const res = await request(app).get("/api/diskon");
      expect(res.status).toBe(200);
      expect(diskonController.getAll).toHaveBeenCalled();
    });

    test("POST / — Sukses membuat diskon baru", async () => {
      const res = await request(app)
        .post("/api/diskon")
        .send({ namaDiskon: "Promo" });
      expect(res.status).toBe(201);
      expect(diskonController.create).toHaveBeenCalled();
    });

    test("GET /:id — Sukses mengambil detail diskon", async () => {
      const res = await request(app).get("/api/diskon/123");
      expect(res.status).toBe(200);
      expect(diskonController.getById).toHaveBeenCalled();
    });

    test("PUT /:id — Sukses memperbarui diskon", async () => {
      const res = await request(app)
        .put("/api/diskon/123")
        .send({ status: "Aktif" });
      expect(res.status).toBe(200);
      expect(diskonController.update).toHaveBeenCalled();
    });

    test("DELETE /:id — Sukses menghapus diskon", async () => {
      const res = await request(app).delete("/api/diskon/123");
      expect(res.status).toBe(200);
      expect(diskonController.delete).toHaveBeenCalled();
    });
  });

  describe("Konfigurasi String Izin (Binding Middleware)", () => {
    test("Memastikan rute modifikasi terikat dengan string permission yang benar", () => {
      // Ambil argumen permission yang dilempar saat file route di-load
      const calledPermissions = mockCheckPermission.mock.calls.map(
        (call) => call[0],
      );

      expect(calledPermissions).toContain("create-diskon");
      expect(calledPermissions).toContain("update-diskon");
      expect(calledPermissions).toContain("delete-diskon");

      // Pastikan read-diskon TIDAK ADA (karena sengaja tidak dipakai di file route Anda)
      expect(calledPermissions).not.toContain("read-diskon");
    });
  });
});
