const request = require("supertest");
const mongoose = require("mongoose");

// 1. MOCK AUTH - Harus paling atas
jest.mock("../../middleware/authPengguna", () => {
  return (req, res, next) => {
    req.pengguna = {
      _id: "66164670c0c0c0c0c0c0c0c1",
      tenantID: "66164670c0c0c0c0c0c0c0c0",
      role: "admin",
    };
    next();
  };
});

const app = require("../../app");
const PermintaanStok = require("../../models/permintaanStokModel");
const TransferStok = require("../../models/transferStokModel");
const Inventory = require("../../models/inventoryModel");

const VALID_TENANT_ID = "66164670c0c0c0c0c0c0c0c0";
const MOCK_USER_ID = "66164670c0c0c0c0c0c0c0c1";

describe("Workflow Integration: Permintaan -> Transfer -> Selesai", () => {
  let bahanBakuID, gudangID, outletID;
  let createdTransferID;

  beforeAll(async () => {
    bahanBakuID = new mongoose.Types.ObjectId();
    gudangID = new mongoose.Types.ObjectId();
    outletID = new mongoose.Types.ObjectId();

    await Inventory.create({
      bahanBakuID,
      locationID: gudangID,
      tenantID: VALID_TENANT_ID,
      stok: 100,
    });
  });

  // --- STEP 1: APPROVE ---
  it("Step 1: Approve Permintaan harus otomatis membuat TransferStok (Surat Jalan)", async () => {
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-FINAL-WORKFLOW",
      tenantID: VALID_TENANT_ID,
      dariLocationID: gudangID,
      keLocationID: outletID,
      status: "SUBMITTED",
      dimintaOleh: MOCK_USER_ID,
      items: [{ bahanBakuID, jumlah: 20, satuan: "kg" }],
    });

    const res = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/approve`)
      .send();

    expect(res.status).toBe(200);

    // Simpan ID untuk Step 2
    createdTransferID =
      res.body.transferID || (res.body.data && res.body.data.transferID);
    expect(createdTransferID).toBeDefined();
  });

  // --- STEP 2: TERIMA & AUTO-COMPLETE ---
  it("Step 2: Saat TransferStok DITERIMA, PermintaanStok harus otomatis COMPLETED", async () => {
    expect(createdTransferID).toBeDefined();

    const transfer = await TransferStok.findById(createdTransferID);
    expect(transfer).not.toBeNull();

    // Logika pengaman: Pastikan link ke induk ada
    if (!transfer.permintaanStokID) {
      console.error(
        "❌ ERROR: TransferStok ditemukan tapi field permintaanStokID kosong!",
      );
    }

    // 1. Kirim
    await request(app).patch(`/api/transferstok/${transfer._id}/kirim`).send();

    // 2. Terima
    const resTerima = await request(app)
      .patch(`/api/transferstok/${transfer._id}/terima`)
      .send({
        items: transfer.items.map((i) => ({
          bahanBakuID: i.bahanBakuID,
          qtyKirim: i.qtyKirim,
          qtyTerima: i.qtyKirim,
        })),
      });

    expect(resTerima.status).toBe(200);

    // 3. Verifikasi Akhir: Cari dokumen induk
    // Pastikan pencarian menggunakan ID yang benar dari dokumen transfer
    const updatedReq = await PermintaanStok.findById(transfer.permintaanStokID);

    // Debugging jika masih null
    if (!updatedReq) {
      console.log("ID Permintaan yang dicari:", transfer.permintaanStokID);
      const allReq = await PermintaanStok.find({});
      console.log(
        "Daftar ID Permintaan yang ada di DB:",
        allReq.map((r) => r._id),
      );
    }

    expect(updatedReq).not.toBeNull();
    expect(updatedReq.status).toBe("COMPLETED");

    // 4. Cek Stok
    const invOutlet = await Inventory.findOne({
      locationID: outletID,
      bahanBakuID,
    });
    expect(invOutlet.stok).toBe(20);
  });
});
