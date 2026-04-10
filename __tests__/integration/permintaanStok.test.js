const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// 1. MOCK AUTH - Harus paling atas agar tidak tabrakan dengan import App
jest.mock("../../middleware/authPengguna", () => {
  return (req, res, next) => {
    const mongoose = require("mongoose");
    req.pengguna = {
      _id: "66164670c0c0c0c0c0c0c0c0",
      tenantID: "66164670c0c0c0c0c0c0c0c0",
      role: "admin",
    };
    next();
  };
});

// Import app dan models
const app = require("../../app");
const PermintaanStok = require("../../models/permintaanStokModel");
const Inventory = require("../../models/inventoryModel");
const JurnalStok = require("../../models/jurnalStokModel");

// Gunakan ID yang sama dengan di dalam Mock Auth
const VALID_TENANT_ID = "66164670c0c0c0c0c0c0c0c0";

describe("Integration Test - Permintaan Stok (Approve & Reject)", () => {
  let mongoServer;

  beforeAll(async () => {
    // Pastikan koneksi bersih sebelum pakai Memory Server
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();

    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Bersihkan data antar test agar tidak tercampur
    await Promise.all([
      PermintaanStok.deleteMany({}),
      Inventory.deleteMany({}),
      JurnalStok.deleteMany({}),
    ]);
  });

  // --- TEST CASES ---

  it("Step: Approve Sukses - Mutasi Stok & Jurnal", async () => {
    const bahanBakuID = new mongoose.Types.ObjectId();
    const dariLocationID = new mongoose.Types.ObjectId();
    const keLocationID = new mongoose.Types.ObjectId();

    // Persiapkan data stok awal
    await Inventory.create({
      bahanBakuID,
      locationID: dariLocationID,
      tenantID: VALID_TENANT_ID,
      stok: 100,
    });

    // Buat dokumen permintaan
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-001",
      tenantID: VALID_TENANT_ID,
      status: "SUBMITTED",
      dariLocationID,
      keLocationID,
      dimintaOleh: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID, jumlah: 30 }],
    });

    // Jalankan Request Approve
    const res = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/approve`)
      .send();

    // Log otomatis jika Route Salah (404)
    if (res.status === 404) {
      console.log(
        "❌ Route 404 ditemukan. Daftar route yang tersedia di App kamu:",
      );
      app._router.stack.forEach((r) => {
        if (r.route) console.log(`Path: ${r.route.path}`);
        else if (r.name === "router") {
          r.handle.stack.forEach((s) => {
            if (s.route) console.log(`Nested Path: ${s.route.path}`);
          });
        }
      });
    }

    expect(res.status).toBe(200);

    // Cek Stok Berkurang (100 - 30 = 70)
    const stokAsal = await Inventory.findOne({
      locationID: dariLocationID,
      bahanBakuID,
    });
    expect(stokAsal.stok).toBe(70);
  });

  it("Step: Reject Sukses - Tanpa Mutasi", async () => {
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-002",
      tenantID: VALID_TENANT_ID,
      status: "SUBMITTED",
      dariLocationID: new mongoose.Types.ObjectId(),
      keLocationID: new mongoose.Types.ObjectId(),
      dimintaOleh: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID: new mongoose.Types.ObjectId(), jumlah: 10 }],
    });

    const res = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/reject`)
      .send();

    expect(res.status).toBe(200);

    // Cek Perubahan Status
    const updated = await PermintaanStok.findById(permintaan._id);
    expect(updated.status).toBe("REJECTED");
  });

  // ====================== TEST PENGAMANAN (RACE CONDITION) ======================

  it("Gagal Approve jika status sudah COMPLETED (Anti-Double Approve)", async () => {
    // 1. Buat data yang sudah COMPLETED
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-DOUBLE",
      tenantID: VALID_TENANT_ID,
      status: "COMPLETED", // Status dikunci
      dariLocationID: new mongoose.Types.ObjectId(),
      keLocationID: new mongoose.Types.ObjectId(),
      dimintaOleh: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID: new mongoose.Types.ObjectId(), jumlah: 10 }],
    });

    // 2. Coba approve lagi
    const res = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/approve`)
      .send();

    // Harus gagal (400) karena status tidak SUBMITTED
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("sudah diproses");
  });

  it("Gagal Reject jika status sudah COMPLETED (Approve vs Reject Race)", async () => {
    // 1. Buat data yang sudah terlanjur di-approve (COMPLETED)
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-RACE",
      tenantID: VALID_TENANT_ID,
      status: "COMPLETED",
      dariLocationID: new mongoose.Types.ObjectId(),
      keLocationID: new mongoose.Types.ObjectId(),
      dimintaOleh: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID: new mongoose.Types.ObjectId(), jumlah: 5 }],
    });

    // 2. Coba reject
    const res = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/reject`)
      .send({ alasan: "Mau saya cancel" });

    // Harus gagal (400) karena barang sudah terlanjur pindah (COMPLETED)
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("sudah diproses");
  });
});
