const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../../app");

// 1. IMPORT SEMUA MODEL TERKAIT (Wajib agar populate tidak error)
const Inventory = require("../../models/inventoryModel");
const Lokasi = require("../../models/locationModel");
const BahanBaku = require("../../models/bahanBakuModel");
const Produk = require("../../models/produkModel");

// Mock Auth
jest.mock("../../middleware/authPengguna", () => {
  return (req, res, next) => {
    const mongoose = require("mongoose");
    req.pengguna = {
      _id: new mongoose.Types.ObjectId().toString(),
      tenantID: "66164670c0c0c0c0c0c0c0c0",
      role: "admin",
      permissions: ["read-inventory"],
    };
    next();
  };
});

const VALID_TENANT_ID = "66164670c0c0c0c0c0c0c0c0";

describe("Inventory Integration Test (Consistency Check)", () => {
  let mongoServer;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Inventory.deleteMany({});
    await Lokasi.deleteMany({});
    await BahanBaku.deleteMany({});
    await Produk.deleteMany({});
  });

  it("Harus bisa filter stok menggunakan query 'locationID'", async () => {
    // Buat Lokasi & BahanBaku dengan field wajib
    const lokasi = await Lokasi.create({
      nama: "Gudang Test",
      tipe: "Gudang",
      alamat: "Alamat Dummy",
      tenantID: VALID_TENANT_ID,
    });

    const bahan = await BahanBaku.create({
      namaBahan: "Terigu",
      satuan: "kg",
      kategori: "Food",
      tenantID: VALID_TENANT_ID,
    });

    await Inventory.create({
      bahanBakuID: bahan._id,
      locationID: lokasi._id,
      tenantID: VALID_TENANT_ID,
      stok: 50,
    });

    const res = await request(app)
      .get("/api/inventory")
      .query({ locationID: lokasi._id.toString() });

    expect(res.status).toBe(200);
    const data = Array.isArray(res.body) ? res.body : res.body.data;

    expect(data).toBeDefined();
    expect(data.length).toBe(1);
    expect(data[0].locationID._id).toBe(lokasi._id.toString());
  });

  it("Harus berhasil potong stok saat process sale dengan field 'locationID'", async () => {
    const lokasi = await Lokasi.create({
      nama: "Outlet Test",
      tipe: "Outlet",
      alamat: "Alamat Outlet",
      tenantID: VALID_TENANT_ID,
    });
    const bahan = await BahanBaku.create({
      namaBahan: "Kopi",
      satuan: "gram",
      tenantID: VALID_TENANT_ID,
    });

    // Buat Produk dengan SEMUA field wajib sesuai log error kamu
    const produk = await Produk.create({
      namaProduk: "Espresso",
      kategoriID: new mongoose.Types.ObjectId(), // Field wajib
      hargaJual: 15000, // Field wajib
      hargaDasar: 5000, // Field wajib
      stok: 10,
      tenantID: VALID_TENANT_ID,
      resep: [
        {
          bahanBakuID: bahan._id,
          jumlah: 18,
          satuan: "gram", // Field wajib dalam resep
        },
      ],
    });

    await Inventory.create({
      bahanBakuID: bahan._id,
      locationID: lokasi._id,
      tenantID: VALID_TENANT_ID,
      stok: 1000,
    });

    const res = await request(app).post("/api/inventory/process-sale").send({
      produkID: produk._id,
      qtyJual: 1,
      locationID: lokasi._id.toString(),
    });

    expect(res.status).toBe(200);
  });

  it("Harus error 400 jika payload create tidak mengirim 'locationID'", async () => {
    const res = await request(app).post("/api/inventory").send({
      bahanBakuID: new mongoose.Types.ObjectId(),
      stok: 10,
    });

    expect(res.status).toBe(400);
  });
});
