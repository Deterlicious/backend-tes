const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mockPengguna;

jest.mock("../../middleware/authPengguna", () => {
  return (req, res, next) => {
    req.pengguna = mockPengguna;
    next();
  };
});

const app = require("../../app");
const BahanBaku = require("../../models/bahanBakuModel");
const Inventory = require("../../models/inventoryModel");
const JurnalStok = require("../../models/jurnalStokModel");
const Location = require("../../models/locationModel");
const PermintaanStok = require("../../models/permintaanStokModel");
const TransferStok = require("../../models/transferStokModel");

const TENANT_ID = "66164670c0c0c0c0c0c0c0c0";
const MANAJER_OUTLET_ID = "66164670c0c0c0c0c0c0c0a2";

const loginAsManajerOutlet = () => {
  mockPengguna = {
    _id: MANAJER_OUTLET_ID,
    tenantID: TENANT_ID,
    role: "manajer-outlet",
    permissions: [
      "read-permintaan-stok",
      "create-permintaan-stok",
      "update-permintaan-stok",
      "read-transfer-stok",
      "receive-transfer-stok",
      "read-inventory",
      "read-jurnal-stok",
      "read-dashboard-outlet",
    ],
  };
};

describe("RBA Integration - Manajer Outlet", () => {
  let mongoServer;
  let bahanBakuID, gudangID, outletID;

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
    await Promise.all([
      BahanBaku.deleteMany({}),
      Inventory.deleteMany({}),
      JurnalStok.deleteMany({}),
      Location.deleteMany({}),
      PermintaanStok.deleteMany({}),
      TransferStok.deleteMany({}),
    ]);

    const [gudang, outlet, bahan] = await Promise.all([
      Location.create({
        nama: "Gudang Pusat",
        tipe: "Gudang",
        alamat: "Jl. Gudang",
        tenantID: TENANT_ID,
      }),
      Location.create({
        nama: "Outlet Sudirman",
        tipe: "Outlet",
        alamat: "Jl. Sudirman",
        tenantID: TENANT_ID,
      }),
      BahanBaku.create({
        namaBahan: "Kopi Arabica",
        satuan: "kg",
        tenantID: TENANT_ID,
      }),
    ]);

    gudangID = gudang._id;
    outletID = outlet._id;
    bahanBakuID = bahan._id;

    await Inventory.create({
      bahanBakuID,
      locationID: outletID,
      tenantID: TENANT_ID,
      stok: 4,
      stokMinimum: 5,
    });

    await JurnalStok.create({
      bahanBakuID,
      tanggal: new Date(),
      tipeKoreksi: "Masuk",
      jumlah: 4,
      alasan: "Lainnya",
      keterangan: "Stok awal outlet",
      dicatatOleh: MANAJER_OUTLET_ID,
      locationID: outletID,
      tenantID: TENANT_ID,
    });

    loginAsManajerOutlet();
  });

  it("boleh membuat, mengubah, submit, dan melihat Permintaan Stok", async () => {
    const createRes = await request(app).post("/api/permintaanstok").send({
      dariLocationID: gudangID,
      keLocationID: outletID,
      items: [{ bahanBakuID, jumlah: 8, satuan: "kg" }],
      catatan: "Restock outlet",
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe("DRAFT");
    expect(createRes.body.data.dimintaOleh).toBe(MANAJER_OUTLET_ID);

    const requestID = createRes.body.data._id;

    const updateRes = await request(app)
      .put(`/api/permintaanstok/${requestID}`)
      .send({
        items: [{ bahanBakuID, jumlah: 10, satuan: "kg" }],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.items[0].jumlah).toBe(10);

    const submitRes = await request(app)
      .patch(`/api/permintaanstok/${requestID}/submit`)
      .send();

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe("SUBMITTED");

    const listRes = await request(app).get("/api/permintaanstok");

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0]._id).toBe(requestID);
  });

  it("ditolak untuk approve, reject, membuat Surat Jalan, kirim, dan batal transfer", async () => {
    const permintaan = await PermintaanStok.create({
      nomorRequest: "REQ-MO-RBA",
      tenantID: TENANT_ID,
      dariLocationID: gudangID,
      keLocationID: outletID,
      status: "SUBMITTED",
      dimintaOleh: MANAJER_OUTLET_ID,
      items: [{ bahanBakuID, jumlah: 5, satuan: "kg" }],
    });

    const approveRes = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/approve`)
      .send();

    expect(approveRes.status).toBe(403);

    const rejectRes = await request(app)
      .patch(`/api/permintaanstok/${permintaan._id}/reject`)
      .send({ alasan: "Tidak boleh oleh manajer outlet" });

    expect(rejectRes.status).toBe(403);

    const createTransferRes = await request(app).post("/api/transferstok").send({
      permintaanStokID: permintaan._id,
      tanggalKirim: new Date(),
      items: [{ bahanBakuID, qtyKirim: 5 }],
    });

    expect(createTransferRes.status).toBe(403);

    const transfer = await TransferStok.create({
      nomorTransfer: "SJ-MO-RBA",
      permintaanStokID: permintaan._id,
      tenantID: TENANT_ID,
      dariLocationID: gudangID,
      keLocationID: outletID,
      tanggalKirim: new Date(),
      pengirimID: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID, qtyKirim: 5, qtyTerima: 0 }],
    });

    const kirimRes = await request(app)
      .patch(`/api/transferstok/${transfer._id}/kirim`)
      .send();

    expect(kirimRes.status).toBe(403);

    const batalRes = await request(app)
      .patch(`/api/transferstok/${transfer._id}/batal`)
      .send();

    expect(batalRes.status).toBe(403);
  });

  it("boleh melihat dan menerima transfer, melihat inventory, jurnal stok, dan dashboard outlet", async () => {
    const transfer = await TransferStok.create({
      nomorTransfer: "SJ-MO-RECEIVE",
      tenantID: TENANT_ID,
      dariLocationID: gudangID,
      keLocationID: outletID,
      status: "DIKIRIM",
      tanggalKirim: new Date(),
      pengirimID: new mongoose.Types.ObjectId(),
      items: [{ bahanBakuID, qtyKirim: 3, qtyTerima: 0 }],
    });

    const transferListRes = await request(app).get("/api/transferstok");
    expect(transferListRes.status).toBe(200);

    const terimaRes = await request(app)
      .patch(`/api/transferstok/${transfer._id}/terima`)
      .send({
        items: [{ bahanBakuID, qtyKirim: 3, qtyTerima: 3 }],
      });

    expect(terimaRes.status).toBe(200);
    expect(terimaRes.body.data.status).toBe("DITERIMA");

    const inventoryRes = await request(app).get("/api/inventory");
    expect(inventoryRes.status).toBe(200);
    expect(inventoryRes.body.data.length).toBeGreaterThan(0);

    const jurnalRes = await request(app).get("/api/jurnalstok");
    expect(jurnalRes.status).toBe(200);
    expect(jurnalRes.body.data.length).toBeGreaterThan(0);

    const dashboardRes = await request(app).get("/api/dashboard/outlet");
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.data).toHaveProperty("permintaan");
    expect(dashboardRes.body.data).toHaveProperty("transfer");

    const dashboardGudangRes = await request(app).get("/api/dashboard/gudang");
    expect(dashboardGudangRes.status).toBe(403);
  });
});
