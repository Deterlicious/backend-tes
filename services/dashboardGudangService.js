const Inventory = require("../models/inventoryModel");
const JurnalStok = require("../models/jurnalStokModel");
const PermintaanStok = require("../models/permintaanStokModel");
const TransferStok = require("../models/transferStokModel");
const createError = require("http-errors");

class DashboardGudangService {
  async getSummary(user) {
    const { tenantID } = user || {};
    if (!tenantID) throw createError(400, "Tenant ID tidak valid.");

    const [
      permintaanSubmitted,
      permintaanApproved,
      suratJalanPending,
      transferDikirim,
      stokKritis,
      jurnalTerbaru,
    ] = await Promise.all([
      PermintaanStok.countDocuments({ tenantID, status: "SUBMITTED" }),
      PermintaanStok.countDocuments({ tenantID, status: "APPROVED" }),
      TransferStok.countDocuments({ tenantID, status: "PENDING" }),
      TransferStok.countDocuments({ tenantID, status: "DIKIRIM" }),
      Inventory.countDocuments({
        tenantID,
        $expr: { $lte: ["$stok", "$stokMinimum"] },
      }),
      JurnalStok.find({ tenantID })
        .populate("bahanBakuID", "namaBahan satuan")
        .populate("locationID", "nama tipe")
        .populate("dicatatOleh", "nama")
        .sort({ tanggal: -1, createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    return {
      permintaan: {
        menungguApproval: permintaanSubmitted,
        siapDibuatSuratJalan: permintaanApproved,
      },
      transfer: {
        suratJalanPending,
        sedangDikirim: transferDikirim,
      },
      inventory: {
        stokKritis,
      },
      jurnalTerbaru,
    };
  }

  async getOutletSummary(user) {
    const { tenantID } = user || {};
    if (!tenantID) throw createError(400, "Tenant ID tidak valid.");

    const [
      draftPermintaan,
      submittedPermintaan,
      approvedPermintaan,
      transferDikirim,
      transferDiterima,
      jurnalTerbaru,
    ] = await Promise.all([
      PermintaanStok.countDocuments({ tenantID, status: "DRAFT" }),
      PermintaanStok.countDocuments({ tenantID, status: "SUBMITTED" }),
      PermintaanStok.countDocuments({ tenantID, status: "APPROVED" }),
      TransferStok.countDocuments({ tenantID, status: "DIKIRIM" }),
      TransferStok.countDocuments({ tenantID, status: "DITERIMA" }),
      JurnalStok.find({ tenantID })
        .populate("bahanBakuID", "namaBahan satuan")
        .populate("locationID", "nama tipe")
        .populate("dicatatOleh", "nama")
        .sort({ tanggal: -1, createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    return {
      permintaan: {
        draft: draftPermintaan,
        menungguApproval: submittedPermintaan,
        disetujui: approvedPermintaan,
      },
      transfer: {
        sedangDikirim: transferDikirim,
        sudahDiterima: transferDiterima,
      },
      jurnalTerbaru,
    };
  }
}

module.exports = new DashboardGudangService();
