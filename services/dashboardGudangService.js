const Inventory = require("../models/inventoryModel");
const JurnalStok = require("../models/jurnalStokModel");
const PengajuanStok = require("../models/pengajuanStokModel");
const TransferStok = require("../models/transferStokModel");
const createError = require("http-errors");

class DashboardGudangService {
  async getSummary(user) {
    const { tenantID } = user || {};
    if (!tenantID) throw createError(400, "Tenant ID tidak valid.");

    const [
      pengajuanSubmitted,
      pengajuanApproved,
      suratJalanPending,
      transferDikirim,
      stokKritis,
      jurnalTerbaru,
    ] = await Promise.all([
      PengajuanStok.countDocuments({ tenantID, status: "SUBMITTED" }),
      PengajuanStok.countDocuments({ tenantID, status: "APPROVED" }),
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
      pengajuan: {
        menungguApproval: pengajuanSubmitted,
        siapDibuatSuratJalan: pengajuanApproved,
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
      draftPengajuan,
      submittedPengajuan,
      approvedPengajuan,
      transferDikirim,
      transferDiterima,
      jurnalTerbaru,
    ] = await Promise.all([
      PengajuanStok.countDocuments({ tenantID, status: "DRAFT" }),
      PengajuanStok.countDocuments({ tenantID, status: "SUBMITTED" }),
      PengajuanStok.countDocuments({ tenantID, status: "APPROVED" }),
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
      pengajuan: {
        draft: draftPengajuan,
        menungguApproval: submittedPengajuan,
        disetujui: approvedPengajuan,
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
