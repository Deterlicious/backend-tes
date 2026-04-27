const mongoose = require("mongoose");
const Inventory = require("../../../models/inventoryModel");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;
const tid = new mongoose.Types.ObjectId();
const lid = new mongoose.Types.ObjectId();
const bid = new mongoose.Types.ObjectId();
const barangId = new mongoose.Types.ObjectId();

const baseInventory = (overrides = {}) => ({
  bahanBakuID: bid,
  locationID: lid,
  stok: 10,
  stokMinimum: 5,
  tenantID: tid,
  ...overrides,
});

beforeAll(async () => {
  // 1. Pastikan tidak ada koneksi aktif yang tersisa
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // 2. Baru jalankan MongoMemoryServer
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  // 3. Tutup koneksi dengan rapi setelah selesai
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // 4. Bersihkan data antar skenario test agar tidak bentrok
  await Inventory.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Inventory Model — Unit Test", () => {
  test("Harus lolos validasi jika data lengkap", async () => {
    const inv = new Inventory(baseInventory());
    await expect(inv.validate()).resolves.toBeUndefined();
  });

  test("Stok dan stokMinimum tidak boleh negatif", async () => {
    const inv = new Inventory(baseInventory({ stok: -1, stokMinimum: -5 }));
    await expect(inv.validate()).rejects.toThrow(); //
  });

  test("Wajib memiliki salah satu item dan locationID", async () => {
    const inv = new Inventory({ tenantID: tid });
    await expect(inv.validate()).rejects.toThrow();
  });

  test("Boleh memakai barangInventoryID sebagai item inventory", async () => {
    const inv = new Inventory(
      baseInventory({ bahanBakuID: undefined, barangInventoryID: barangId }),
    );
    await expect(inv.validate()).resolves.toBeUndefined();
  });

  test("Tidak boleh memiliki bahanBakuID dan barangInventoryID sekaligus", async () => {
    const inv = new Inventory(baseInventory({ barangInventoryID: barangId }));
    await expect(inv.validate()).rejects.toThrow();
  });

  test("Compound Index: Tidak boleh ada duplikat bahanBaku di lokasi yang sama", async () => {
    await Inventory.create(baseInventory());
    const duplikat = new Inventory(baseInventory());
    await expect(duplikat.save()).rejects.toThrow(); //
  });

  test("Compound Index: Tidak boleh ada duplikat barangInventory di lokasi yang sama", async () => {
    const barangInventory = baseInventory({
      bahanBakuID: undefined,
      barangInventoryID: barangId,
    });

    await Inventory.create(barangInventory);
    const duplikat = new Inventory(barangInventory);
    await expect(duplikat.save()).rejects.toThrow();
  });
});
