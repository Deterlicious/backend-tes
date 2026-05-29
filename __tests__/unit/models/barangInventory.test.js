const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const BarangInventory = require("../../../models/barangInventoryModel");

let mongoServer;
const tid = new mongoose.Types.ObjectId();

const baseBarangInventory = (overrides = {}) => ({
  namaBarang: "Spatula Stainless",
  tipe: "ALAT_DAPUR",
  satuan: "unit",
  tenantID: tid,
  ...overrides,
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await BarangInventory.deleteMany({});
});

describe("BarangInventory Model - Unit Test", () => {
  test("barang inventory valid harus lolos validasi", async () => {
    const barang = new BarangInventory(baseBarangInventory());
    await expect(barang.validate()).resolves.toBeUndefined();
  });

  test("namaBarang, tipe, satuan, dan tenantID wajib diisi", async () => {
    const barang = new BarangInventory({});
    await expect(barang.validate()).rejects.toThrow();
  });

  test("tipe harus sesuai enum", async () => {
    const barang = new BarangInventory(
      baseBarangInventory({ tipe: "BAHAN_BAKU" }),
    );
    await expect(barang.validate()).rejects.toThrow();
  });

  test("namaBarang yang sama dalam satu tenant harus gagal", async () => {
    await BarangInventory.create(baseBarangInventory({ namaBarang: "Loyang" }));
    const duplikat = new BarangInventory(
      baseBarangInventory({ namaBarang: "Loyang" }),
    );

    await expect(duplikat.save()).rejects.toThrow();
  });

  test("namaBarang sama di tenant berbeda harus berhasil", async () => {
    const tenantLain = new mongoose.Types.ObjectId();

    await BarangInventory.create(baseBarangInventory({ namaBarang: "Oven" }));
    const barangTenantLain = new BarangInventory(
      baseBarangInventory({ namaBarang: "Oven", tenantID: tenantLain }),
    );

    await expect(barangTenantLain.save()).resolves.toBeDefined();
  });
});
