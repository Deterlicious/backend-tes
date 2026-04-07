const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const inventoryService = require("../../../services/inventoryService");

// Import Model
const Produk = require("../../../models/produkModel");
const Inventory = require("../../../models/inventoryModel");
const JurnalStok = require("../../../models/jurnalStokModel");
const BahanBaku = require("../../../models/bahanBakuModel");
// Pastikan require ini memicu mongoose.model("Location", ...)
const Location = require("../../../models/locationModel");

const tid = new mongoose.Types.ObjectId();
const lid = new mongoose.Types.ObjectId();
const bid = new mongoose.Types.ObjectId();
const uid = new mongoose.Types.ObjectId(); // ID untuk dicatatOleh
const kid = new mongoose.Types.ObjectId(); // ID Kategori

const baseInventory = (overrides = {}) => ({
  bahanBakuID: bid,
  locationID: lid,
  stok: 10,
  stokMinimum: 5,
  tenantID: tid,
  ...overrides,
});

let mongoServer;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // SANGAT PENTING: Registrasi nama "Lokasi" jika Inventory menggunakan ref: "Lokasi"
  // Jika Inventory menggunakan ref: "Location", baris ini tidak perlu.
  if (!mongoose.models.Lokasi) {
    mongoose.model("Lokasi", Location.schema);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Inventory.deleteMany({});
  await JurnalStok.deleteMany({});
});

describe("Inventory Service — Integration Test", () => {
  describe("getAll()", () => {
    test("Harus bisa memfilter berdasarkan lokasiId", async () => {
      // Setup data pendukung agar populate tidak null
      await BahanBaku.create({
        _id: bid,
        namaBahan: "Kopi",
        tenantID: tid,
        satuan: "kg",
        kategori: "Bahan Kering",
      });
      await Location.create({
        _id: lid,
        nama: "Gudang",
        tipe: "Gudang",
        alamat: "Test",
        tenantID: tid,
      });
      await Inventory.create(baseInventory());

      const mockUser = { tenantID: tid, role: "owner" };
      const query = { lokasiId: lid.toString() };

      const result = await inventoryService.getAll(query, mockUser);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("submitOpname()", () => {
    test("Harus mengupdate stok ke angka fisik dan mencatat JurnalStok", async () => {
      const inv = await Inventory.create(baseInventory({ stok: 10 }));
      const payload = { fisikAktual: 8, catatan: "2 kg tumpah" };
      const mockUser = { _id: uid, tenantID: tid }; // Pastikan ada _id

      const updated = await inventoryService.submitOpname(
        inv._id,
        payload,
        mockUser,
      );

      expect(updated.stok).toBe(8);

      // Verifikasi JurnalStok
      const jurnal = await JurnalStok.findOne({ inventoryID: inv._id });
      // Jika model kamu tidak menyimpan inventoryID, cari berdasarkan bahanBakuID & locationID
      const jurnalFix = await JurnalStok.findOne({
        bahanBakuID: bid,
        locationID: lid,
      });

      expect(jurnalFix).toBeDefined();
      expect(jurnalFix.jumlah).toBe(2); // Selisih 10 - 8
      expect(jurnalFix.tipeKoreksi).toBe("Keluar");
      expect(jurnalFix.alasan).toBe("Stok Opname"); // Sesuai Enum Model kamu
      expect(jurnalFix.dicatatOleh.toString()).toBe(uid.toString());
    });
  });

  describe("updateMinimumStok()", () => {
    test("Harus berhasil memperbarui batas minimum stok (TC-INV-03)", async () => {
      const inv = await Inventory.create(baseInventory({ stokMinimum: 5 }));
      const mockUser = { tenantID: tid };
      const payload = { stokMinimum: 20 };

      const updated = await inventoryService.updateMinimumStok(
        inv._id,
        payload,
        mockUser,
      );

      expect(updated.stokMinimum).toBe(20);
    });

    test("Harus gagal jika stokMinimum yang diinput negatif", async () => {
      const inv = await Inventory.create(baseInventory({ stokMinimum: 5 }));
      const payload = { stokMinimum: -10 };

      await expect(
        inventoryService.updateMinimumStok(inv._id, payload, { tenantID: tid }),
      ).rejects.toThrow("Stok minimum tidak boleh negatif");
    });
  });

  describe("decreaseStok()", () => {
    test("Harus berhasil mengurangi stok jika saldo mencukupi", async () => {
      const inv = await Inventory.create(baseInventory({ stok: 50 }));
      const mockUser = { tenantID: tid };

      const result = await inventoryService.decreaseStok(inv._id, 20, mockUser);

      expect(result.stok).toBe(30); // 50 - 20
    });

    test("Harus gagal (Throw Error) jika stok di bawah jumlah yang diminta (TC-TRF-04)", async () => {
      const inv = await Inventory.create(baseInventory({ stok: 5 }));
      const mockUser = { tenantID: tid };

      // Mencoba mengurangi 10 padahal stok cuma 5
      await expect(
        inventoryService.decreaseStok(inv._id, 10, mockUser),
      ).rejects.toThrow("Stok tidak mencukupi untuk melakukan transaksi ini");

      // Pastikan stok di DB tetap 5 (tidak berubah/tidak jadi minus)
      const checkInv = await Inventory.findById(inv._id);
      expect(checkInv.stok).toBe(5);
    });
  });

  describe("Inventory Service — Process Sale Stock", () => {
    test("Berhasil: Potong stok produk & bahan baku sesuai resep", async () => {
      // 1. Setup Produk dengan data LENGKAP agar tidak ValidationError
      const produk = await Produk.create({
        namaProduk: "Kopi Susu",
        stok: 10,
        hargaJual: 15000,
        hargaDasar: 5000,
        kategoriID: kid, // Field wajib
        tenantID: tid,
        resep: [
          {
            bahanBakuID: bid,
            jumlah: 2,
            satuan: "pcs", // Field wajib di resep
          },
        ],
      });

      // 2. Setup Inventory Bahan Baku
      await Inventory.create({
        bahanBakuID: bid,
        locationID: lid,
        stok: 20,
        tenantID: tid,
      });

      // 3. Eksekusi
      const result = await inventoryService.processSaleStock(
        produk._id,
        2,
        lid,
        tid,
        uid,
      );

      // 4. Verifikasi
      expect(result.stok).toBe(8);
      const invData = await Inventory.findOne({
        bahanBakuID: bid,
        locationID: lid,
      });
      expect(invData.stok).toBe(16);
    });

    test("Gagal: Bahan baku di Inventory tidak cukup (TC-TRF-04)", async () => {
      const produk = await Produk.create({
        namaProduk: "Kopi Susu",
        stok: 10,
        hargaJual: 15000,
        hargaDasar: 5000,
        kategoriID: kid,
        tenantID: tid,
        resep: [{ bahanBakuID: bid, jumlah: 2, satuan: "pcs" }],
      });

      await Inventory.create({
        bahanBakuID: bid,
        locationID: lid,
        stok: 1, // Cuma ada 1, butuh 2
        tenantID: tid,
      });

      await expect(
        inventoryService.processSaleStock(produk._id, 1, lid, tid, uid),
      ).rejects.toThrow(/Bahan baku/);
    });
  });
});
