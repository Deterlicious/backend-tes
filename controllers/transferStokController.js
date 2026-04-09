const TransferStokService = require("../services/transferStokService");

class TransferStokController {
  // ✅ CREATE: Membuat Draft Transfer (PENDING)
  async createTransferStok(req, res) {
    const payload = {
      ...req.body,
      tenantID: req.pengguna.tenantID,
      pengirimID: req.pengguna._id, // Default pengirim adalah pembuat draft
    };
    const data = await TransferStokService.create(payload);
    res.status(201).json({
      success: true,
      message: "Draft Transfer Stok berhasil dibuat (PENDING)",
      data,
    });
  }

  // ✅ READ ALL: Otomatis filter berdasarkan tenant pengguna yang login
  async getAllTransferStok(req, res) {
    const { tenantID } = req.pengguna;
    const data = await TransferStokService.getAll(tenantID);
    res.status(200).json({ success: true, count: data.length, data });
  }

  // ✅ READ BY ID
  async getTransferStokById(req, res) {
    const { id } = req.params;
    const { tenantID } = req.pengguna;
    const data = await TransferStokService.getById(tenantID, id);
    res.status(200).json({ success: true, data });
  }

  // 🔄 UPDATE DRAFT (Hanya saat PENDING)
  async updateTransferDraft(req, res) {
    const { tenantID } = req.pengguna;
    const { id } = req.params;
    const data = await TransferStokService.updateDraft(tenantID, id, req.body);
    res.status(200).json({
      success: true,
      message: "Draft Transfer Stok berhasil diperbarui",
      data,
    });
  }

  // 🚚 UPDATE STATUS: KIRIM (Potong Stok Asal)
  async markAsKirim(req, res) {
    const { tenantID, _id: userID } = req.pengguna;
    const { id } = req.params;

    // Kirim userID di dalam updates agar JurnalStok mencatat siapa yang mengirim
    const data = await TransferStokService.updateStatus(
      tenantID,
      id,
      "DIKIRIM",
      {
        ...req.body,
        pengirimID: userID,
      },
    );

    res.status(200).json({
      success: true,
      message: "Transfer Stok berhasil dikirim. Stok Gudang telah berkurang.",
      data,
    });
  }

  // 📦 UPDATE STATUS: TERIMA (Tambah Stok Tujuan)
  async markAsTerima(req, res) {
    const { tenantID, _id: userID } = req.pengguna;
    const { id } = req.params;

    const data = await TransferStokService.updateStatus(
      tenantID,
      id,
      "DITERIMA",
      {
        ...req.body,
        penerimaID: userID,
      },
    );

    res.status(200).json({
      success: true,
      message: "Transfer Stok berhasil diterima. Stok Toko telah bertambah.",
      data,
    });
  }

  // ❌ UPDATE STATUS: BATAL
  async markAsBatal(req, res) {
    const { tenantID, _id: userID } = req.pengguna;
    const { id } = req.params;

    const data = await TransferStokService.updateStatus(tenantID, id, "BATAL", {
      pengirimID: userID, // Untuk log rollback jurnal
    });

    res.status(200).json({
      success: true,
      message: "Transfer Stok berhasil dibatalkan.",
      data,
    });
  }

  // 🗑️ DELETE DRAFT
  async deleteTransferDraft(req, res) {
    const { tenantID } = req.pengguna;
    const { id } = req.params;
    const result = await TransferStokService.deleteDraft(tenantID, id);
    res.status(200).json({ success: true, ...result });
  }
}

module.exports = new TransferStokController();
