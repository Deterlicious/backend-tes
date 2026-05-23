const createError = require("http-errors");

// 1. MOCK REDIS
jest.mock("../../../config/redis", () => ({
  on: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}));

// 2. MOCK ROLE SERVICE
jest.mock("../../../services/roleService", () => ({
  getAll: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

const roleController = require("../../../controllers/roleController");
const roleService = require("../../../services/roleService");

// =====================================================================
// HELPER: Membuat mock req, res, next
// =====================================================================
const mockReq = (overrides = {}) => ({
  pengguna: { id: "user-123", tenantID: "mock-tenant-id-123" },
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = () => jest.fn();

describe("Unit Test — Role Controller", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================================================================
  // 1. getAll
  // =====================================================================
  describe("1. getAll", () => {

    test("Mengembalikan daftar role (200) dengan permissions ter-format dengan benar", async () => {
      const fakeRoles = [
        { _id: "role-1", namaRole: "Kasir", deskripsi: "Kasir toko", permissions: [{ nama: "read-produk" }] },
        { _id: "role-2", namaRole: "Manajer", deskripsi: "Manajer toko", permissions: [{ nama: "update-produk" }] },
      ];
      roleService.getAll.mockResolvedValue(fakeRoles);

      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      await roleController.getAll(req, res, next);

      expect(roleService.getAll).toHaveBeenCalledWith("mock-tenant-id-123");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Daftar role berhasil diambil.",
          total: 2,
          data: expect.arrayContaining([
            expect.objectContaining({ namaRole: "Kasir", permissions: ["read-produk"] }),
            expect.objectContaining({ namaRole: "Manajer", permissions: ["update-produk"] }),
          ]),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("Mengembalikan daftar role (200) dengan permissions kosong jika role tidak punya permission", async () => {
      // Skenario wajib: permissions null/undefined harus di-handle oleh controller
      // Controller punya guard: permissions ? permissions.map(...) : []
      const fakeRoles = [
        { _id: "role-1", namaRole: "Kasir", deskripsi: "Kasir toko", permissions: null },
      ];
      roleService.getAll.mockResolvedValue(fakeRoles);

      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      await roleController.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ namaRole: "Kasir", permissions: [] }),
          ]),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika tenantID tidak ada di req.pengguna", async () => {
      const req = mockReq({ pengguna: null });
      const res = mockRes();
      const next = mockNext();

      await roleController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(roleService.getAll).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error ke next() jika service melempar error", async () => {
      roleService.getAll.mockRejectedValue(createError(500, "Database error"));

      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      await roleController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // =====================================================================
  // 2. getById
  // =====================================================================
  describe("2. getById", () => {

    test("Mengembalikan detail role (200) dengan permissions ter-format dengan benar", async () => {
      const fakeRole = {
        _id: "role-1",
        namaRole: "Kasir",
        deskripsi: "Kasir toko",
        permissions: [{ nama: "read-produk" }, { nama: "create-transaksi" }],
      };
      roleService.getById.mockResolvedValue(fakeRole);

      const req = mockReq({ params: { id: "role-1" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.getById(req, res, next);

      expect(roleService.getById).toHaveBeenCalledWith("role-1", "mock-tenant-id-123");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Detail role berhasil diambil.",
          data: expect.objectContaining({
            _id: "role-1",
            namaRole: "Kasir",
            permissions: ["read-produk", "create-transaksi"],
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika tenantID tidak ada di req.pengguna", async () => {
      const req = mockReq({ pengguna: null, params: { id: "role-1" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(roleService.getById).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (404) ke next() jika service melempar role tidak ditemukan", async () => {
      roleService.getById.mockRejectedValue(createError(404, "Role tidak ditemukan"));

      const req = mockReq({ params: { id: "role-tidak-ada" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika service melempar akses lintas tenant", async () => {
      roleService.getById.mockRejectedValue(createError(403, "Akses lintas tenant ditolak"));

      const req = mockReq({ params: { id: "role-tenant-lain" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // =====================================================================
  // 3. create
  // =====================================================================
  describe("3. create", () => {

    test("Mengembalikan role baru (201) dan memanggil populate setelah service berhasil", async () => {
      const fakeResult = {
        _id: "role-baru-1",
        namaRole: "Supervisor",
        deskripsi: "Supervisor toko",
        permissions: [{ nama: "read-laporan" }],
        populate: jest.fn().mockResolvedValue(undefined),
      };
      roleService.create.mockResolvedValue(fakeResult);

      const req = mockReq({
        body: { namaRole: "Supervisor", deskripsi: "Supervisor toko", permissions: ["read-laporan"] },
      });
      const res = mockRes();
      const next = mockNext();

      await roleController.create(req, res, next);

      expect(roleService.create).toHaveBeenCalledWith(
        { namaRole: "Supervisor", deskripsi: "Supervisor toko", permissions: ["read-laporan"] },
        "mock-tenant-id-123"
      );
      // Memastikan populate dipanggil dengan argumen yang benar
      expect(fakeResult.populate).toHaveBeenCalledWith("permissions", "nama");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Role berhasil dibuat." })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("Meneruskan error ke next() jika populate gagal setelah service berhasil", async () => {
      // Skenario wajib: populate bisa throw error (misal koneksi DB putus setelah create)
      const fakeResult = {
        _id: "role-baru-1",
        namaRole: "Supervisor",
        deskripsi: "Supervisor toko",
        permissions: [],
        populate: jest.fn().mockRejectedValue(new Error("Populate failed")),
      };
      roleService.create.mockResolvedValue(fakeResult);

      const req = mockReq({
        body: { namaRole: "Supervisor", permissions: ["read-laporan"] },
      });
      const res = mockRes();
      const next = mockNext();

      await roleController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika tenantID tidak ada di req.pengguna", async () => {
      const req = mockReq({ pengguna: null, body: { namaRole: "Supervisor" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(roleService.create).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (400) ke next() jika service melempar validasi gagal", async () => {
      roleService.create.mockRejectedValue(createError(400, "Field 'permissions' wajib diisi minimal 1"));

      const req = mockReq({ body: { namaRole: "Supervisor", permissions: [] } });
      const res = mockRes();
      const next = mockNext();

      await roleController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika service melempar proteksi nama 'Owner'", async () => {
      roleService.create.mockRejectedValue(
        createError(403, "Nama role 'Owner' dilindungi oleh sistem dan tidak dapat dibuat secara manual.")
      );

      const req = mockReq({ body: { namaRole: "Owner", permissions: ["read-produk"] } });
      const res = mockRes();
      const next = mockNext();

      await roleController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // =====================================================================
  // 4. update
  // =====================================================================
  describe("4. update", () => {

    test("Mengembalikan role yang diperbarui (200) dengan permissions ter-format dengan benar", async () => {
      const fakeUpdated = {
        _id: "role-1",
        namaRole: "Kasir Senior",
        deskripsi: "Kasir senior toko",
        permissions: [{ nama: "read-produk" }, { nama: "update-produk" }],
      };
      roleService.update.mockResolvedValue(fakeUpdated);

      const req = mockReq({
        params: { id: "role-1" },
        body: { namaRole: "Kasir Senior", permissions: ["read-produk", "update-produk"] },
      });
      const res = mockRes();
      const next = mockNext();

      await roleController.update(req, res, next);

      expect(roleService.update).toHaveBeenCalledWith(
        "role-1",
        { namaRole: "Kasir Senior", permissions: ["read-produk", "update-produk"] },
        "mock-tenant-id-123"
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Role berhasil diperbarui.",
          data: expect.objectContaining({
            permissions: ["read-produk", "update-produk"],
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika tenantID tidak ada di req.pengguna", async () => {
      const req = mockReq({ pengguna: null, params: { id: "role-1" }, body: {} });
      const res = mockRes();
      const next = mockNext();

      await roleController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(roleService.update).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (404) ke next() jika service melempar role tidak ditemukan", async () => {
      roleService.update.mockRejectedValue(createError(404, "Role tidak ditemukan"));

      const req = mockReq({ params: { id: "role-tidak-ada" }, body: { namaRole: "X" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika service melempar proteksi role Owner diubah", async () => {
      roleService.update.mockRejectedValue(createError(403, "Owner tidak boleh diubah"));

      const req = mockReq({ params: { id: "role-owner" }, body: { namaRole: "Bukan Owner" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika service melempar proteksi hijacking nama 'Owner'", async () => {
      roleService.update.mockRejectedValue(
        createError(403, "Tidak dapat menggunakan nama 'Owner' karena dilindungi oleh sistem.")
      );

      const req = mockReq({ params: { id: "role-1" }, body: { namaRole: "Owner" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika service melempar proteksi permissions Owner diubah", async () => {
      roleService.update.mockRejectedValue(createError(403, "Owner permissions tidak boleh diubah"));

      const req = mockReq({ params: { id: "role-owner" }, body: { permissions: ["read-produk"] } });
      const res = mockRes();
      const next = mockNext();

      await roleController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // =====================================================================
  // 5. delete
  // =====================================================================
  describe("5. delete", () => {

    test("Mengembalikan pesan sukses (200) jika service berhasil menghapus role", async () => {
      roleService.delete.mockResolvedValue(true);

      const req = mockReq({ params: { id: "role-1" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.delete(req, res, next);

      expect(roleService.delete).toHaveBeenCalledWith("role-1", "mock-tenant-id-123");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Role berhasil dihapus." })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika tenantID tidak ada di req.pengguna", async () => {
      const req = mockReq({ pengguna: null, params: { id: "role-1" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(roleService.delete).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (404) ke next() jika service melempar role tidak ditemukan", async () => {
      roleService.delete.mockRejectedValue(createError(404, "Role tidak ditemukan"));

      const req = mockReq({ params: { id: "role-tidak-ada" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (403) ke next() jika service melempar proteksi role Owner dihapus", async () => {
      roleService.delete.mockRejectedValue(createError(403, "Owner tidak dapat dihapus"));

      const req = mockReq({ params: { id: "role-owner" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(res.json).not.toHaveBeenCalled();
    });

    test("Meneruskan error (409) ke next() jika service melempar role masih terikat pengguna aktif", async () => {
      roleService.delete.mockRejectedValue(
        createError(409, "Role tidak dapat dihapus karena masih terikat pada pengguna aktif.")
      );

      const req = mockReq({ params: { id: "role-aktif" } });
      const res = mockRes();
      const next = mockNext();

      await roleController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});