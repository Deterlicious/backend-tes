const request = require("supertest");
const mongoose = require("mongoose");

// 1. MOCK AUTH - Outlet A Login
jest.mock("../../middleware/authPengguna", () => {
  return (req, res, next) => {
    req.pengguna = {
      _id: "66164670c0c0c0c0c0c0c0A1", // ID User Outlet A
      tenantID: "66164670c0c0c0c0c0c0c0c0",
      role: "outlet",
      permissions: [
        "create-transfer-stok",
        "approve-transfer-stok",
        "receive-transfer-stok",
      ],
    };
    next();
  };
});

const app = require("../../app");
const TransferStok = require("../../models/transferStokModel");
const PermintaanStok = require("../../models/permintaanStokModel");
const Inventory = require("../../models/inventoryModel");

const VALID_TENANT_ID = "66164670c0c0c0c0c0c0c0c0";

describe("Workflow Inter-Store: Push Transfer (Outlet A ke Outlet B)", () => {
  let bahanBakuID, outletA, outletB;
  let overstockPermintaanID, validPermintaanID;
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

    const overstockPermintaan = await PermintaanStok.create({
      nomorRequest: "REQ-PUSH-OVERSTOCK",
      tenantID: VALID_TENANT_ID,
      dariLocationID: outletA,
      keLocationID: outletB,
      status: "APPROVED",
      dimintaOleh: "66164670c0c0c0c0c0c0c0A1",
      items: [{ bahanBakuID, jumlah: 100, satuan: "kg" }],
    });

    const validPermintaan = await PermintaanStok.create({
      nomorRequest: "REQ-PUSH-VALID",
      tenantID: VALID_TENANT_ID,
      dariLocationID: outletA,
      keLocationID: outletB,
      status: "APPROVED",
      dimintaOleh: "66164670c0c0c0c0c0c0c0A1",
      items: [{ bahanBakuID, jumlah: 20, satuan: "kg" }],
    });

    overstockPermintaanID = overstockPermintaan._id;
    validPermintaanID = validPermintaan._id;
  });

  // --- TEST 1: EARLY VALIDATION (Pencegahan Stok Minus) ---
  it("Gagal Membuat Draft: Outlet A mencoba kirim barang melebihi stok fisik", async () => {
    const res = await request(app)
      .post("/api/transferstok")
      .send({
        permintaanStokID: overstockPermintaanID,
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
        permintaanStokID: validPermintaanID,
        dariLocationID: outletA,
        keLocationID: outletB,
        tanggalKirim: new Date(),
        items: [{ bahanBakuID, qtyKirim: 20 }], // Kirim 20 kg (Aman)
      });

    if (res.status !== 201) console.log("Error Create Draft:", res.body);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.permintaanStokID).toBe(String(validPermintaanID));
    expect(res.body.data.nomorTransfer).toContain("SJ-REQ-PUSH-VALID-");

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
