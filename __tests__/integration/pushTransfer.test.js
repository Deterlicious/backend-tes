const request = require("supertest");
const mongoose = require("mongoose");

// 1. MOCK AUTH - Outlet A Login
jest.mock("../../middleware/authPengguna", () => {
  return (req, res, next) => {
    req.pengguna = {
      _id: "66164670c0c0c0c0c0c0c0A1", // ID User Outlet A
      tenantID: "66164670c0c0c0c0c0c0c0c0",
      role: "outlet",
    };
    next();
  };
});

const app = require("../../app");
const TransferStok = require("../../models/transferStokModel");
const Inventory = require("../../models/inventoryModel");

const VALID_TENANT_ID = "66164670c0c0c0c0c0c0c0c0";

describe("Workflow Inter-Store: Push Transfer (Outlet A ke Outlet B)", () => {
  let bahanBakuID, outletA, outletB;
  let createdTransferID;

  beforeAll(async () => {
    bahanBakuID = new mongoose.Types.ObjectId();
    outletA = new mongoose.Types.ObjectId();
    outletB = new mongoose.Types.ObjectId();

    // Setup Stok Awal di Outlet A: Cuma ada 50 kg
    await Inventory.create({
      bahanBakuID,
      locationID: outletA,
      tenantID: VALID_TENANT_ID,
      stok: 50,
    });
  });

  // --- TEST 1: EARLY VALIDATION (Pencegahan Stok Minus) ---
  it("Gagal Membuat Draft: Outlet A mencoba kirim barang melebihi stok fisik", async () => {
    const res = await request(app)
      .post("/api/transferstok")
      .send({
        dariLocationID: outletA,
        keLocationID: outletB,
        tanggalKirim: new Date(),
        items: [{ bahanBakuID, qtyKirim: 100 }], // Minta 100 padahal stok cuma 50
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("tidak mencukupi");
  });

  // --- TEST 2: CREATE DRAFT SUCCESS ---
  it("Sukses: Outlet A membuat draft pengiriman dengan stok valid", async () => {
    const res = await request(app)
      .post("/api/transferstok")
      .send({
        dariLocationID: outletA,
        keLocationID: outletB,
        tanggalKirim: new Date(),
        items: [{ bahanBakuID, qtyKirim: 20 }], // Kirim 20 kg (Aman)
      });

    if (res.status !== 201) console.log("Error Create Draft:", res.body);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.permintaanStokID).toBeNull(); // Pastikan tidak terikat pusat
    expect(res.body.data.nomorTransfer).toContain("TRF-OUT-");

    createdTransferID = res.body.data._id; // Simpan untuk test selanjutnya
  });

  // --- TEST 3: OPERASIONAL KIRIM & TERIMA ---
  it("Sukses: Barang DIKIRIM (Stok A berkurang) lalu DITERIMA (Stok B bertambah)", async () => {
    expect(createdTransferID).toBeDefined();

    // 1. Outlet A Klik "Kirim Barang"
    const resKirim = await request(app)
      .patch(`/api/transferstok/${createdTransferID}/kirim`)
      .send();

    expect(resKirim.status).toBe(200);

    // Cek Stok Outlet A (Harusnya 50 - 20 = 30)
    const invA = await Inventory.findOne({ locationID: outletA, bahanBakuID });
    expect(invA.stok).toBe(30);

    // 2. Outlet B Klik "Terima Barang"
    const resTerima = await request(app)
      .patch(`/api/transferstok/${createdTransferID}/terima`)
      .send({
        items: [{ bahanBakuID, qtyKirim: 20, qtyTerima: 20 }],
      });

    expect(resTerima.status).toBe(200);

    // Cek Stok Outlet B (Harusnya 0 + 20 = 20)
    const invB = await Inventory.findOne({ locationID: outletB, bahanBakuID });
    expect(invB.stok).toBe(20);

    // Cek Status Akhir Surat Jalan
    const transferAkhir = await TransferStok.findById(createdTransferID);
    expect(transferAkhir.status).toBe("DITERIMA");
  });
});
