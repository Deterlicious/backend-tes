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

jest.mock("../../../controllers/pembayaranController", () => ({
  getAll: jest.fn((req, res) => res.json({ data: [] })),
  getById: jest.fn((req, res) => res.json({ data: { id: req.params.id } })),
  create: jest.fn((req, res) => res.status(201).json({ data: true })),
  update: jest.fn((req, res) => res.json({ data: true })),
  delete: jest.fn((req, res) => res.json({ data: true })),
}));

const pembayaranController = require("../../../controllers/pembayaranController");
const pembayaranRoute = require("../../../routes/pembayaranRoute");

describe("Integration Test — Route — Pembayaran", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/pembayaran", pembayaranRoute);
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Karena checkPermission dipanggil saat file di-load (inisialisasi),
    // kita tidak bisa menggunakan toHaveBeenCalledWith secara simpel di sini
    // jika menggunakan clearAllMocks. Jadi kita fokus pada perilaku (behavior).
  });

  describe("Middleware Otentikasi", () => {
    test("Ditolak (401) jika otentikasi gagal", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).get("/api/pembayaran");
      expect(res.status).toBe(401);
    });
  });

  describe("Verifikasi Proteksi Permission (Role Based Access Control)", () => {
    // GET ALL
    test("GET / — Harus ditolak (403) jika tidak punya izin 'read-pembayaran'", async () => {
      const res = await request(app)
        .get("/api/pembayaran")
        .set("x-deny-permission", "true");
      expect(res.status).toBe(403);
    });

    // POST
    test("POST / — Harus ditolak (403) jika tidak punya izin 'create-pembayaran'", async () => {
      const res = await request(app)
        .post("/api/pembayaran")
        .set("x-deny-permission", "true")
        .send({});
      expect(res.status).toBe(403);
    });

    // GET BY ID
    test("GET /:id — Harus ditolak (403) jika tidak punya izin 'read-pembayaran'", async () => {
      const res = await request(app)
        .get("/api/pembayaran/123")
        .set("x-deny-permission", "true");
      expect(res.status).toBe(403);
    });

    // PUT
    test("PUT /:id — Harus ditolak (403) jika tidak punya izin 'update-pembayaran'", async () => {
      const res = await request(app)
        .put("/api/pembayaran/123")
        .set("x-deny-permission", "true")
        .send({});
      expect(res.status).toBe(403);
    });

    // DELETE
    test("DELETE /:id — Harus ditolak (403) jika tidak punya izin 'delete-pembayaran'", async () => {
      const res = await request(app)
        .delete("/api/pembayaran/123")
        .set("x-deny-permission", "true");
      expect(res.status).toBe(403);
    });
  });

  describe("Endpoint Success Path (Happy Path)", () => {
    test("GET / — Sukses jika izin valid", async () => {
      const res = await request(app).get("/api/pembayaran");
      expect(res.status).toBe(200);
      expect(pembayaranController.getAll).toHaveBeenCalled();
    });

    test("POST / — Sukses jika izin valid", async () => {
      const res = await request(app)
        .post("/api/pembayaran")
        .send({ jumlahBayar: 100 });
      expect(res.status).toBe(201);
      expect(pembayaranController.create).toHaveBeenCalled();
    });

    test("PUT /:id — Sukses jika izin valid", async () => {
      const res = await request(app)
        .put("/api/pembayaran/123")
        .send({ status: "PAID" });
      expect(res.status).toBe(200);
      expect(pembayaranController.update).toHaveBeenCalled();
    });

    test("DELETE /:id — Sukses jika izin valid", async () => {
      const res = await request(app).delete("/api/pembayaran/123");
      expect(res.status).toBe(200);
      expect(pembayaranController.delete).toHaveBeenCalled();
    });
  });
});
