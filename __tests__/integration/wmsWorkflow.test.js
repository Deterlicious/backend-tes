const request = require("supertest");
const mongoose = require("mongoose");

let mockPengguna;

jest.mock("../../middleware/authPengguna", () => {
  return (req, res, next) => {
    req.pengguna = mockPengguna;
    next();
  };
});

const app = require("../../app");
const Inventory = require("../../models/inventoryModel");
const PermintaanStok = require("../../models/permintaanStokModel");
const TransferStok = require("../../models/transferStokModel");

const TENANT_ID = "66164670c0c0c0c0c0c0c0c0";
const STAFF_OUTLET_ID = "66164670c0c0c0c0c0c0c0a1";
const MANAGER_ID = "66164670c0c0c0c0c0c0c0b1";
const STAFF_GUDANG_ID = "66164670c0c0c0c0c0c0c0d1";

const loginAsStaffOutlet = () => {
  mockPengguna = {
    _id: STAFF_OUTLET_ID,
    tenantID: TENANT_ID,
    role: "staff-outlet",
    permissions: [
      "create-permintaan-stok",
      "update-permintaan-stok",
      "read-permintaan-stok",
    ],
  };
};

const loginAsManager = () => {
  mockPengguna = {
    _id: MANAGER_ID,
    tenantID: TENANT_ID,
    role: "manager",
    permissions: [
      "read-permintaan-stok",
      "approve-permintaan-stok",
      "reject-permintaan-stok",
    ],
  };
};

const loginAsStaffGudang = () => {
  mockPengguna = {
    _id: STAFF_GUDANG_ID,
    tenantID: TENANT_ID,
    role: "staff-gudang",
    permissions: ["read-permintaan-stok", "create-transfer-stok"],
  };
};

describe("Integration Test - Alur Lengkap WMS Permintaan Stok", () => {
  beforeEach(async () => {
    await Promise.all([
      Inventory.deleteMany({}),
      PermintaanStok.deleteMany({}),
      TransferStok.deleteMany({}),
    ]);
  });

  it("Staff Outlet membuat DRAFT, submit ke SUBMITTED, Manager approve, Staff Gudang memverifikasi draft Surat Jalan tanpa data hilang", async () => {
    const bahanBakuID = new mongoose.Types.ObjectId();
    const gudangID = new mongoose.Types.ObjectId();
    const outletID = new mongoose.Types.ObjectId();

    await Inventory.create({
      bahanBakuID,
      locationID: gudangID,
      tenantID: TENANT_ID,
      stok: 100,
    });

    loginAsStaffOutlet();
    const createRes = await request(app).post("/api/permintaanstok").send({
      dariLocationID: gudangID,
      keLocationID: outletID,
      tanggalKebutuhan: "2026-04-25T00:00:00.000Z",
      catatan: "Restock outlet akhir pekan",
      items: [{ bahanBakuID, jumlah: 12, satuan: "kg" }],
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe("DRAFT");
    expect(createRes.body.data.dimintaOleh).toBe(STAFF_OUTLET_ID);
    expect(createRes.body.data.items[0]).toMatchObject({
      jumlah: 12,
      satuan: "kg",
    });

    const requestID = createRes.body.data._id;

    const submitRes = await request(app)
      .patch(`/api/permintaanstok/${requestID}/submit`)
      .send();

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe("SUBMITTED");

    loginAsStaffOutlet();
    const forbiddenApproveRes = await request(app)
      .patch(`/api/permintaanstok/${requestID}/approve`)
      .send();

    expect(forbiddenApproveRes.status).toBe(403);

    loginAsManager();
    const approveRes = await request(app)
      .patch(`/api/permintaanstok/${requestID}/approve`)
      .send();

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.transferID).toBeDefined();

    const approvedRequest = await PermintaanStok.findById(requestID).lean();
    expect(approvedRequest.status).toBe("APPROVED");
    expect(String(approvedRequest.disetujuiOleh)).toBe(MANAGER_ID);
    expect(String(approvedRequest.transferStokID)).toBe(
      String(approveRes.body.transferID),
    );

    loginAsStaffGudang();
    const listRes = await request(app)
      .get("/api/permintaanstok")
      .query({ status: "APPROVED" });

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0]._id).toBe(requestID);

    const transfer = await TransferStok.findById(
      approveRes.body.transferID,
    ).lean();
    expect(transfer).toMatchObject({
      status: "PENDING",
      nomorTransfer: approveRes.body.nomorSuratJalan,
    });
    expect(String(transfer.permintaanStokID)).toBe(requestID);
    expect(String(transfer.dariLocationID)).toBe(String(gudangID));
    expect(String(transfer.keLocationID)).toBe(String(outletID));
    expect(String(transfer.pengirimID)).toBe(MANAGER_ID);
    expect(transfer.items).toHaveLength(1);
    expect(String(transfer.items[0].bahanBakuID)).toBe(String(bahanBakuID));
    expect(transfer.items[0].qtyKirim).toBe(12);
    expect(transfer.items[0].qtyTerima).toBe(0);
  });
});
