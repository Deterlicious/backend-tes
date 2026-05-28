const mongoose = require("mongoose");
const penjualanService = require("../../../services/penjualanService");

const Penjualan = require("../../../models/penjualanModel");
const Diskon = require("../../../models/diskonModel");
const Produk = require("../../../models/produkModel");
const Pajak = require("../../../models/pajakModel");
const SesiBooking = require("../../../models/sesiBookingModel");

const pajakService = require("../../../services/pajakService");
const diskonService = require("../../../services/diskonService");
const redis = require("../../../config/redis");
const {
  validatePenjualanPayload,
} = require("../../../validators/penjualanValidator");

jest.mock("../../../models/penjualanModel");
jest.mock("../../../models/diskonModel");
jest.mock("../../../models/produkModel");
jest.mock("../../../models/pajakModel");
jest.mock("../../../models/sesiBookingModel");
jest.mock("../../../models/asetModel", () => ({ updateMany: jest.fn() })); // Untuk fungsi voidPenjualan

jest.mock("../../../services/pajakService");
jest.mock("../../../services/diskonService");
jest.mock("../../../validators/penjualanValidator");

jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

describe("Unit Test — Service — Penjualan", () => {
  const mockTenantID = new mongoose.Types.ObjectId().toString();
  const mockID = new mongoose.Types.ObjectId().toString();

  const mockChain = (value) => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  });

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-11T03:00:00.000Z")); // Setara 10:00:00 WIB
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Kembalikan semua fungsi yang mungkin di-spy di test case sebelumnya
    jest.restoreAllMocks();

    validatePenjualanPayload.mockReturnValue({ valid: true });
    diskonService.validateKombinasiDiskon.mockResolvedValue({ valid: true });
    pajakService.hitungPajakProduk.mockResolvedValue({
      rincian: [],
      totalPajak: 0,
      grandTotal: 100000,
    });
  });

  describe("Fungsi Internal Dasar & Formatters", () => {
    test("_normalizeIds: Mengembalikan array string yang valid", () => {
      expect(penjualanService._normalizeIds(undefined)).toEqual([]);
      expect(penjualanService._normalizeIds("id1")).toEqual(["id1"]);
      expect(penjualanService._normalizeIds(["id1", null, "id2"])).toEqual([
        "id1",
        "id2",
      ]);
    });

    test("_generateNoReferensi: Format WIB (UTC+7) POS dan INVOICE", () => {
      expect(penjualanService._generateNoReferensi("POS")).toMatch(
        /^POS\/TKA\/20260511\/100000000$/,
      );
      expect(penjualanService._generateNoReferensi("INVOICE")).toMatch(
        /^INV\/TKA\/20260511\/100000000$/,
      );
    });

    test("_formatOutput: Sukses format data lengkap termasuk object pajak dan fallback array kosong", () => {
      const doc = {
        _id: "p1",
        tenantID: mockTenantID,
        pajakTransaksiIDs: [{ _id: "pj1", namaPajak: "PPN" }, "pj2"], // Campuran object dan string
        _pajakTransaksiRincian: [{ pajakID: "pj1", jumlah: 5000 }],
        itemPenjualan: [
          { produkID: "prod1", rincianPajak: [{ tarifPajak: 10 }] },
        ],
      };

      const res = penjualanService._formatOutput(doc);
      expect(res.itemPenjualan[0].rincianPajak[0].tarifPajak).toBe(10);
      expect(res.pajakTransaksi[0].namaPajak).toBe("PPN");
      expect(res.pajakTransaksi[0].jumlah).toBe(5000); // Ter-match dengan rincian
      expect(res.pajakTransaksi[1]._id).toBe("pj2"); // String ID fallback
    });

    test("_formatOutput: Mengembalikan null jika doc kosong", () => {
      expect(penjualanService._formatOutput(null)).toBeNull();
    });
  });

  describe("Fungsi Filter (_applyFilters)", () => {
    const list = [
      {
        noReferensi: "POS-001",
        statusBayar: "PAID",
        statusPenjualan: "FINAL",
        jenisTransaksi: "POS",
        jenisPenjualan: "dine-in",
        dataPelanggan: "pel1",
        tanggalTransaksi: "2026-05-10T00:00:00Z",
      },
      {
        noReferensi: "INV-002",
        statusBayar: "UNPAID",
        statusPenjualan: "DRAFT",
        jenisTransaksi: "INVOICE",
        jenisPenjualan: "takeaway",
        dataPelanggan: { _id: "pel2" },
        tanggalTransaksi: "2026-05-12T00:00:00Z",
      },
    ];

    test("Filter sukses berdasarkan pencarian string, status, dan object referensi", () => {
      expect(
        penjualanService._applyFilters(list, { statusBayar: "PAID" }),
      ).toHaveLength(1);
      expect(
        penjualanService._applyFilters(list, { statusPenjualan: "DRAFT" }),
      ).toHaveLength(1);
      expect(
        penjualanService._applyFilters(list, { jenisTransaksi: "INVOICE" }),
      ).toHaveLength(1);
      expect(
        penjualanService._applyFilters(list, { jenisPenjualan: "dine-in" }),
      ).toHaveLength(1);
      expect(
        penjualanService._applyFilters(list, { noReferensi: "inv-002" }),
      ).toHaveLength(1); // Case insensitive
      expect(
        penjualanService._applyFilters(list, { pelangganID: "pel2" }),
      ).toHaveLength(1); // Mengurai object _id
    });

    test("Filter rentang tanggal (Start & End Date)", () => {
      const res = penjualanService._applyFilters(list, {
        startDate: "2026-05-11",
        endDate: "2026-05-13",
      });
      expect(res).toHaveLength(1);
      expect(res[0].noReferensi).toBe("INV-002");
    });
  });

  describe("Kalkulasi Matematika: Diskon & Pajak", () => {
    test("_applyDiskonBerurutan: Menghitung persentase dan nominal dengan clamping minimal 0", async () => {
      Diskon.find.mockReturnValue(
        mockChain([
          { _id: "d1", tipe: "persen", nilai: 50 },
          { _id: "d2", tipe: "nominal", nilai: 60000 },
        ]),
      );

      // Urutan array sangat penting. 100k - 50% = 50k. Lalu 50k - 60k = 0k (diskon dipotong di 50k).
      const res = await penjualanService._applyDiskonBerurutan({
        baseAmount: 100000,
        diskonIds: ["d1", "d2"],
        tenantID: mockTenantID,
      });
      expect(res.totalDiskon).toBe(100000); // 50k + 50k (bukan 60k, mentok 0)
    });

    test("_applyDiskonBerurutan: Melempar error jika jumlah diskon ditemukan di DB tidak sama dengan input", async () => {
      Diskon.find.mockReturnValue(mockChain([])); // Tidak ditemukan
      const res = await penjualanService._applyDiskonBerurutan({
        baseAmount: 100,
        diskonIds: ["d1"],
        tenantID: mockTenantID,
      });
      expect(res.error).toBeDefined();
    });

    test("_applyPajakTransaksi: Menghitung semua jenis model (Inclusive, Exclusive, Compound)", async () => {
      Pajak.find.mockReturnValue(
        mockChain([
          { _id: "pj1", modelPerhitungan: 1, tarifPajak: 10, prioritas: 1 }, // Inclusive dari 110k
          { _id: "pj2", modelPerhitungan: 2, tarifPajak: 5, prioritas: 2 }, // Exclusive dr base 110k = 5.5k
          { _id: "pj3", modelPerhitungan: 3, tarifPajak: 10, prioritas: 3 }, // Compound dr (110k - inc + ex) -> disederhanakan di fungsi aslinya runningTotal.
        ]),
      );

      const res = await penjualanService._applyPajakTransaksi({
        baseAmount: 110000,
        pajakIds: ["pj1", "pj2", "pj3"],
        tenantID: mockTenantID,
      });
      expect(res.rincian).toHaveLength(3);
      expect(res.totalPajak).toBeGreaterThan(0);
    });

    test("_applyPajakTransaksi: Mengembalikan 0 jika array kosong", async () => {
      const res = await penjualanService._applyPajakTransaksi({
        baseAmount: 100,
        pajakIds: [],
      });
      expect(res.totalPajak).toBe(0);
    });
  });

  describe("Jantung Aplikasi: Method _recalc (Kalkulasi Keseluruhan)", () => {
    test("Gagal jika produk tidak ditemukan di database", async () => {
      Produk.findOne.mockResolvedValue(null);
      const res = await penjualanService._recalc(
        { itemPenjualan: [{ produkID: "inv" }] },
        mockTenantID,
      );
      expect(res.error[0]).toMatch(/tidak ditemukan/i);
    });

    test("Sukses _recalc: Kalkulasi Harga, Diskon Manual (Clamping), Pajak Item, dan Diskon Global", async () => {
      Produk.findOne.mockResolvedValue({
        _id: "prod1",
        namaProduk: "Kopi",
        hargaJual: 50000,
      });

      jest
        .spyOn(penjualanService, "_applyDiskonBerurutan")
        .mockResolvedValue({ totalDiskon: 0, appliedIds: [] });
      jest
        .spyOn(penjualanService, "_getActivePajakTransaksi")
        .mockResolvedValue([]);
      jest.spyOn(penjualanService, "_applyPajakTransaksi").mockResolvedValue({
        totalPajak: 0,
        grandTotal: 40000,
        rincian: [],
        appliedIds: [],
      });

      const payload = {
        itemPenjualan: [{ produkID: "prod1", jumlah: 1, jumlahDiskon: 60000 }], // Diskon manual > subtotal (50k)
        jumlahDiskonTransaksi: -100, // Diskon global manual invalid (negatif)
      };

      const res = await penjualanService._recalc(payload, mockTenantID);

      // Diskon manual item harus di-clamp maksimal ke subtotal (50k)
      expect(res.payload.itemPenjualan[0].jumlahDiskon).toBe(50000);
      expect(res.payload.itemPenjualan[0].total).toBe(0); // 50k - 50k

      // Diskon transaksi manual negatif di-clamp ke 0
      expect(res.payload.jumlahDiskonTransaksi).toBe(0);
    });
  });

  describe("Method: voidPenjualan (Aksi Spesial)", () => {
    test("Sukses melakukan VOID dan mengubah status Sesi Booking menjadi BATAL", async () => {
      const mockPenjualan = {
        _id: "p1",
        statusPenjualan: "FINAL",
        save: jest.fn().mockResolvedValue(),
      };
      Penjualan.findById.mockResolvedValue(mockPenjualan);
      SesiBooking.updateMany = jest.fn().mockResolvedValue();

      const res = await penjualanService.voidPenjualan("p1");

      expect(mockPenjualan.statusPenjualan).toBe("VOID");
      expect(mockPenjualan.save).toHaveBeenCalled();
      expect(SesiBooking.updateMany).toHaveBeenCalledWith(
        { dataPenjualan: "p1" },
        { status: "BATAL" },
      );
      expect(res).toBe(true);
    });

    test("Melempar error jika penjualan tidak ditemukan", async () => {
      Penjualan.findById.mockResolvedValue(null);
      await expect(penjualanService.voidPenjualan("invalid")).rejects.toThrow(
        /tidak ditemukan/i,
      );
    });
  });

  describe("Method: create", () => {
    test("Gagal jika penggunaID tidak ada", async () => {
      const res = await penjualanService.create({ tenantID: mockTenantID });
      expect(res.error[0]).toMatch(/penggunaID wajib terisi/i);
    });

    test("Gagal jika mencoba membuat penjualan dengan status VOID", async () => {
      const res = await penjualanService.create({
        tenantID: mockTenantID,
        penggunaID: "u1",
        statusPenjualan: "VOID",
      });
      expect(res.error[0]).toMatch(
        /tidak boleh langsung dibuat dengan status VOID/i,
      );
    });

    test("Sukses Membuat FINAL dan Memotong Stok Produk", async () => {
      const payload = {
        tenantID: mockTenantID,
        penggunaID: "u1",
        statusPenjualan: "FINAL",
      };

      jest.spyOn(penjualanService, "_recalc").mockResolvedValue({
        payload: {
          ...payload,
          itemPenjualan: [{ produkID: "prod1", jumlah: 2 }],
        },
      });

      Penjualan.create.mockResolvedValue({
        _id: mockID,
        statusPenjualan: "FINAL",
        itemPenjualan: [{ produkID: "prod1", jumlah: 2 }],
      });
      Produk.findOneAndUpdate = jest.fn().mockResolvedValue(); // Mock potong stok
      Penjualan.findById = jest
        .fn()
        .mockReturnValue(mockChain({ _id: mockID }));

      await penjualanService.create(payload);

      expect(Penjualan.create).toHaveBeenCalled();
      expect(Produk.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "prod1", tenantID: mockTenantID },
        { $inc: { stok: -2 } },
      ); // Cek Stok Terpotong
      expect(redis.del).toHaveBeenCalled(); // Clear cache
    });
  });

  describe("Method: update", () => {
    const validPayload = { statusPenjualan: "DRAFT" };

    test("Gagal (Return null) jika data tidak ditemukan", async () => {
      Penjualan.findOne.mockResolvedValue(null);
      expect(
        await penjualanService.update("p1", validPayload, mockTenantID),
      ).toBeNull();
    });

    test("Gagal (Throw Error) jika status database sudah VOID", async () => {
      Penjualan.findOne.mockResolvedValue({ statusPenjualan: "VOID" });
      await expect(
        penjualanService.update("p1", validPayload, mockTenantID),
      ).rejects.toThrow(/VOID tidak bisa diubah/i);
    });

    test("Gagal (Throw Error) jika mencoba mengubah FINAL ke VOID langsung via endpoint update biasa", async () => {
      Penjualan.findOne.mockResolvedValue({ statusPenjualan: "FINAL" });
      await expect(
        penjualanService.update(
          "p1",
          { statusPenjualan: "VOID" },
          mockTenantID,
        ),
      ).rejects.toThrow(/FINAL tidak bisa langsung diubah ke VOID/i);
    });

    test("Sukses Update: DRAFT -> FINAL (Menjalankan Potong Stok dan Update Booking)", async () => {
      // PERBAIKAN: Menambahkan itemPenjualan ke dalam mockDoc dan toObject()
      const mockDoc = {
        statusPenjualan: "DRAFT",
        jenisPenjualan: "booking",
        itemPenjualan: [
          { produkID: "prod1", jumlah: 1, sesiBookingID: "b1", total: 50000 },
        ],
        toObject: () => ({
          statusPenjualan: "DRAFT",
          itemPenjualan: [
            {
              produkID: "prod1",
              jumlah: 1,
              sesiBookingID: "b1",
              total: 50000,
              diskonItemIDs: [],
            },
          ],
        }),
        save: jest.fn().mockResolvedValue(),
      };
      Penjualan.findOne.mockResolvedValue(mockDoc);

      jest.spyOn(penjualanService, "_recalc").mockResolvedValue({
        payload: {
          itemPenjualan: [
            { produkID: "prod1", jumlah: 1, sesiBookingID: "b1", total: 50000 },
          ],
        },
      });

      Produk.findOneAndUpdate = jest.fn().mockResolvedValue();
      SesiBooking.findByIdAndUpdate = jest.fn().mockResolvedValue();
      Penjualan.findById = jest.fn().mockReturnValue(mockChain({ _id: "p1" }));

      // Finalize the update
      await penjualanService.update("p1", { finalize: true }, mockTenantID);

      expect(mockDoc.save).toHaveBeenCalled();
      expect(Produk.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object), {
        $inc: { stok: -1 },
      }); // Cek Stok Dipotong
      expect(SesiBooking.findByIdAndUpdate).toHaveBeenCalledWith("b1", {
        totalBiaya: 50000,
      }); // Booking Diupdate
    });

    test("Sukses Update: Khusus ke VOID (Mematikan Sesi Booking dan Cache)", async () => {
      const mockDoc = {
        statusPenjualan: "DRAFT",
        save: jest.fn().mockResolvedValue(),
      };
      Penjualan.findOne.mockResolvedValue(mockDoc);
      SesiBooking.updateMany = jest.fn().mockResolvedValue();
      Penjualan.findById = jest.fn().mockReturnValue(mockChain({ _id: "p1" }));

      await penjualanService.update(
        "p1",
        { statusPenjualan: "VOID" },
        mockTenantID,
      );

      expect(mockDoc.statusPenjualan).toBe("VOID");
      expect(mockDoc.save).toHaveBeenCalled();
      expect(SesiBooking.updateMany).toHaveBeenCalledWith(
        { dataPenjualan: "p1" },
        { status: "Batal" },
      );
    });
  });

  describe("Method: delete", () => {
    test("Mengembalikan null jika tidak ditemukan", async () => {
      Penjualan.findOne.mockReturnValue(mockChain(null));
      expect(await penjualanService.delete("p1", mockTenantID)).toBeNull();
    });

    test("Gagal menghapus jika data FINAL atau VOID", async () => {
      Penjualan.findOne.mockReturnValueOnce(
        mockChain({ statusPenjualan: "FINAL" }),
      );
      await expect(penjualanService.delete("p1", mockTenantID)).rejects.toThrow(
        /FINAL tidak bisa dihapus/i,
      );

      Penjualan.findOne.mockReturnValueOnce(
        mockChain({ statusPenjualan: "VOID" }),
      );
      await expect(penjualanService.delete("p1", mockTenantID)).rejects.toThrow(
        /VOID tidak bisa dihapus/i,
      );
    });

    test("Sukses menghapus penjualan DRAFT", async () => {
      Penjualan.findOne.mockReturnValue(
        mockChain({ statusPenjualan: "DRAFT" }),
      );
      Penjualan.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });

      const res = await penjualanService.delete("p1", mockTenantID);
      expect(Penjualan.deleteOne).toHaveBeenCalled();
      expect(res).toBe(true);
    });
  });

  describe("Method: getAll & getById (Redis Cache)", () => {
    test("getAll: Mengambil dari cache", async () => {
      redis.get.mockResolvedValue(JSON.stringify([{ _id: "p1" }]));
      const res = await penjualanService.getAll(mockTenantID);
      expect(res[0]._id).toBe("p1");
    });

    test("getById: Cache miss dan simpan ke Redis", async () => {
      redis.get.mockResolvedValue(null);
      Penjualan.findOne.mockReturnValue(mockChain({ _id: "p1" }));

      await penjualanService.getById("p1", mockTenantID);
      expect(Penjualan.findOne).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
    });
  });
});
