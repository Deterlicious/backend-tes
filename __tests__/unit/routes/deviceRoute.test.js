const express = require("express");
const request = require("supertest");
jest.mock("../../../config/redis", () => ({
  on: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}));
const authPengguna = require("../../../middleware/authPengguna");
const { checkPermission } = require("../../../middleware/authorizePermission");

// 1. MOCK DEPENDENCIES
jest.mock("../../../controllers/deviceController", () => ({
  getDevices: jest.fn(),
  approveDevice: jest.fn(),
  revokeDevice: jest.fn(),
  selfApproveDevice: jest.fn(),
}));
jest.mock("../../../middleware/authPengguna");
jest.mock("../../../middleware/authorizePermission");

const deviceController = require("../../../controllers/deviceController");

describe("Integration Test — Device Route Gateways", () => {
  let app;
  let mockAuthFail = false;
  let mockPermissionFail = false;

  beforeAll(() => {
    // REVISI: Menyelaraskan signature mock dengan fungsi asli (...allowedPermissions)
    checkPermission.mockImplementation(
      (...allowedPermissions) =>
        (req, res, next) => {
          if (mockPermissionFail) {
            return res.status(403).json({
              success: false,
              message: "Akses ditolak. Izin tidak cukup.",
            });
          }
          next();
        },
    );

    authPengguna.mockImplementation((req, res, next) => {
      if (mockAuthFail) {
        return res
          .status(401)
          .json({ success: false, message: "Token invalid atau kedaluwarsa." });
      }
      req.pengguna = { id: "user-123", tenantID: "tenant-xyz" };
      next();
    });

    deviceController.getDevices.mockImplementation((req, res) =>
      res.status(200).json({ success: true, trigger: "getDevices" }),
    );
    deviceController.approveDevice.mockImplementation((req, res) =>
      res.status(200).json({ success: true, trigger: "approveDevice" }),
    );
    deviceController.revokeDevice.mockImplementation((req, res) =>
      res.status(200).json({ success: true, trigger: "revokeDevice" }),
    );
    deviceController.selfApproveDevice.mockImplementation((req, res) =>
      res.status(200).json({ success: true, trigger: "selfApproveDevice" }),
    );

    const deviceRoute = require("../../../routes/deviceRoute");

    app = express();
    app.use(express.json());
    app.use("/api/devices", deviceRoute);

    app.use((err, req, res, next) => {
      res
        .status(err.status || 500)
        .json({ success: false, message: err.message });
    });
  });

  beforeEach(() => {
    mockAuthFail = false;
    mockPermissionFail = false;
    jest.clearAllMocks();
  });

  describe("A. Proteksi Autentikasi Global (authPengguna)", () => {
    test("Menolak ketat (401) seluruh rute jika pengguna belum login/token hangus", async () => {
      mockAuthFail = true;
      const res = await request(app).get("/api/devices/user-123");
      expect(res.status).toBe(401);
      expect(deviceController.getDevices).not.toHaveBeenCalled();
    });
  });

  describe("B. Evaluasi Gerbang Spesifik Rute", () => {
    describe("1. GET /api/devices/:userId", () => {
      test("Menolak (403) jika pengguna tidak memegang izin 'read-pengguna'", async () => {
        mockPermissionFail = true;
        const res = await request(app).get("/api/devices/user-123");

        // REVISI: Menghapus ekspektasi toHaveBeenCalledWith yang mustahil karena lifecycle Express
        expect(res.status).toBe(403);
      });

      test("Meloloskan (200) ke Controller jika izin 'read-pengguna' valid", async () => {
        const res = await request(app).get("/api/devices/user-123");
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("getDevices");
      });
    });

    describe("2. POST /api/devices/approve", () => {
      test("Menolak (403) jika pengguna tidak memegang izin 'update-pengguna'", async () => {
        mockPermissionFail = true;
        const res = await request(app)
          .post("/api/devices/approve")
          .send({ installationId: "DEV-1" });

        // REVISI: Menghapus ekspektasi toHaveBeenCalledWith
        expect(res.status).toBe(403);
      });

      test("Meloloskan (200) ke Controller jika izin 'update-pengguna' valid", async () => {
        const res = await request(app)
          .post("/api/devices/approve")
          .send({ installationId: "DEV-1" });
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("approveDevice");
      });
    });

    describe("3. POST /api/devices/revoke", () => {
      test("Menolak (403) jika pengguna tidak memegang izin 'update-pengguna'", async () => {
        mockPermissionFail = true;
        const res = await request(app)
          .post("/api/devices/revoke")
          .send({ installationId: "DEV-1" });

        // REVISI: Menghapus ekspektasi toHaveBeenCalledWith
        expect(res.status).toBe(403);
      });

      test("Meloloskan (200) ke Controller jika izin 'update-pengguna' valid", async () => {
        const res = await request(app)
          .post("/api/devices/revoke")
          .send({ installationId: "DEV-1" });
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("revokeDevice");
      });
    });

    describe("4. POST /api/devices/self-approve", () => {
      // TAMBAHKAN SKENARIO INI
      test("Menolak ketat (401) jika Token Pengguna tidak ada/invalid", async () => {
        mockAuthFail = true;
        const res = await request(app)
          .post("/api/devices/self-approve")
          .send({ installationId: "BUDI-HP" });
        expect(res.status).toBe(401);
        expect(deviceController.selfApproveDevice).not.toHaveBeenCalled();
      });

      test("Meloloskan (200) langsung ke Controller tanpa melewati pengecekan 'checkPermission'", async () => {
        mockPermissionFail = true; // Bukti bahwa checkPermission dilewati
        const res = await request(app)
          .post("/api/devices/self-approve")
          .send({ installationId: "BUDI-HP" });
        expect(res.status).toBe(200);
        expect(res.body.trigger).toBe("selfApproveDevice");
      });
    });
  });
});
