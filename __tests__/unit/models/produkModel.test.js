const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Produk = require("../../../models/produkModel");

let mongoServer;
const tid = new mongoose.Types.ObjectId(); // satu tenant untuk base test

/**
 * Helper untuk menyediakan data produk dasar
 */
const baseProduk = (overrides = {}) => ({
  namaProduk: "Kopi Latte",
  hargaDasar: 10000,
  hargaJual: 15000,
  kategoriID: new mongoose.Types.ObjectId(),
  tenantID: tid,
  resep: [
    {
      bahanBakuID: new mongoose.Types.ObjectId(),
      jumlah: 100,
      satuan: "ml",
    },
  ],
  ...overrides,
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Produk.deleteMany({});
});

describe("Produk Model — Unit Test", () => {
  // ✅ Skenario A: Produk valid
  test("A: produk valid harus lolos validasi", async () => {
    const p = new Produk(baseProduk());
    await expect(p.validate()).resolves.toBeUndefined();
  });

  // ❌ Skenario B: Field Wajib (namaProduk, hargaDasar, tenantID)
  test("B: field wajib (namaProduk, hargaDasar, tenantID) harus diisi", async () => {
    const p = new Produk({ hargaJual: 10000 }); // Melewatkan field wajib
    await expect(p.validate()).rejects.toThrow();
  });

  // ❌ Skenario C: Nilai Negatif tidak diperbolehkan
  test("C: hargaDasar dan stok tidak boleh negatif", async () => {
    const p = new Produk(baseProduk({ hargaDasar: -500, stok: -10 }));
    await expect(p.validate()).rejects.toThrow();
  });

  // ❌ Skenario D: Enum Satuan Resep
  test("D: satuan resep selain enum harus ditolak", async () => {
    const p = new Produk(
      baseProduk({
        resep: [
          {
            bahanBakuID: new mongoose.Types.ObjectId(),
            jumlah: 10,
            satuan: "ember",
          },
        ],
      }),
    );
    await expect(p.validate()).rejects.toThrow();
  });

  // ❌ Skenario E: Duplicate Name dalam satu Tenant (Compound Index)
  test("E: duplikat namaProduk dalam satu tenant harus gagal", async () => {
    await Produk.create(baseProduk({ namaProduk: "Kopi Duplikat" }));
    const duplikat = new Produk(baseProduk({ namaProduk: "Kopi Duplikat" }));
    await expect(duplikat.save()).rejects.toThrow(); // MongoServerError code 11000
  });

  // ✅ Skenario F: Nama sama di Tenant berbeda
  test("F: namaProduk sama di tenant lain harus lolos", async () => {
    const tenant2 = new mongoose.Types.ObjectId();
    await Produk.create(baseProduk({ namaProduk: "Kopi Sama" }));
    const p2 = new Produk(
      baseProduk({ namaProduk: "Kopi Sama", tenantID: tenant2 }),
    );
    await expect(p2.save()).resolves.toBeDefined();
  });

  // ✅ Skenario G: Trim Nama Produk
  test("G: namaProduk harus otomatis di-trim", async () => {
    const p = await Produk.create(
      baseProduk({ namaProduk: "   Kopi Trim   " }),
    );
    expect(p.namaProduk).toBe("Kopi Trim");
  });

  // ✅ Skenario H: Default Value Stok
  test("H: stok harus default ke 0", async () => {
    const p = new Produk(baseProduk({ stok: undefined }));
    await p.validate();
    expect(p.stok).toBe(0);
  });
});
