const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Produk = require("../../../models/produkModel");

let mongoServer;

beforeAll(async () => {
  // 1. Putuskan koneksi yang mungkin sudah ada
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // 2. Jalankan MongoMemoryServer
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // 3. Connect dengan opsi standar agar stabil
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Produk.deleteMany({}); // Bersihkan data tiap selesai satu skenario
});

describe("Produk Model — Unit Test", () => {
  const validProduk = {
    namaProduk: "Kopi Latte",
    hargaDasar: 10000,
    hargaJual: 15000,
    kategoriID: new mongoose.Types.ObjectId(),
    tenantID: new mongoose.Types.ObjectId(),
    resep: [
      {
        bahanBakuID: new mongoose.Types.ObjectId(),
        jumlah: 100,
        satuan: "ml",
      },
    ],
  };

  // 1. Test Validasi Field Wajib
  test("Harus error jika field wajib (required) tidak diisi", async () => {
    const produkTanpaNama = new Produk({ hargaJual: 10000 });
    let err;
    try {
      await produkTanpaNama.validate();
    } catch (error) {
      err = error;
    }
    expect(err.errors.namaProduk).toBeDefined();
    expect(err.errors.hargaDasar).toBeDefined();
    expect(err.errors.tenantID).toBeDefined();
  });

  // 2. Test Validasi Nilai Negatif
  test("Harus error jika harga atau stok bernilai negatif", async () => {
    const produkNegatif = new Produk({
      ...validProduk,
      hargaDasar: -500,
      stok: -10,
    });

    let err;
    try {
      await produkNegatif.validate();
    } catch (error) {
      err = error;
    }
    expect(err.errors.hargaDasar).toBeDefined();
    expect(err.errors.stok).toBeDefined();
  });

  // 3. Test Enum pada Resep
  test("Harus error jika satuan resep tidak sesuai enum", async () => {
    const produkSalahSatuan = new Produk({
      ...validProduk,
      resep: [
        {
          bahanBakuID: new mongoose.Types.ObjectId(),
          jumlah: 10,
          satuan: "ember",
        },
      ],
    });

    let err;
    try {
      await produkSalahSatuan.validate();
    } catch (error) {
      err = error;
    }
    // "ember" tidak ada di enum ["gram", "ml", "pcs", "kg", "liter"]
    expect(err.errors["resep.0.satuan"]).toBeDefined();
  });

  // 4. Test Compound Index (Unique Name per Tenant)
  test("Harus error (Unique Index) jika nama produk sama dalam satu tenant", async () => {
    // Simpan produk pertama
    await Produk.create(validProduk);

    // Coba simpan produk kedua dengan nama & tenant yang sama
    let err;
    try {
      await Produk.create(validProduk);
    } catch (error) {
      err = error;
    }

    // Mongoose/MongoDB akan melempar error code 11000 untuk duplicate key
    expect(err.code).toBe(11000);
  });

  // 5. Test Penanganan Trim
  test("Harus melakukan trim pada namaProduk", async () => {
    const produkSpasi = await Produk.create({
      ...validProduk,
      namaProduk: "   Kopi Spasi   ",
    });
    expect(produkSpasi.namaProduk).toBe("Kopi Spasi");
  });
});
