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
      permissions: [
        "read-permintaan-stok",
        "create-permintaan-stok",
        "update-permintaan-stok",
        "approve-permintaan-stok",
        "reject-permintaan-stok",
      ],
    };
    next();
  };
});

// Import app dan models
const app = require("../../app");
const PermintaanStok = require("../../models/permintaanStokModel");
const Inventory = require("../../models/inventoryModel");
const JurnalStok = require("../../models/jurnalStokModel");
const TransferStok = require("../../models/transferStokModel");

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
      TransferStok.deleteMany({}),
    ]);
  });

  // --- TEST CASES ---

  it("Step: Approve Sukses - Membuat Draft Surat Jalan", async () => {
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
      items: [{ bahanBakuID, jumlah: 30, satuan: "kg" }],
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

    const updatedPermintaan = await PermintaanStok.findById(permintaan._id);
    expect(updatedPermintaan.status).toBe("APPROVED");

    const transfer = await TransferStok.findById(res.body.transferID);
    expect(transfer.status).toBe("PENDING");
    expect(String(transfer.permintaanStokID)).toBe(String(permintaan._id));
    expect(transfer.items[0].qtyKirim).toBe(30);

    // Approval hanya menerbitkan draft Surat Jalan; stok berkurang saat transfer dikirim.
    const stokAsal = await Inventory.findOne({
      locationID: dariLocationID,
      bahanBakuID,
    });
    expect(stokAsal.stok).toBe(100);
  });

  it("Step: Reject Sukses - Tanpa Mutasi", async () => {
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-REJECT-FINAL",
      tenantID: VALID_TENANT_ID,
      status: "SUBMITTED",
      dariLocationID: new mongoose.Types.ObjectId(),
      keLocationID: new mongoose.Types.ObjectId(),
      dimintaOleh: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID: new mongoose.Types.ObjectId(), jumlah: 10, satuan: "kg" }],
    });

    const res = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/reject`)
      .send({ alasan: "Test Reject" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REJECTED");
  }, 20000); // Kasih waktu 20 detik

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
      items: [{ bahanBakuID: new mongoose.Types.ObjectId(), jumlah: 10, satuan: "kg" }],
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
      items: [{ bahanBakuID: new mongoose.Types.ObjectId(), jumlah: 5, satuan: "kg" }],
    });

    // 2. Coba reject
    const res = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/reject`)
      .send({ alasan: "Mau saya cancel" });

    // Harus gagal (400) karena barang sudah terlanjur pindah (COMPLETED)
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("sudah diproses");
  });

  // ====================== TEST WORKFLOW DRAFT & GRACE PERIOD ======================

  it("Step: Update Draft Sukses - Mengubah item saat status masih DRAFT", async () => {
    // 1. Buat data DRAFT
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-DRAFT-01",
      tenantID: VALID_TENANT_ID,
      status: "DRAFT",
      dariLocationID: new mongoose.Types.ObjectId(),
      keLocationID: new mongoose.Types.ObjectId(),
      dimintaOleh: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID: new mongoose.Types.ObjectId(), jumlah: 10, satuan: "kg" }],
    });

    // 2. Update jumlah item
    const res = await request(app)
      .put(`/api/permintaanstok/${permintaan._id}`) // Sesuai router.put
      .send({
        items: [
          {
            bahanBakuID: permintaan.items[0].bahanBakuID,
            jumlah: 50,
            satuan: "kg",
          },
        ],
      });

    expect(res.status).toBe(200);
    const updated = await PermintaanStok.findById(permintaan._id);
    expect(updated.items[0].jumlah).toBe(50);
  });

  it("Step: Submit Sukses - Transisi dari DRAFT ke SUBMITTED", async () => {
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-SUBMIT-01",
      tenantID: VALID_TENANT_ID,
      status: "DRAFT",
      dariLocationID: new mongoose.Types.ObjectId(),
      keLocationID: new mongoose.Types.ObjectId(),
      dimintaOleh: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID: new mongoose.Types.ObjectId(), jumlah: 10, satuan: "kg" }],
    });

    const res = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/submit`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("SUBMITTED");
  });

  it("Gagal Update: Mencoba edit setelah SUBMITTED", async () => {
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-TIMEOUT",
      tenantID: VALID_TENANT_ID,
      status: "SUBMITTED",
      dariLocationID: new mongoose.Types.ObjectId(),
      keLocationID: new mongoose.Types.ObjectId(),
      dimintaOleh: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID: new mongoose.Types.ObjectId(), jumlah: 10, satuan: "kg" }],
    });

    const res = await request(app)
      .put(`/api/permintaanstok/${permintaan._id}`)
      .send({ catatan: "Edit Timeout" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("sudah diproses");
  });

  it("Gagal Approve: Status masih DRAFT (Workflow Guard)", async () => {
    // Admin tidak boleh bisa approve barang yang masih DRAFT (masih diutak-atik outlet)
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-ILLEGAL-APPROVE",
      tenantID: VALID_TENANT_ID,
      status: "DRAFT",
      dariLocationID: new mongoose.Types.ObjectId(),
      keLocationID: new mongoose.Types.ObjectId(),
      dimintaOleh: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID: new mongoose.Types.ObjectId(), jumlah: 10, satuan: "kg" }],
    });

    const res = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/approve`)
      .send();

    // Harus gagal karena syarat Approve adalah status SUBMITTED
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("tidak dalam status SUBMITTED");
  });
});
