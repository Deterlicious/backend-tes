const request = require("supertest");
const express = require("express");

// 1. Definisikan Mock Functions untuk Middleware
const mockAuth = jest.fn((req, res, next) => {
  req.pengguna = { tenantID: "tenant_1", _id: "user_1" };
  next();
});

const mockCheckPermission = jest.fn((permission) => {
  return (req, res, next) => {
    // Simulasi penolakan akses (403) jika header ini dikirim oleh test
    if (req.headers["x-deny-permission"] === "true") {
      return res.status(403).json({ message: "Forbidden Access" });
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

// Mock Controller agar tidak memanggil logic Service sungguhan
jest.mock("../../../controllers/sesiBookingController", () => ({
  getAll: jest.fn((req, res) => res.json({ data: [] })),
  getById: jest.fn((req, res) => res.json({ data: { id: req.params.id } })),
  create: jest.fn((req, res) => res.status(201).json({ data: true })),
  update: jest.fn((req, res) => res.json({ data: true })),
  delete: jest.fn((req, res) => res.json({ data: true })),
}));

const sesiBookingController = require("../../../controllers/sesiBookingController");
const sesiBookingRoute = require("../../../routes/sesiBookingRoute");

describe("Integration Test — Route — Sesi Booking", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Prefix rute disesuaikan untuk Booking
    app.use("/api/booking", sesiBookingRoute);

    // Global error handler untuk menangkap error dari fungsi wrap()
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    // Bersihkan mock controller.
    // JANGAN gunakan jest.clearAllMocks() agar binding middleware tetap utuh.
    sesiBookingController.getAll.mockClear();
    sesiBookingController.getById.mockClear();
    sesiBookingController.create.mockClear();
    sesiBookingController.update.mockClear();
    sesiBookingController.delete.mockClear();
    mockAuth.mockClear();
  });

  describe("Middleware Otentikasi (Wajib Semua Rute)", () => {
    test("Ditolak (401) jika pengguna belum login saat mengakses GET /", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).get("/api/booking");
      expect(res.status).toBe(401);
    });

    test("Ditolak (401) jika pengguna belum login saat mengakses POST /", async () => {
      mockAuth.mockImplementationOnce((req, res) =>
        res.status(401).json({ message: "Unauthorized" }),
      );
      const res = await request(app).post("/api/booking").send({});
      expect(res.status).toBe(401);
    });
  });

  describe("Verifikasi Proteksi Permission (RBAC) - Ketat", () => {
    // GET ALL
    test("GET / — Harus ditolak (403) jika tidak punya izin 'read-booking'", async () => {
      const res = await request(app)
        .get("/api/booking")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(sesiBookingController.getAll).not.toHaveBeenCalled();
    });

    // POST
    test("POST / — Harus ditolak (403) jika tidak punya izin 'create-booking'", async () => {
      const res = await request(app)
        .post("/api/booking")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(sesiBookingController.create).not.toHaveBeenCalled();
    });

    // GET BY ID
    test("GET /:id — Harus ditolak (403) jika tidak punya izin 'read-booking'", async () => {
      const res = await request(app)
        .get("/api/booking/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(sesiBookingController.getById).not.toHaveBeenCalled();
    });

    // PUT
    test("PUT /:id — Harus ditolak (403) jika tidak punya izin 'update-booking'", async () => {
      const res = await request(app)
        .put("/api/booking/123")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(sesiBookingController.update).not.toHaveBeenCalled();
    });

    // DELETE
    test("DELETE /:id — Harus ditolak (403) jika tidak punya izin 'delete-booking'", async () => {
      const res = await request(app)
        .delete("/api/booking/123")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(sesiBookingController.delete).not.toHaveBeenCalled();
    });
  });

  describe("Endpoint Success Path (Happy Path)", () => {
    test("GET / — Sukses mengakses daftar booking", async () => {
      const res = await request(app).get("/api/booking");
      expect(res.status).toBe(200);
      expect(sesiBookingController.getAll).toHaveBeenCalled();
    });

    test("POST / — Sukses membuat booking baru", async () => {
      const res = await request(app)
        .post("/api/booking")
        .send({ dataAset: "aset_1" });
      expect(res.status).toBe(201);
      expect(sesiBookingController.create).toHaveBeenCalled();
    });

    test("GET /:id — Sukses mengambil detail booking", async () => {
      const res = await request(app).get("/api/booking/123");
      expect(res.status).toBe(200);
      expect(sesiBookingController.getById).toHaveBeenCalled();
    });

    test("PUT /:id — Sukses memperbarui booking", async () => {
      const res = await request(app)
        .put("/api/booking/123")
        .send({ status: "Selesai" });
      expect(res.status).toBe(200);
      expect(sesiBookingController.update).toHaveBeenCalled();
    });

    test("DELETE /:id — Sukses menghapus booking", async () => {
      const res = await request(app).delete("/api/booking/123");
      expect(res.status).toBe(200);
      expect(sesiBookingController.delete).toHaveBeenCalled();
    });
  });

  describe("Konfigurasi String Izin (Binding Middleware) & Error Wrapper", () => {
    test("Memastikan setiap rute terikat dengan string permission (RBAC) yang tepat", () => {
      // Mengambil argument (string izin) dari setiap panggilan checkPermission
      const calledPermissions = mockCheckPermission.mock.calls.map(
        (call) => call[0],
      );

      expect(calledPermissions).toContain("read-booking");
      expect(calledPermissions).toContain("create-booking");
      expect(calledPermissions).toContain("update-booking");
      expect(calledPermissions).toContain("delete-booking");
    });

    test("Memastikan fungsi wrap() membungkus async/await dan melempar error ke error handler", async () => {
      // Simulasi internal controller melempar error sistem
      sesiBookingController.getAll.mockImplementationOnce(
        async (req, res, next) => {
          throw new Error("Simulasi Error Database");
        },
      );

      const res = await request(app).get("/api/booking");

      // Jika wrap() berfungsi, error akan ditangkap di catch(next) dan masuk ke error handler global -> 500
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Simulasi Error Database");
    });
  });
});
