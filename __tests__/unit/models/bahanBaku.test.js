const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const BahanBaku = require("../../../models/bahanBakuModel");

let mongoServer;
const tid = new mongoose.Types.ObjectId();

/**
 * Helper untuk menyediakan data bahan baku dasar
 */
const baseBahanBaku = (overrides = {}) => ({
  namaBahan: "Biji Kopi Arabica",
  stok: 10,
  satuan: "kg",
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
  await BahanBaku.deleteMany({});
});

describe("Bahan Baku Model — Unit Test", () => {
  // ✅ Skenario A: Input Valid
  test("A: bahan baku valid harus lolos validasi", async () => {
    const b = new BahanBaku(baseBahanBaku());
    await expect(b.validate()).resolves.toBeUndefined();
  });

  // ❌ Skenario B: Field Wajib
  test("B: namaBahan, satuan, dan tenantID wajib diisi", async () => {
    const b = new BahanBaku({ stok: 5 });
    await expect(b.validate()).rejects.toThrow();
  });

  // ❌ Skenario C: Stok Tidak Boleh Negatif
  // Penting untuk F&B agar tidak ada "stok ghaib" yang minus saat sistem error
  test("C: stok tidak boleh kurang dari 0", async () => {
    const b = new BahanBaku(baseBahanBaku({ stok: -1 }));
    await expect(b.validate()).rejects.toThrow();
  });

  // ❌ Skenario D: Enum Satuan Standar F&B
  // Memastikan kasir/admin tidak input satuan aneh seperti "ember" atau "karung"
  test("D: satuan selain enum (kg, gram, liter, ml, pcs, pak, unit) harus ditolak", async () => {
    const b = new BahanBaku(baseBahanBaku({ satuan: "bungkus" }));
    await expect(b.validate()).rejects.toThrow();
  });

  // ❌ Skenario E: Duplicate Name per Tenant (Compound Index)
  // Menghindari kebingungan stok (misal ada dua bahan bernama "Gula Pasir" di satu toko)
  test("E: namaBahan yang sama dalam satu tenant harus gagal", async () => {
    await BahanBaku.create(baseBahanBaku({ namaBahan: "Susu UHT" }));
    const duplikat = new BahanBaku(baseBahanBaku({ namaBahan: "Susu UHT" }));
    await expect(duplikat.save()).rejects.toThrow();
  });

  // ✅ Skenario F: Nama Sama di Tenant Berbeda
  // Mendukung sistem Multi-Tenant (Toko A dan Toko B boleh sama-sama punya "Gula Pasir")
  test("F: namaBahan sama di tenant berbeda harus berhasil", async () => {
    const tenant2 = new mongoose.Types.ObjectId();
    await BahanBaku.create(baseBahanBaku({ namaBahan: "Garam" }));
    const b2 = new BahanBaku(
      baseBahanBaku({ namaBahan: "Garam", tenantID: tenant2 }),
    );
    await expect(b2.save()).resolves.toBeDefined();
  });

  // ✅ Skenario G: Trim Nama Bahan
  // Menghindari error search karena typo spasi (misal: "  Terigu")
  test("G: namaBahan harus otomatis di-trim spasi depan-belakang", async () => {
    const b = await BahanBaku.create(
      baseBahanBaku({ namaBahan: "   Cokelat Bubuk   " }),
    );
    expect(b.namaBahan).toBe("Cokelat Bubuk");
  });

  // ✅ Skenario H: Default Value Stok
  // Saat baru mendaftarkan bahan baru, stok otomatis mulai dari 0 jika tidak diisi
  test("H: stok harus default ke 0 jika tidak ditentukan", async () => {
    const b = new BahanBaku(baseBahanBaku({ stok: undefined }));
    await b.validate();
    expect(b.stok).toBe(0);
  });

  // ✅ Skenario I: Default minimalStok
  test("I: minimalStok harus default ke 0 dan tidak boleh negatif", async () => {
    const b = new BahanBaku(baseBahanBaku({ minimalStok: undefined }));
    await b.validate();
    expect(b.minimalStok).toBe(0);

    const bNegatif = new BahanBaku(baseBahanBaku({ minimalStok: -5 }));
    await expect(bNegatif.validate()).rejects.toThrow();
  });

  test("J: harus bisa menyimpan stok dalam bentuk desimal (float)", async () => {
    const b = await BahanBaku.create(baseBahanBaku({ stok: 0.75 }));
    expect(b.stok).toBe(0.75);
  });
});
