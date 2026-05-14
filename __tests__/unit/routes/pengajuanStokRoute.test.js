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
jest.mock("../../../controllers/pengajuanStokController", () => {
  return {
    getAllPengajuanStok: jest.fn((req, res) => res.status(200).json({ success: true, route: "getAll" })),
    createPengajuanStok: jest.fn((req, res) => res.status(201).json({ success: true, route: "create" })),
    updatePengajuanStok: jest.fn((req, res) => res.status(200).json({ success: true, route: "update" })),
    submitRequest: jest.fn((req, res) => res.status(200).json({ success: true, route: "submit" })),
    approveRequest: jest.fn((req, res) => res.status(200).json({ success: true, route: "approve" })),
    rejectRequest: jest.fn((req, res) => res.status(200).json({ success: true, route: "reject" })),
  };
});

// Import route setelah dimock
const pengajuanStokRoute = require("../../../routes/pengajuanStokRoute");
const authPengguna = require("../../../middleware/authPengguna");

// Setup Express App
const app = express();
app.use(express.json());
app.use("/api/pengajuan-stok", pengajuanStokRoute);

describe("PengajuanStok Routes — Integration Test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // A. PENGUJIAN ROUTING & PEMANGGILAN MIDDLEWARE (HAPPY PATH)
  // ══════════════════════════════════════════════════════════════════════════
  describe("A. Pemetaan Rute dan Pemanggilan Controller", () => {
    test("1. GET /api/pengajuan-stok -> getAllPengajuanStok", async () => {
      const res = await request(app).get("/api/pengajuan-stok");
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("getAll");
      expect(authPengguna).toHaveBeenCalled();
    });

    test("2. POST /api/pengajuan-stok -> createPengajuanStok", async () => {
      const res = await request(app).post("/api/pengajuan-stok").send({});
      expect(res.status).toBe(201);
      expect(res.body.route).toBe("create");
      expect(authPengguna).toHaveBeenCalled();
    });

    test("3. PUT /api/pengajuan-stok/:id -> updatePengajuanStok", async () => {
      const res = await request(app).put("/api/pengajuan-stok/req-1").send({});
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("update");
    });

    test("4. PATCH /api/pengajuan-stok/:id/submit -> submitRequest", async () => {
      const res = await request(app).patch("/api/pengajuan-stok/req-1/submit").send({});
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("submit");
    });

    test("5. PATCH /api/pengajuan-stok/:id/approve -> approveRequest", async () => {
      const res = await request(app).patch("/api/pengajuan-stok/req-1/approve").send({});
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("approve");
    });

    test("6. PATCH /api/pengajuan-stok/:id/reject -> rejectRequest", async () => {
      const res = await request(app).patch("/api/pengajuan-stok/req-1/reject").send({});
      expect(res.status).toBe(200);
      expect(res.body.route).toBe("reject");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // B. PENGUJIAN OTENTIKASI & OTORISASI (ERROR PATH)
  // ══════════════════════════════════════════════════════════════════════════
  describe("B. Penolakan Akses (Otentikasi & Otorisasi)", () => {
    test("1. Ditolak jika tidak ada token otentikasi (401 Unauthorized)", async () => {
      const res = await request(app).get("/api/pengajuan-stok").set("x-fail-auth", "true");
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Akses ditolak/);
    });

    test("2. Ditolak jika role tidak punya izin approve (403 Forbidden)", async () => {
      const res = await request(app)
        .patch("/api/pengajuan-stok/req-1/approve")
        .set("x-fail-permission", "true")
        .send({});
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/approve-pengajuan-stok/);
    });

    test("3. Ditolak jika role tidak punya izin reject (403 Forbidden)", async () => {
      const res = await request(app)
        .patch("/api/pengajuan-stok/req-1/reject")
        .set("x-fail-permission", "true")
        .send({});
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/reject-pengajuan-stok/);
    });

    test("4. Ditolak jika role tidak punya izin create (403 Forbidden)", async () => {
      const res = await request(app)
        .post("/api/pengajuan-stok")
        .set("x-fail-permission", "true")
        .send({});
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/create-pengajuan-stok/);
    });

    test("5. Endpoint 404 jika URL rute salah ketik", async () => {
      const res = await request(app).patch("/api/pengajuan-stok/req-1/approves"); // typo 'approves'
      expect(res.status).toBe(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // C. PENANGANAN ERROR INTERNAL / WRAPPER
  // ══════════════════════════════════════════════════════════════════════════
  describe("C. Penanganan Error pada Controller", () => {
    const appWithError = express();
    appWithError.use(express.json());
    appWithError.use("/api/pengajuan-stok", pengajuanStokRoute);
    
    appWithError.use((err, req, res, next) => {
      res.status(500).json({ message: "Internal Server Error", error: err.message });
    });

    test("1. Memastikan wrapper `wrap()` menangkap error asynchronous", async () => {
      const pengajuanStokController = require("../../../controllers/pengajuanStokController");
      pengajuanStokController.createPengajuanStok.mockRejectedValueOnce(new Error("Database offline"));

      const res = await request(appWithError).post("/api/pengajuan-stok").send({});
      
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Internal Server Error");
      expect(res.body.error).toBe("Database offline");
    });
  });
});
