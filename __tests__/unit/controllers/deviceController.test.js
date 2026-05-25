const deviceController = require("../../../controllers/deviceController");
const deviceService = require("../../../services/deviceService");
const { validateDeviceAction, validateGetDevices } = require("../../../validators/deviceValidator");

// Mocking dependencies
jest.mock("../../../services/deviceService");
jest.mock("../../../validators/deviceValidator");

describe("Unit Test — Device Controller", () => {
  let req, res, next;
  
  // REVISI MULTI-TENANCY: Identitas toko tiruan
  const mockTenantID = "tenant-xyz";

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      pengguna: { 
        id: "user-123", 
        tenantID: mockTenantID // REVISI: Menyuntikkan identitas toko ke sesi
      }, 
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("1. getDevices", () => {
    test("Merespons 400 jika validator menolak (userId tidak valid/kosong)", async () => {
      validateGetDevices.mockReturnValue({ valid: false, errors: ["userId wajib"] });
      req.params.userId = undefined;

      await deviceController.getDevices(req, res, next);

      expect(validateGetDevices).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Meneruskan error 401 ke next() jika identitas toko (tenantID) tidak ada", async () => {
      validateGetDevices.mockReturnValue({ valid: true });
      req.params.userId = "user-123";
      req.pengguna.tenantID = undefined; // Simulasi sesi toko hilang

      await deviceController.getDevices(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });

    test("Meneruskan ke next(err) jika Service mengalami kegagalan/lempar error", async () => {
      validateGetDevices.mockReturnValue({ valid: true });
      req.params.userId = "user-123";
      const dbError = new Error("Database down");
      deviceService.getDevices.mockRejectedValue(dbError);

      await deviceController.getDevices(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });

    test("Merespons 200 dan meneruskan tenantID ke Service jika sukses", async () => {
      validateGetDevices.mockReturnValue({ valid: true });
      req.params.userId = "user-123";
      deviceService.getDevices.mockResolvedValue([{ installationId: "DEV-1" }]);

      await deviceController.getDevices(req, res, next);

      // REVISI: Pastikan Controller melempar parameter ganda ke Service
      expect(deviceService.getDevices).toHaveBeenCalledWith("user-123", mockTenantID);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("2. approveDevice", () => {
    test("Merespons 400 jika validator menolak (installationId kosong)", async () => {
      validateDeviceAction.mockReturnValue({ valid: false, errors: ["ID kosong"] });
      await deviceController.approveDevice(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Meneruskan error 401 ke next() jika identitas pengguna (req.pengguna.id) tidak ada", async () => {
      validateDeviceAction.mockReturnValue({ valid: true });
      req.pengguna.id = undefined; 
      req.pengguna._id = undefined;

      await deviceController.approveDevice(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });

    test("Meneruskan error 401 ke next() jika identitas toko (tenantID) tidak ada", async () => {
      validateDeviceAction.mockReturnValue({ valid: true });
      req.pengguna.tenantID = undefined;

      await deviceController.approveDevice(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });

    test("Merespons 200 jika berhasil menyetujui perangkat", async () => {
      validateDeviceAction.mockReturnValue({ valid: true });
      req.body.installationId = "DEV-1";
      deviceService.approveDevice.mockResolvedValue({ status: "TRUSTED" });

      await deviceController.approveDevice(req, res, next);

      // REVISI: Pastikan objek payload ke Service memiliki tenantID
      expect(deviceService.approveDevice).toHaveBeenCalledWith({
        installationId: "DEV-1",
        approvedByUserId: "user-123",
        tenantID: mockTenantID,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("3. revokeDevice", () => {
    test("Merespons 400 jika validator menolak", async () => {
      validateDeviceAction.mockReturnValue({ valid: false, errors: ["Error"] });
      await deviceController.revokeDevice(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Meneruskan error 401 ke next() jika identitas pengguna tidak ada", async () => {
      validateDeviceAction.mockReturnValue({ valid: true });
      req.pengguna.id = undefined; 
      await deviceController.revokeDevice(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });

    test("Meneruskan error 401 ke next() jika identitas toko (tenantID) tidak ada", async () => {
      validateDeviceAction.mockReturnValue({ valid: true });
      req.pengguna.tenantID = undefined; 
      await deviceController.revokeDevice(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });

    test("Merespons 200 dan meneruskan revokedByUserId dan tenantID ke Service", async () => {
      validateDeviceAction.mockReturnValue({ valid: true });
      req.body.installationId = "DEV-X";
      deviceService.revokeDevice.mockResolvedValue({ status: "REVOKED" });

      await deviceController.revokeDevice(req, res, next);

      expect(deviceService.revokeDevice).toHaveBeenCalledWith({
        installationId: "DEV-X",
        revokedByUserId: "user-123",
        tenantID: mockTenantID, // REVISI
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("4. selfApproveDevice", () => {
    test("Merespons 400 jika validator menolak", async () => {
      validateDeviceAction.mockReturnValue({ valid: false, errors: ["Error"] });
      await deviceController.selfApproveDevice(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Meneruskan error 401 ke next() jika identitas pemohon tidak ada", async () => {
      validateDeviceAction.mockReturnValue({ valid: true });
      req.pengguna.id = undefined; 
      req.pengguna._id = undefined;
      await deviceController.selfApproveDevice(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });

    test("Merespons 200 dan meneruskan penggunaId pemohon ke Service", async () => {
      validateDeviceAction.mockReturnValue({ valid: true });
      req.body.installationId = "BUDI-DEV2";
      deviceService.selfApproveDevice.mockResolvedValue({ status: "TRUSTED" });

      await deviceController.selfApproveDevice(req, res, next);

      // selfApproveDevice tidak memerlukan tenantID sesuai arsitektur kita
      expect(deviceService.selfApproveDevice).toHaveBeenCalledWith({
        installationId: "BUDI-DEV2",
        penggunaId: "user-123",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});