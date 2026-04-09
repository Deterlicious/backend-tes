const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const permintaanStokService = require("../../../services/permintaanStokService");
const redis = require("../../../config/redis");

// Import Model
const PermintaanStok = require("../../../models/permintaanStokModel");
const Inventory = require("../../../models/inventoryModel");
const JurnalStok = require("../../../models/jurnalStokModel");

const tid = new mongoose.Types.ObjectId(); // Tenant ID
const lGudang = new mongoose.Types.ObjectId(); // Lokasi Asal (Gudang)
const lOutlet = new mongoose.Types.ObjectId(); // Lokasi Tujuan (Outlet)
const bid = new mongoose.Types.ObjectId(); // Bahan Baku ID
const uid = new mongoose.Types.ObjectId(); // User ID (Admin)

let mongoServer;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  if (redis && redis.quit) {
    await redis.quit(); // Menutup koneksi agar Jest tidak hang
  }
});

describe("Permintaan Stok Service — Integration Test", () => {
  describe("approve() - Mutasi Stok & Jurnal", () => {
    test("Harus berhasil memindahkan stok dan mencatat 2 Jurnal (Masuk & Keluar)", async () => {
      // 1. SETUP: Stok di Gudang ada 100, di Outlet ada 0
      await Inventory.create({
        bahanBakuID: bid,
        locationID: lGudang,
        stok: 100,
        tenantID: tid,
      });

      // 2. SETUP: Buat Dokumen Permintaan (Minta 30 barang)
      const permintaan = await PermintaanStok.create({
        nomorRequest: "REQ/202401/0001",
        dariLocationID: lGudang,
        keLocationID: lOutlet,
        items: [{ bahanBakuID: bid, jumlah: 30 }],
        status: "SUBMITTED",
        tenantID: tid,
        dimintaOleh: uid,
      });

      // 3. EKSEKUSI: Approve oleh Admin
      const result = await permintaanStokService.approve(
        permintaan._id,
        tid,
        uid,
      );

      // 4. VERIFIKASI: Status berubah
      expect(result.status).toBe("COMPLETED");

      // 5. VERIFIKASI: Stok di Gudang berkurang (100 - 30 = 70)
      const invGudang = await Inventory.findOne({
        bahanBakuID: bid,
        locationID: lGudang,
      });
      expect(invGudang.stok).toBe(70);

      // 6. VERIFIKASI: Stok di Outlet bertambah (0 + 30 = 30)
      const invOutlet = await Inventory.findOne({
        bahanBakuID: bid,
        locationID: lOutlet,
      });
      expect(invOutlet.stok).toBe(30);

      // 7. VERIFIKASI: Jurnal Stok tercatat 2 (Keluar & Masuk)
      const jurnalKeluar = await JurnalStok.findOne({
        locationID: lGudang,
        tipeKoreksi: "Keluar",
      });
      const jurnalMasuk = await JurnalStok.findOne({
        locationID: lOutlet,
        tipeKoreksi: "Masuk",
      });

      expect(jurnalKeluar.jumlah).toBe(30);
      expect(jurnalMasuk.jumlah).toBe(30);
      expect(jurnalKeluar.alasan).toBe("Transfer Gudang");
    });

    test("Harus gagal jika stok di lokasi asal (Gudang) tidak mencukupi", async () => {
      // SETUP: Stok Gudang cuma 10
      await Inventory.create({
        bahanBakuID: bid,
        locationID: lGudang,
        stok: 10,
        tenantID: tid,
      });

      // Minta 50 (Padahal cuma ada 10)
      const permintaan = await PermintaanStok.create({
        nomorRequest: "REQ/202401/0002",
        dariLocationID: lGudang,
        keLocationID: lOutlet,
        items: [{ bahanBakuID: bid, jumlah: 50 }],
        status: "SUBMITTED",
        tenantID: tid,
        dimintaOleh: uid,
      });

      // EKSEKUSI & VERIFIKASI: Harus Error
      await expect(
        permintaanStokService.approve(permintaan._id, tid, uid),
      ).rejects.toThrow(/tidak mencukupi/);

      // Pastikan stok gudang TIDAK BERUBAH (tetap 10)
      const invGudang = await Inventory.findOne({
        bahanBakuID: bid,
        locationID: lGudang,
      });
      expect(invGudang.stok).toBe(10);
    });
  });

  describe("create() - Auto Numbering", () => {
    test("Harus membuat nomor request dengan format REQ/YYYYMM/0001", async () => {
      const payload = {
        dariLocationID: lGudang,
        keLocationID: lOutlet,
        items: [{ bahanBakuID: bid, jumlah: 10 }],
        tenantID: tid,
        dimintaOleh: uid,
      };

      const result = await permintaanStokService.create(payload);

      expect(result.nomorRequest).toMatch(/^REQ\/\d{6}\/0001$/);
    });
  });
});
