const request = require("supertest");
const express = require("express");

// --- 1. MOCK MIDDLEWARE ---
jest.mock("../../../middleware/authPengguna", () => {
  return jest.fn((req, res, next) => {
    if (req.headers["x-fail-auth"]) {
      return res.status(401).json({ message: "Akses ditolak. Tidak ada token." });
    }
    req.pengguna = {
      _id: "user-123",
      tenantID: "tenant-123",
      nama: "Test User",
    };
    next();
  });
});

jest.mock("../../../middleware/authorizePermission", () => {
  return {
    checkPermission: jest.fn((permission) => {
      return (req, res, next) => {
        if (req.headers["x-fail-permission"]) {
          return res.status(403).json({ message: `Akses ditolak. Butuh izin: ${permission}` });
        }
        req.userPermission = permission;
        next();
      };
    }),
  };
});

// --- 2. MOCK CONTROLLER ---
jest.mock("../../../controllers/transferStokController", () => {
  return {
    createTransferStok: jest.fn((req, res) => res.status(201).json({ success: true, route: "create" })),
    getAllTransferStok: jest.fn((req, res) => res.status(200).json({ success: true, route: "getAll" })),
    getTransferStokById: jest.fn((req, res) => res.status(200).json({ success: true, route: "getById", id: req.params.id })),
    updateTransferDraft: jest.fn((req, res) => res.status(200).json({ success: true, route: "updateDraft" })),
    deleteTransferDraft: jest.fn((req, res) => res.status(200).json({ success: true, route: "deleteDraft" })),
    markAsKirim: jest.fn((req, res) => res.status(200).json({ success: true, route: "kirim" })),
    markAsTerima: jest.fn((req, res) => res.status(200).json({ success: true, route: "terima" })),
    markAsBatal: jest.fn((req, res) => res.status(200).json({ success: true, route: "batal" })),
  };
});

const transferStokRoute = require("../../../routes/transferStokRoute");
const authPengguna = require("../../../middleware/authPengguna");
const { checkPermission } = require("../../../middleware/authorizePermission");

const app = express();
app.use(express.json());
app.use("/api/transfer-stok", transferStokRoute);

describe("TransferStok Routes — Integration Test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("A. Pemetaan Rute dan Pemanggilan Controller", () => {
    test("1. POST /api/transfer-stok -> createTransferStok", async () => {
      const res = await request(app).post("/api/transfer-stok").send({});
      expect(res.status).toBe(201);
      expect(res.body.route).toBe("create");
      expect(authPengguna).toHaveBeenCalled();
    });

    test("2. GET /api/transfer-stok -> getAllTransferStok", async () => {
      const res = await request(app).get("/api/transfer-stok");
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("getAll");
      expect(authPengguna).toHaveBeenCalled();
    });

    test("3. GET /api/transfer-stok/:id -> getTransferStokById", async () => {
      const res = await request(app).get("/api/transfer-stok/123");
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("getById");
      expect(res.body.id).toBe("123");
    });

    test("4. PUT /api/transfer-stok/:id -> updateTransferDraft", async () => {
      const res = await request(app).put("/api/transfer-stok/123").send({});
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("updateDraft");
    });

    test("5. DELETE /api/transfer-stok/:id -> deleteTransferDraft", async () => {
      const res = await request(app).delete("/api/transfer-stok/123");
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("deleteDraft");
    });

    test("6. PATCH /api/transfer-stok/:id/kirim -> markAsKirim", async () => {
      const res = await request(app).patch("/api/transfer-stok/123/kirim").send({});
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("kirim");
    });

    test("7. PATCH /api/transfer-stok/:id/terima -> markAsTerima", async () => {
      const res = await request(app).patch("/api/transfer-stok/123/terima").send({});
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("terima");
    });

    test("8. PATCH /api/transfer-stok/:id/batal -> markAsBatal", async () => {
      const res = await request(app).patch("/api/transfer-stok/123/batal").send({});
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("batal");
    });
  });

  describe("B. Penolakan Akses (Otentikasi & Otorisasi)", () => {
    test("1. Ditolak jika tidak ada token otentikasi (401 Unauthorized)", async () => {
      const res = await request(app).get("/api/transfer-stok").set("x-fail-auth", "true");
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Akses ditolak/);
    });

    test("2. Ditolak jika role tidak punya izin (403 Forbidden)", async () => {
      const res = await request(app).patch("/api/transfer-stok/123/kirim").set("x-fail-permission", "true").send({});
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/approve-transfer-stok/);
    });

    test("3. Endpoint 404 jika URL salah ketik", async () => {
      const res = await request(app).post("/api/transfer-stoks");
      expect(res.status).toBe(404);
    });
  });

  describe("C. Penanganan Error pada Controller", () => {
    const appWithError = express();
    appWithError.use(express.json());
    appWithError.use("/api/transfer-stok", transferStokRoute);
    
    appWithError.use((err, req, res, next) => {
      res.status(500).json({ message: "Internal Server Error", error: err.message });
    });

    test("1. Memastikan wrapper `wrap()` menangkap error asynchronous", async () => {
      const transferStokController = require("../../../controllers/transferStokController");
      transferStokController.createTransferStok.mockRejectedValueOnce(new Error("DB Connection Lost"));

      const res = await request(appWithError).post("/api/transfer-stok").send({});
      
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Internal Server Error");
      expect(res.body.error).toBe("DB Connection Lost");
    });
  });
});
