const mongoose = require("mongoose");
const sesiBookingService = require("../../../services/sesiBookingService");

const SesiBooking = require("../../../models/sesiBookingModel");
const Penjualan = require("../../../models/penjualanModel");
const Aset = require("../../../models/asetModel");
const Tarif = require("../../../models/tarifModel");
const Diskon = require("../../../models/diskonModel");

const diskonService = require("../../../services/diskonService");
const pajakService = require("../../../services/pajakService");
const redis = require("../../../config/redis");
const {
  validateSesiBookingPayload,
} = require("../../../validators/sesiBookingValidator");

// 🔥 MOCKING SEMUA DEPENDENSI EKSTERNAL
jest.mock("../../../models/sesiBookingModel");
jest.mock("../../../models/penjualanModel");
jest.mock("../../../models/asetModel");
jest.mock("../../../models/tarifModel");
jest.mock("../../../models/diskonModel");
jest.mock("../../../services/diskonService");
jest.mock("../../../services/pajakService");
jest.mock("../../../validators/sesiBookingValidator");

jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

describe("Unit Test — Service — Sesi Booking", () => {
  const mockTenantID = new mongoose.Types.ObjectId().toString();
  const mockAsetID = new mongoose.Types.ObjectId().toString();
  const mockBookingID = new mongoose.Types.ObjectId().toString();
  const mockPenjualanID = new mongoose.Types.ObjectId().toString();

  const mockDateStr = "2026-05-11T10:00:00.000Z";
  const mockDateWIB = "2026-05-11";

  // Helper untuk Mongoose Chaining
  const mockChain = (value) => {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(value),
    };
    return chain;
  };

  beforeAll(() => {
    // Kunci waktu sistem di 2026-05-11T03:00:00.000Z (Setara 10:00 WIB)
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-11T03:00:00.000Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    pajakService.hitungPajakProduk.mockResolvedValue({
      grandTotal: 100000,
      rincian: [],
      totalPajak: 0,
    });
    diskonService.validateKombinasiDiskon.mockResolvedValue({ valid: true });
    validateSesiBookingPayload.mockReturnValue({ valid: true });
  });

  describe("Fungsi Internal & Format Output", () => {
    test("_generateNoReferensi: Harus menghasilkan nomor referensi dengan format dan timezone (WIB) yang benar", () => {
      // 03:00:00 UTC = 10:00:00 WIB
      const noRef = sesiBookingService._generateNoReferensi();
      expect(noRef).toMatch(/^INV\/TKA\/20260511\/100000000$/);
    });

    test("_normalizeIds: Harus menangani string kosong, undefined, array, dan single id", () => {
      expect(sesiBookingService._normalizeIds(undefined)).toEqual([]);
      expect(sesiBookingService._normalizeIds("id-1")).toEqual(["id-1"]);
      expect(sesiBookingService._normalizeIds(["id-1", null, "id-2"])).toEqual([
        "id-1",
        "id-2",
      ]);
    });

    test("_formatPenjualanOutput: Sukses format dengan fallback jika item kosong", () => {
      expect(sesiBookingService._formatPenjualanOutput(null)).toBeNull();

      const doc = {
        _id: "penj",
        statusPenjualan: "FINAL",
        itemPenjualan: null,
      };
      const res = sesiBookingService._formatPenjualanOutput(doc);
      expect(res.itemPenjualan).toEqual([]);
      expect(res.diskonGlobal).toEqual([]);
    });
  });

  describe("Perhitungan Tarif & Konflik", () => {
    test("_checkConflict: Mengembalikan true jika ada sesi yang bentrok", async () => {
      SesiBooking.findOne.mockReturnValue(mockChain({ _id: "bentrok" }));
      const result = await sesiBookingService._checkConflict(
        mockAsetID,
        "2026-05-11T10:00:00Z",
        "2026-05-11T12:00:00Z",
        mockBookingID,
      );
      expect(SesiBooking.findOne).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test("_findBestTarif: Memilih tarif berdasarkan prioritas dan kecocokan jam/hari", async () => {
      const mockTarifs = [
        {
          namaTarif: "Tarif Default",
          isDefault: true,
          prioritas: 1,
          harga: 50000,
        },
        {
          namaTarif: "Tarif Weekend",
          hariAktif: [1],
          prioritas: 10,
          harga: 75000,
        }, // Cocok (1 = Senin di mock time)
      ];
      Tarif.find.mockReturnValue(mockChain(mockTarifs));

      const best = await sesiBookingService._findBestTarif(
        mockTenantID,
        "tipe-1",
        mockDateStr,
      );
      expect(best.namaTarif).toBe("Tarif Weekend");
    });

    test("_calculateCost: Melempar error jika aset tidak ditemukan", async () => {
      Aset.findById.mockResolvedValue(null);
      await expect(
        sesiBookingService._calculateCost(
          mockTenantID,
          mockAsetID,
          null,
          60,
          mockDateStr,
        ),
      ).rejects.toThrow(/Aset tidak ditemukan/i);
    });

    test("_calculateCost: Menghitung biaya 'per jam' dengan durasi minimum yang benar", async () => {
      const mockAsset = { tipeAsetID: "tipe_1" };
      const mockTarif = {
        _id: "t_1",
        tipeAsetID: ["tipe_1"],
        basisPerhitungan: "per jam",
        harga: 50000,
        durasiMinimum: 2,
      };

      Aset.findById.mockResolvedValue(mockAsset);
      Tarif.findOne.mockResolvedValue(mockTarif);

      // Sewa hanya 1 jam (60 menit), tapi durasiMinimum adalah 2 jam. Harga harus 100k.
      const result = await sesiBookingService._calculateCost(
        mockTenantID,
        mockAsetID,
        "t_1",
        60,
        mockDateStr,
      );
      expect(result.harga).toBe(100000);
    });
  });

  describe("Diskon Berlapis (_applyDiskonBerurutan)", () => {
    test("Menghitung diskon nominal dan persen secara berurutan tanpa membuat minus", async () => {
      Diskon.find.mockReturnValue(
        mockChain([
          { _id: "d1", tipe: "nominal", nilai: 30000 },
          { _id: "d2", tipe: "persen", nilai: 50 }, // 50% dari sisa
        ]),
      );

      // Urutan ids menentukan eksekusi
      const ids = ["d1", "d2"];
      const res = await sesiBookingService._applyDiskonBerurutan({
        baseAmount: 100000,
        diskonIds: ids,
        tenantID: mockTenantID,
        cakupan: "Item",
      });

      // 100k - 30k = 70k. Diskon ke-2 (50%) dari 70k = 35k. Total Diskon = 65k.
      expect(res.totalDiskon).toBe(65000);
    });

    test("Melempar error jika ID diskon tidak ditemukan di DB (Status non-aktif/Beda tenant)", async () => {
      Diskon.find.mockReturnValue(mockChain([])); // DB kosong
      const res = await sesiBookingService._applyDiskonBerurutan({
        baseAmount: 100,
        diskonIds: ["d1"],
        tenantID: mockTenantID,
        cakupan: "Item",
      });
      expect(res.error).toBeDefined();
    });
  });

  describe("Method: getAll", () => {
    test("Sukses mengambil data dari Cache", async () => {
      redis.get.mockResolvedValue(JSON.stringify([{ _id: "b1" }]));
      const result = await sesiBookingService.getAll(
        mockTenantID,
        "2026-05-11",
      );
      expect(result).toHaveLength(1);
      expect(SesiBooking.find).not.toHaveBeenCalled();
    });

    test("Cache miss: Mengambil dari DB, filter tanggal, auto-selesai sesi expired, dan simpan cache", async () => {
      redis.get.mockResolvedValue(null);
      // Buat mock sesi yang SUDAH LEWAT waktu selesai (Expired)
      const mockPastBooking = {
        _id: "b1",
        status: "Aktif",
        waktuSelesai: new Date("2026-05-10T00:00:00Z"),
      };

      SesiBooking.find.mockReturnValue(mockChain([mockPastBooking]));
      SesiBooking.updateOne = jest.fn().mockResolvedValue();

      const result = await sesiBookingService.getAll(
        mockTenantID,
        "2026-05-11",
      );

      expect(SesiBooking.updateOne).toHaveBeenCalledWith(
        { _id: "b1" },
        { status: "Selesai" },
      );
      expect(result[0].status).toBe("Selesai"); // Output terekam sebagai selesai
      expect(redis.set).toHaveBeenCalled(); // Cache disimpan
    });
  });

  describe("Method: create", () => {
    test("Gagal jika payload tidak valid dari validator", async () => {
      validateSesiBookingPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid Payload"],
      });
      const res = await sesiBookingService.create({});
      expect(res.error).toEqual(["Invalid Payload"]);
    });

    test("Sukses kalkulasi, buat Booking, Penjualan, dan Invalidate Cache", async () => {
      const payload = {
        tenantID: mockTenantID,
        dataAset: mockAsetID,
        waktuMulai: "2026-05-11T10:00:00Z",
        waktuSelesai: "2026-05-11T12:00:00Z",
      };

      Aset.findById.mockResolvedValue({
        _id: mockAsetID,
        tenantID: mockTenantID,
        namaAset: "Aset 1",
      });
      jest.spyOn(sesiBookingService, "_checkConflict").mockResolvedValue(false);
      jest
        .spyOn(sesiBookingService, "_calculateCost")
        .mockResolvedValue({ harga: 50000, tarifObj: { _id: "t_1" } });
      jest
        .spyOn(sesiBookingService, "_applyDiskonBerurutan")
        .mockResolvedValue({ totalDiskon: 0, appliedIds: [] });

      // Mock Penjualan & Booking Instance
      Penjualan.prototype.save = jest.fn().mockResolvedValue();
      SesiBooking.prototype.save = jest.fn().mockResolvedValue();
      SesiBooking.findById = jest
        .fn()
        .mockReturnValue(mockChain({ _id: mockBookingID }));

      const res = await sesiBookingService.create(payload);

      expect(Penjualan.prototype.save).toHaveBeenCalled();
      expect(SesiBooking.prototype.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled(); // Cache dihapus
      expect(res._id).toBe(mockBookingID);
    });
  });

  describe("Method: update", () => {
    const validUpdate = {
      waktuSelesai: "2026-05-11T14:00:00Z",
      status: "Aktif",
    };

    test("Ditolak jika status booking saat ini Selesai/Batal", async () => {
      SesiBooking.findOne.mockResolvedValue({ status: "Selesai" });
      const res = await sesiBookingService.update(
        "b_1",
        validUpdate,
        mockTenantID,
      );
      expect(res.error[0]).toMatch(/tidak dapat diubah lagi/i);
    });

    test("Ditolak jika status penjualan terkait adalah FINAL", async () => {
      SesiBooking.findOne.mockResolvedValue({
        status: "Aktif",
        dataPenjualan: "p_1",
      });
      Penjualan.findOne.mockResolvedValue({ statusPenjualan: "FINAL" });

      const res = await sesiBookingService.update(
        "b_1",
        validUpdate,
        mockTenantID,
      );
      expect(res.error[0]).toMatch(/sudah FINAL/i);
    });

    test("Sukses recalculate harga jika jadwal diubah dan penjualan belum FINAL", async () => {
      SesiBooking.findOne.mockResolvedValue({
        _id: "b_1",
        status: "Aktif",
        dataPenjualan: "p_1",
        waktuMulai: "2026-05-11T10:00:00Z",
      });

      const mockPenj = {
        statusPenjualan: "PENDING",
        itemPenjualan: [{ sesiBookingID: "b_1", totalharga: 0 }],
        save: jest.fn().mockResolvedValue(),
      };
      Penjualan.findOne.mockResolvedValue(mockPenj);

      jest.spyOn(sesiBookingService, "_checkConflict").mockResolvedValue(false);
      jest
        .spyOn(sesiBookingService, "_calculateCost")
        .mockResolvedValue({ harga: 150000, tarifObj: { _id: "t_1" } });
      jest
        .spyOn(sesiBookingService, "_applyDiskonBerurutan")
        .mockResolvedValue({ totalDiskon: 0, appliedIds: [] });
      SesiBooking.findOneAndUpdate = jest
        .fn()
        .mockReturnValue(mockChain({ _id: "b_1" }));

      await sesiBookingService.update("b_1", validUpdate, mockTenantID);

      expect(sesiBookingService._calculateCost).toHaveBeenCalled();
      expect(mockPenj.save).toHaveBeenCalled(); // Data penjualan diperbarui
      expect(SesiBooking.findOneAndUpdate).toHaveBeenCalled();
    });
  });

  describe("Method: delete", () => {
    test("Gagal jika status booking sudah Batal", async () => {
      SesiBooking.findOne.mockReturnValue(mockChain({ status: "Batal" }));
      const res = await sesiBookingService.delete("b_1", mockTenantID);
      expect(res.error[0]).toMatch(/tidak dapat dihapus/i);
    });

    test("Sukses menghapus booking dan item terkait di Penjualan. Hapus Penjualan jika item kosong.", async () => {
      SesiBooking.findOne.mockReturnValue(
        mockChain({
          _id: "b_1",
          status: "Aktif",
          dataPenjualan: "p_1",
          waktuMulai: "2026-05-11",
        }),
      );

      const mockPenj = {
        _id: "p_1",
        statusPenjualan: "PENDING",
        itemPenjualan: [{ sesiBookingID: "b_1" }],
      }; // Hanya 1 item (akan habis)
      Penjualan.findOne.mockResolvedValue(mockPenj);

      SesiBooking.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
      Penjualan.deleteOne = jest.fn().mockResolvedValue();

      await sesiBookingService.delete("b_1", mockTenantID);

      expect(SesiBooking.deleteOne).toHaveBeenCalled();
      expect(Penjualan.deleteOne).toHaveBeenCalled(); // Karena item habis difilter
      expect(redis.del).toHaveBeenCalled(); // Cache clear
    });
  });

  describe("Method: createBatch (Multiple Bookings)", () => {
    test("Sukses memproses banyak item booking ke dalam satu invoice", async () => {
      const payload = {
        tenantID: mockTenantID,
        items: [
          {
            dataAset: mockAsetID,
            waktuMulai: "2026-05-11T10:00:00Z",
            waktuSelesai: "2026-05-11T12:00:00Z",
          },
          {
            dataAset: mockAsetID,
            waktuMulai: "2026-05-12T10:00:00Z",
            waktuSelesai: "2026-05-12T12:00:00Z",
          },
        ],
      };

      Aset.findById.mockResolvedValue({
        _id: mockAsetID,
        tenantID: mockTenantID,
        namaAset: "Aset",
      });
      jest.spyOn(sesiBookingService, "_checkConflict").mockResolvedValue(false);
      jest
        .spyOn(sesiBookingService, "_calculateCost")
        .mockResolvedValue({ harga: 50000, tarifObj: { _id: "t_1" } });
      jest
        .spyOn(sesiBookingService, "_applyDiskonBerurutan")
        .mockResolvedValue({ totalDiskon: 0, appliedIds: [] });

      Penjualan.prototype.save = jest.fn().mockResolvedValue();
      SesiBooking.insertMany = jest.fn().mockResolvedValue();

      const res = await sesiBookingService.createBatch(payload);

      expect(Penjualan.prototype.save).toHaveBeenCalled();
      expect(SesiBooking.insertMany).toHaveBeenCalled();
      expect(res.totalBookings).toBe(2); // 2 item sukses diproses
    });

    test("Gagal dan membatalkan seluruh proses jika salah satu item bentrok jadwal", async () => {
      const payload = {
        tenantID: mockTenantID,
        items: [
          {
            dataAset: mockAsetID,
            waktuMulai: "2026-05-11T10:00:00Z",
            waktuSelesai: "2026-05-11T12:00:00Z",
          },
        ],
      };
      Aset.findById.mockResolvedValue({ tenantID: mockTenantID });
      jest.spyOn(sesiBookingService, "_checkConflict").mockResolvedValue(true); // Sengaja bentrok

      const res = await sesiBookingService.createBatch(payload);
      expect(res.error[0]).toMatch(/bentrok pada jam tersebut/i);
    });
  });
  // =====================================================================
  // 🔥 TAMBAHAN UNTUK MENCAPAI 100% COVERAGE (EDGE CASES & CABANG IF)
  // =====================================================================

  describe("Method: getById (Skenario Lengkap)", () => {
    test("Sukses (Cache Hit) mengembalikan data jika tenantID cocok", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ _id: "b_1", tenantID: mockTenantID }),
      );
      const result = await sesiBookingService.getById("b_1", mockTenantID);
      expect(result._id).toBe("b_1");
    });

    test("Gagal (Return null) dari cache jika tenantID berbeda (Isolasi Tenant)", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ _id: "b_1", tenantID: mockTenantID }),
      );
      const result = await sesiBookingService.getById("b_1", "hacker_tenant");
      expect(result).toBeNull();
    });

    test("Gagal (Return null) jika data tidak ditemukan di Database", async () => {
      redis.get.mockResolvedValue(null);
      SesiBooking.findOne.mockReturnValue(mockChain(null));
      const result = await sesiBookingService.getById(
        "b_invalid",
        mockTenantID,
      );
      expect(result).toBeNull();
    });

    test("Sukses (Cache Miss) mengambil dari DB dan menyimpan ke Cache", async () => {
      redis.get.mockResolvedValue(null);
      SesiBooking.findOne.mockReturnValue(
        mockChain({ _id: "b_1", tenantID: mockTenantID }),
      );

      const result = await sesiBookingService.getById("b_1", mockTenantID);
      expect(result._id).toBe("b_1");
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe("Method: _calculateCost (Skenario Error Spesifik)", () => {
    const mockAsset = {
      _id: mockAsetID,
      namaAset: "Lapangan A",
      tipeAsetID: "tipe_1",
    };

    beforeEach(() => {
      if (sesiBookingService._calculateCost.mockRestore) {
        sesiBookingService._calculateCost.mockRestore();
      }
    });

    test("Melempar error jika Tarif Manual dikirim tapi tidak ditemukan di DB", async () => {
      Aset.findById.mockResolvedValue(mockAsset);
      Tarif.findOne.mockResolvedValue(null); // Tarif tidak ada

      await expect(
        sesiBookingService._calculateCost(
          mockTenantID,
          mockAsetID,
          "tarif_manual_invalid",
          60,
          mockDateStr,
        ),
      ).rejects.toThrow(/Tarif manual tidak ditemukan/i);
    });

    test("Melempar error jika Tarif Manual valid TAPI tipe asetnya tidak cocok", async () => {
      Aset.findById.mockResolvedValue(mockAsset); // aset tipe_1
      Tarif.findOne.mockResolvedValue({
        _id: "t_1",
        namaTarif: "Tarif Kamar",
        tipeAsetID: ["tipe_lain"],
      }); // beda tipe

      await expect(
        sesiBookingService._calculateCost(
          mockTenantID,
          mockAsetID,
          "t_1",
          60,
          mockDateStr,
        ),
      ).rejects.toThrow(/tidak berlaku untuk aset/i);
    });

    test("Melempar error jika Tarif Otomatis tidak ditemukan jam/harinya", async () => {
      Aset.findById.mockResolvedValue(mockAsset);
      Tarif.find.mockReturnValue(mockChain([])); // Tidak ada tarif cocok

      await expect(
        sesiBookingService._calculateCost(
          mockTenantID,
          mockAsetID,
          null,
          60,
          mockDateStr,
        ),
      ).rejects.toThrow(/Tidak ditemukan tarif yang cocok/i);
    });
  });

  describe("Method: create & createBatch (Skenario Error Validasi)", () => {
    test("Create: Gagal jika aset tidak ditemukan", async () => {
      Aset.findById.mockResolvedValue(null);
      const res = await sesiBookingService.create({
        tenantID: mockTenantID,
        dataAset: mockAsetID,
      });
      expect(res.error[0]).toMatch(/Aset tidak ditemukan/i);
    });

    test("Create: Gagal jika aset beda tenant (Cegah ID Insecure Direct Object Reference)", async () => {
      Aset.findById.mockResolvedValue({ tenantID: "tenant_orang_lain" });
      const res = await sesiBookingService.create({
        tenantID: mockTenantID,
        dataAset: mockAsetID,
      });
      expect(res.error[0]).toMatch(/aset bukan milik tenant Anda/i);
    });

    test("Create: Gagal jika waktuSelesai tidak dikirim (wajib untuk booking)", async () => {
      Aset.findById.mockResolvedValue({ tenantID: mockTenantID });
      const res = await sesiBookingService.create({
        tenantID: mockTenantID,
        dataAset: mockAsetID,
        waktuSelesai: null,
      });
      expect(res.error[0]).toMatch(/waktuSelesai wajib diisi/i);
    });

    test("createBatch: Gagal jika items kosong atau bukan array", async () => {
      const res1 = await sesiBookingService.createBatch({ items: [] });
      const res2 = await sesiBookingService.createBatch({
        items: "bukan-array",
      });
      expect(res1.error[0]).toMatch(/Daftar item booking.*wajib diisi/i);
      expect(res2.error[0]).toMatch(/Daftar item booking.*wajib diisi/i);
    });
  });

  describe("Method: update & delete (Skenario Error Spesifik & VOID/FINAL)", () => {
    test("Update: Mengembalikan null jika booking tidak ditemukan", async () => {
      SesiBooking.findOne.mockResolvedValue(null);
      const res = await sesiBookingService.update(
        "invalid_id",
        {},
        mockTenantID,
      );
      expect(res).toBeNull();
    });

    test("Update: Gagal jika data Penjualan hilang di tengah jalan", async () => {
      SesiBooking.findOne.mockResolvedValue({
        status: "Aktif",
        dataPenjualan: mockPenjualanID,
      });
      Penjualan.findOne.mockResolvedValue(null); // Penjualan raib
      const res = await sesiBookingService.update("b_1", {}, mockTenantID);
      expect(res.error[0]).toMatch(/Data penjualan booking tidak ditemukan/i);
    });

    test("Update: Gagal jika data Penjualan sudah VOID", async () => {
      SesiBooking.findOne.mockResolvedValue({
        status: "Aktif",
        dataPenjualan: mockPenjualanID,
      });
      Penjualan.findOne.mockResolvedValue({ statusPenjualan: "VOID" });
      const res = await sesiBookingService.update("b_1", {}, mockTenantID);
      expect(res.error[0]).toMatch(/sudah VOID/i);
    });

    test("Delete: Mengembalikan null jika booking tidak ditemukan", async () => {
      SesiBooking.findOne.mockReturnValue(mockChain(null));
      const res = await sesiBookingService.delete("invalid_id", mockTenantID);
      expect(res).toBeNull();
    });

    test("Delete: Gagal jika penjualan terkait sudah FINAL", async () => {
      SesiBooking.findOne.mockReturnValue(
        mockChain({
          _id: "b_1",
          status: "Aktif",
          dataPenjualan: mockPenjualanID,
        }),
      );
      Penjualan.findOne.mockResolvedValue({ statusPenjualan: "FINAL" });
      const res = await sesiBookingService.delete("b_1", mockTenantID);
      expect(res.error[0]).toMatch(/sudah FINAL/i);
    });

    test("Delete: Gagal jika penjualan terkait sudah VOID", async () => {
      SesiBooking.findOne.mockReturnValue(
        mockChain({
          _id: "b_1",
          status: "Aktif",
          dataPenjualan: mockPenjualanID,
        }),
      );
      Penjualan.findOne.mockResolvedValue({ statusPenjualan: "VOID" });
      const res = await sesiBookingService.delete("b_1", mockTenantID);
      expect(res.error[0]).toMatch(/sudah VOID/i);
    });

    test("Delete: Gagal jika item booking tidak ada di dalam array itemPenjualan", async () => {
      SesiBooking.findOne.mockReturnValue(
        mockChain({
          _id: "b_1",
          status: "Aktif",
          dataPenjualan: mockPenjualanID,
        }),
      );
      Penjualan.findOne.mockResolvedValue({
        statusPenjualan: "PENDING",
        itemPenjualan: [{ sesiBookingID: "booking_lain" }],
      });
      const res = await sesiBookingService.delete("b_1", mockTenantID);
      expect(res.error[0]).toMatch(
        /Item booking tidak ditemukan pada data penjualan/i,
      );
    });
  });
});
