const asetService = require("../../../services/asetService");
const Aset = require("../../../models/asetModel");
const SesiBooking = require("../../../models/sesiBookingModel");
const redis = require("../../../config/redis");
const { validateAsetPayload } = require("../../../validators/asetValidator");

jest.mock("../../../models/asetModel");
jest.mock("../../../models/sesiBookingModel");
jest.mock("../../../validators/asetValidator");
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
}));

describe("Unit Test — Service — Aset", () => {
  const mockTenantID = "tenant_1";
  const fixedDate = new Date("2026-05-09T14:00:00.000Z"); // Fix waktu untuk pengujian SesiBooking

  const mockTipeAset = {
    _id: "tipe_1",
    namaTipeAset: "Lapangan",
    deskripsi: "Outdoor",
  };
  const mockDoc = {
    _id: "aset_1",
    tenantID: mockTenantID,
    namaAset: "Lapangan Basket A",
    status: "tersedia", // Status dari DB
    tipeAsetID: mockTipeAset, // Ter-populate
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockChain = (value) => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  });

  beforeAll(() => {
    // Kunci waktu sistem agar pengecekan SesiBooking ($lte: now, $gte: now) konsisten
    jest.useFakeTimers();
    jest.setSystemTime(fixedDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Internal Method: clearCache", () => {
    test("Sukses membersihkan cache list dan detail menggunakan pola SCAN", async () => {
      redis.scan.mockResolvedValueOnce(["0", ["aset:list:tenant_1:{}"]]);

      await asetService.clearCache(mockTenantID, "aset_1");

      expect(redis.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        `aset:list:${mockTenantID}:*`,
        "COUNT",
        100,
      );
      expect(redis.del).toHaveBeenCalledWith(
        "aset:list:tenant_1:{}",
        "aset:detail:aset_1",
      );
    });

    test("Tidak memanggil redis.del jika scan tidak menemukan key yang cocok", async () => {
      redis.scan.mockResolvedValueOnce(["0", []]);

      await asetService.clearCache(mockTenantID);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe("Internal Method: _formatOutput (Logika Status Dinamis Real-Time)", () => {
    test("Jika status di DB adalah 'perbaikan', maka hiraukan inUseSet dan tetap return 'perbaikan'", () => {
      const docPerbaikan = { ...mockDoc, status: "perbaikan" };
      const inUseSet = new Set(["aset_1"]); // Sedang dalam jadwal booking

      const formatted = asetService._formatOutput(docPerbaikan, inUseSet);
      expect(formatted.status).toBe("perbaikan");
    });

    test("Jika ID aset ADA di inUseSet, maka ubah statusnya menjadi 'digunakan'", () => {
      const inUseSet = new Set(["aset_1"]); // Ada di set jadwal aktif
      const formatted = asetService._formatOutput(mockDoc, inUseSet);

      expect(formatted.status).toBe("digunakan");
    });

    test("Jika ID aset TIDAK ADA di inUseSet, maka pastikan statusnya 'tersedia'", () => {
      const inUseSet = new Set(["aset_2"]); // Aset lain yang dipakai
      const formatted = asetService._formatOutput(mockDoc, inUseSet);

      expect(formatted.status).toBe("tersedia");
    });

    test("Mengembalikan null jika data tidak terdefinisi dan men-handle array dengan benar", () => {
      expect(asetService._formatOutput(null)).toBeNull();

      const arrayResult = asetService._formatOutput(
        [mockDoc, { ...mockDoc, _id: "aset_2" }],
        new Set(["aset_2"]),
      );
      expect(arrayResult).toHaveLength(2);
      expect(arrayResult[0].status).toBe("tersedia"); // aset_1
      expect(arrayResult[1].status).toBe("digunakan"); // aset_2
    });
  });

  describe("Method: getAll", () => {
    test("Gagal (Throw 400) jika tenantID tidak dikirim", async () => {
      await expect(asetService.getAll()).rejects.toThrow(/Tenant ID required/i);
    });

    test("Sukses mengambil data dari Cache tanpa menyentuh database", async () => {
      redis.get.mockResolvedValue(JSON.stringify([{ _id: "aset_1" }]));
      const result = await asetService.getAll(mockTenantID, {
        tipeAsetID: "tipe_1",
      });

      expect(redis.get).toHaveBeenCalledWith(
        `aset:list:${mockTenantID}:{"tipeAsetID":"tipe_1"}`,
      );
      expect(result).toHaveLength(1);
      expect(Aset.find).not.toHaveBeenCalled();
    });

    test("Sukses (Cache Miss) memproses Filter DB, Mencegat Sesi Booking Aktif, Filter Status Dinamis, dan Cache (EX: 60)", async () => {
      redis.get.mockResolvedValue(null);

      // 1. Mock DB Aset (Misal ada 2 aset di DB)
      const mockDoc2 = { ...mockDoc, _id: "aset_2" };
      Aset.find.mockReturnValue(mockChain([mockDoc, mockDoc2]));

      // 2. Mock DB SesiBooking (Misal aset_2 saat ini sedang dipakai)
      SesiBooking.find.mockReturnValue(mockChain([{ dataAset: "aset_2" }]));

      // Panggil fungsi dengan filter status hasil olahan ('digunakan')
      const result = await asetService.getAll(mockTenantID, {
        status: "digunakan",
      });

      expect(Aset.find).toHaveBeenCalledWith({ tenantID: mockTenantID });
      expect(SesiBooking.find).toHaveBeenCalledWith({
        tenantID: mockTenantID,
        status: "Aktif",
        waktuMulai: { $lte: fixedDate },
        $or: [{ waktuSelesai: null }, { waktuSelesai: { $gte: fixedDate } }],
      });

      // Aset 1 harus difilter keluar (karena tersedia), hanya Aset 2 yang tertinggal (digunakan)
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("aset_2");
      expect(result[0].status).toBe("digunakan");

      // Verifikasi Redis EX di-set 60 detik (bukan 300 seperti sebelumnya) karena ini dinamis
      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        "EX",
        60,
      );
    });
  });

  describe("Method: getById", () => {
    test("Sukses (Cache Hit) mengembalikan data jika tenantID cocok", async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockDoc));
      const result = await asetService.getById("aset_1", mockTenantID);
      expect(result._id).toBe("aset_1");
    });

    test("Gagal (Return null) dari cache jika tenantID mismatch (Isolasi Tenant)", async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockDoc));
      const result = await asetService.getById("aset_1", "tenant_lain");
      expect(result).toBeNull();
    });

    test("Sukses (Cache Miss) Menganalisis single aset dan single sesi booking aktif", async () => {
      redis.get.mockResolvedValue(null);
      Aset.findOne.mockReturnValue(mockChain(mockDoc));

      // Aset ini sedang dipakai di booking
      SesiBooking.findOne.mockReturnValue(mockChain({ _id: "booking_1" }));

      const result = await asetService.getById("aset_1", mockTenantID);

      expect(Aset.findOne).toHaveBeenCalledWith({
        _id: "aset_1",
        tenantID: mockTenantID,
      });
      expect(SesiBooking.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          dataAset: "aset_1", // Memastikan dia query persis ke id aset ini
          status: "Aktif",
        }),
      );
      expect(result.status).toBe("digunakan"); // Cek dinamis sukses
      expect(redis.set).toHaveBeenCalledWith(
        `aset:detail:aset_1`,
        expect.any(String),
        "EX",
        60,
      );
    });
  });

  describe("Method: create", () => {
    const validPayload = {
      tenantID: mockTenantID,
      namaAset: "Aset A",
      status: "digunakan",
    };

    beforeEach(() => {
      validateAsetPayload.mockReturnValue({ valid: true });
      jest.spyOn(asetService, "clearCache").mockResolvedValue();
      jest
        .spyOn(asetService, "getById")
        .mockResolvedValue({ _id: "aset_new", status: "tersedia" });
    });

    test("Gagal jika payload tidak lolos validasi", async () => {
      validateAsetPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid"],
      });
      const result = await asetService.create({});
      expect(result.error).toEqual(["Invalid"]);
    });

    test("Sukses meng-override status 'digunakan' menjadi 'tersedia', membuat data DB, clear cache, dan melempar ke getById", async () => {
      Aset.create.mockResolvedValue({ _id: "aset_new" });

      const result = await asetService.create(validPayload);

      // Pastikan status dipaksa 'tersedia' untuk mencegah kecurangan/bug kasir
      expect(Aset.create).toHaveBeenCalledWith({
        ...validPayload,
        status: "tersedia",
      });
      expect(asetService.clearCache).toHaveBeenCalledWith(mockTenantID);
      expect(asetService.getById).toHaveBeenCalledWith(
        "aset_new",
        mockTenantID,
      );
      expect(result._id).toBe("aset_new");
    });
  });

  describe("Method: update", () => {
    const updatePayload = {
      namaAset: "Aset Update",
      status: "digunakan",
      tenantID: "hacker_id",
    };

    beforeEach(() => {
      validateAsetPayload.mockReturnValue({ valid: true });
      jest.spyOn(asetService, "clearCache").mockResolvedValue();
      jest
        .spyOn(asetService, "getById")
        .mockResolvedValue({ _id: "aset_1", status: "tersedia" });
    });

    test("Gagal jika payload update tidak lolos validasi", async () => {
      validateAsetPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid"],
      });
      const result = await asetService.update(
        "aset_1",
        updatePayload,
        mockTenantID,
      );
      expect(result.error).toEqual(["Invalid"]);
    });

    test("Sukses menghapus tenantID dari payload, memaksa status 'digunakan' -> 'tersedia', dan update ke DB", async () => {
      Aset.findOneAndUpdate.mockResolvedValue(mockDoc); // simulasi ditemukan

      const result = await asetService.update(
        "aset_1",
        updatePayload,
        mockTenantID,
      );

      expect(Aset.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "aset_1", tenantID: mockTenantID },
        { namaAset: "Aset Update", status: "tersedia" }, // tenantID terhapus, status terganti
        expect.any(Object),
      );
      expect(asetService.clearCache).toHaveBeenCalledWith(
        mockTenantID,
        "aset_1",
      );
      expect(asetService.getById).toHaveBeenCalledWith("aset_1", mockTenantID);
      expect(result._id).toBe("aset_1");
    });

    test("Mengembalikan null jika aset tidak ditemukan di DB saat diupdate", async () => {
      Aset.findOneAndUpdate.mockResolvedValue(null);
      const result = await asetService.update(
        "aset_1",
        { status: "perbaikan" },
        mockTenantID,
      );
      expect(result).toBeNull();
    });
  });

  describe("Method: delete", () => {
    beforeEach(() => {
      jest.spyOn(asetService, "clearCache").mockResolvedValue();
    });

    test("Mengembalikan null jika dokumen tidak ditemukan", async () => {
      Aset.deleteOne.mockResolvedValue({ deletedCount: 0 });
      const result = await asetService.delete("aset_1", mockTenantID);
      expect(result).toBeNull();
    });

    test("Sukses menghapus data aset dari DB dan membersihkan cache", async () => {
      Aset.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await asetService.delete("aset_1", mockTenantID);

      expect(Aset.deleteOne).toHaveBeenCalledWith({
        _id: "aset_1",
        tenantID: mockTenantID,
      });
      expect(asetService.clearCache).toHaveBeenCalledWith(
        mockTenantID,
        "aset_1",
      );
      expect(result).toBe(true);
    });
  });
});
