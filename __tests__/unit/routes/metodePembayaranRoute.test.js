const request = require("supertest");
const express = require("express");

// ===============================
// MOCK CONTROLLER
// ===============================
jest.mock("../../../controllers/metodePembayaranController", () => ({
  getAll: jest.fn((req, res) =>
    res.json({
      data: [],
    }),
  ),

  getById: jest.fn((req, res) =>
    res.json({
      data: {
        id: req.params.id,
      },
    }),
  ),

  create: jest.fn((req, res) =>
    res.status(201).json({
      data: true,
    }),
  ),

  update: jest.fn((req, res) =>
    res.json({
      data: true,
    }),
  ),

  delete: jest.fn((req, res) =>
    res.json({
      data: true,
    }),
  ),
}));

// ===============================
// MOCK AUTH
// ===============================
const mockAuth = jest.fn((req, res, next) => {
  req.pengguna = {
    tenantID: "tenant_1",
  };
  next();
});

jest.mock("../../../middleware/authPengguna", () => mockAuth);

// ===============================
// MOCK PERMISSION
// ===============================
const mockCheckPermission = jest.fn((permission) => {
  return (req, res, next) => {
    if (req.headers["x-deny-permission"] === "true") {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    req.permissionName = permission;
    next();
  };
});

jest.mock("../../../middleware/authorizePermission", () => ({
  checkPermission: mockCheckPermission,
}));

// ===============================
// IMPORT SETELAH MOCK
// ===============================
const metodePembayaranController = require("../../../controllers/metodePembayaranController");
const metodePembayaranRoute = require("../../../routes/metodePembayaranRoute");

// ===============================
// EXPRESS APP TEST
// ===============================
const app = express();

app.use(express.json());
app.use("/api/metode-pembayaran", metodePembayaranRoute);

// Error handler test
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message,
  });
});

describe("Integration Test — Route — MetodePembayaran", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================================
  // AUTH
  // =====================================
  describe("Middleware Otentikasi", () => {
    test("Sukses memicu auth middleware untuk semua endpoint", async () => {
      await request(app).get("/api/metode-pembayaran");
      expect(mockAuth).toHaveBeenCalled();
    });
  });

  // =====================================
  // GET /
  // =====================================
  describe("Endpoint: GET /", () => {
    test("Sukses mengakses daftar metode pembayaran (200 OK)", async () => {
      const res = await request(app).get("/api/metode-pembayaran");
      expect(res.status).toBe(200);
      expect(metodePembayaranController.getAll).toHaveBeenCalled();
    });

    test("Gagal (500) jika controller melempar error saat mengambil daftar", async () => {
      metodePembayaranController.getAll.mockImplementationOnce(() => {
        throw new Error("GET ALL ERROR");
      });
      const res = await request(app).get("/api/metode-pembayaran");
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/GET ALL ERROR/i);
    });
  });

  // =====================================
  // GET /:id
  // =====================================
  describe("Endpoint: GET /:id", () => {
    test("Sukses mengambil detail metode pembayaran berdasarkan ID (200 OK)", async () => {
      const res = await request(app).get("/api/metode-pembayaran/abc123");
      expect(res.status).toBe(200);
      expect(metodePembayaranController.getById).toHaveBeenCalled();
      expect(res.body.data.id).toBe("abc123");
    });

    test("Gagal (500) jika controller melempar error saat mengambil detail", async () => {
      metodePembayaranController.getById.mockImplementationOnce(() => {
        throw new Error("DETAIL ERROR");
      });
      const res = await request(app).get("/api/metode-pembayaran/abc123");
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/DETAIL ERROR/i);
    });
  });

  // =====================================
  // POST /
  // =====================================
  describe("Endpoint: POST /", () => {
    test("Sukses membuat metode pembayaran baru (201 Created)", async () => {
      const res = await request(app).post("/api/metode-pembayaran").send({
        namaPembayaran: "QRIS",
      });
      expect(res.status).toBe(201);
      expect(metodePembayaranController.create).toHaveBeenCalled();
    });

    test("Gagal (500) jika controller melempar error saat membuat data", async () => {
      metodePembayaranController.create.mockImplementationOnce(() => {
        throw new Error("CREATE ERROR");
      });
      const res = await request(app).post("/api/metode-pembayaran").send({});
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/CREATE ERROR/i);
    });
  });

  // =====================================
  // PUT /:id
  // =====================================
  describe("Endpoint: PUT /:id", () => {
    test("Sukses memperbarui data metode pembayaran (200 OK)", async () => {
      const res = await request(app).put("/api/metode-pembayaran/id_1").send({
        namaPembayaran: "UPDATE",
      });
      expect(res.status).toBe(200);
      expect(metodePembayaranController.update).toHaveBeenCalled();
    });

    test("Gagal (500) jika controller melempar error saat memperbarui data", async () => {
      metodePembayaranController.update.mockImplementationOnce(() => {
        throw new Error("UPDATE ERROR");
      });
      const res = await request(app)
        .put("/api/metode-pembayaran/id_1")
        .send({});
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/UPDATE ERROR/i);
    });
  });

  // =====================================
  // DELETE /:id
  // =====================================
  describe("Endpoint: DELETE /:id", () => {
    test("Sukses menghapus data metode pembayaran (200 OK)", async () => {
      const res = await request(app).delete("/api/metode-pembayaran/id_1");
      expect(res.status).toBe(200);
      expect(metodePembayaranController.delete).toHaveBeenCalled();
    });

    test("Gagal (500) jika controller melempar error saat menghapus data", async () => {
      metodePembayaranController.delete.mockImplementationOnce(() => {
        throw new Error("DELETE ERROR");
      });
      const res = await request(app).delete("/api/metode-pembayaran/id_1");
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/DELETE ERROR/i);
    });
  });

  // =====================================
  // METHOD NOT ALLOWED
  // =====================================
  describe("Method Not Allowed", () => {
    test("Gagal (404) saat mencoba metode HTTP PATCH yang tidak tersedia", async () => {
      const res = await request(app).patch("/api/metode-pembayaran/id_1");
      expect(res.status).toBe(404);
    });
  });

  // =====================================
  // AUTH REJECT
  // =====================================
  describe("Penolakan Autentikasi", () => {
    test("Ditolak (401) jika otentikasi middleware gagal", async () => {
      mockAuth.mockImplementationOnce((req, res) => {
        return res.status(401).json({
          message: "Unauthorized",
        });
      });

      const res = await request(app).get("/api/metode-pembayaran");
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Unauthorized/i);
      expect(metodePembayaranController.getAll).not.toHaveBeenCalled();
    });
  });

  // =====================================
  // PERMISSION REJECT
  // =====================================
  describe("Penolakan Izin (Permission)", () => {
    test("Ditolak (403) saat membuat data jika tidak memiliki izin create", async () => {
      const res = await request(app)
        .post("/api/metode-pembayaran")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Forbidden/i);
      expect(metodePembayaranController.create).not.toHaveBeenCalled();
    });

    test("Ditolak (403) saat memperbarui data jika tidak memiliki izin update", async () => {
      const res = await request(app)
        .put("/api/metode-pembayaran/id_1")
        .set("x-deny-permission", "true")
        .send({});

      expect(res.status).toBe(403);
      expect(metodePembayaranController.update).not.toHaveBeenCalled();
    });

    test("Ditolak (403) saat menghapus data jika tidak memiliki izin delete", async () => {
      const res = await request(app)
        .delete("/api/metode-pembayaran/id_1")
        .set("x-deny-permission", "true");

      expect(res.status).toBe(403);
      expect(metodePembayaranController.delete).not.toHaveBeenCalled();
    });
  });
});
