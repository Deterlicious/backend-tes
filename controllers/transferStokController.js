// transferStokController.js
const TransferStokService = require("../services/transferStokService");
const createError = require("http-errors");

// Helper untuk menangani HttpErrors yang dilempar dari Service
const handleServiceError = (res, error) => {
  if (createError.isHttpError(error) && error.statusCode) {
    return res.status(error.statusCode).json({
      message: error.message,
      errors: error.errors,
    });
  }
  res
    .status(500)
    .json({ message: error.message || "Kesalahan internal server." });
};

// ===============================================
// ✅ CREATE: Membuat Draft Transfer (PENDING)
// ===============================================
exports.createTransferStok = async (req, res) => {
  try {
    const newTransfer = await TransferStokService.create(req.body);
    res
      .status(201)
      .json({
        message: "Draft Transfer Stok berhasil dibuat (PENDING)",
        data: newTransfer,
      });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ ALL: Filter berdasarkan tenantID
// ===============================================
exports.getAllTransferStok = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const transfer = await TransferStokService.getAll(tenantID);
    res.status(200).json(transfer);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ BY ID (Query: tenantID, Params: id)
// ===============================================
exports.getTransferStokById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query;
    const transfer = await TransferStokService.getById(tenantID, id);
    res.status(200).json(transfer);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 🔄 UPDATE DRAFT (Hanya saat PENDING)
// ===============================================
exports.updateTransferDraft = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedTransfer = await TransferStokService.updateDraft(
      tenantID,
      id,
      req.body
    );
    res
      .status(200)
      .json({
        message: "Draft Transfer Stok berhasil diperbarui",
        data: updatedTransfer,
      });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 🚚 UPDATE STATUS: KIRIM (Dari PENDING ke DIKIRIM)
// Endpoint: PUT /api/transferstok/:id/kirim
// ===============================================
exports.markAsKirim = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedTransfer = await TransferStokService.updateStatus(
      tenantID,
      id,
      "DIKIRIM",
      req.body
    );
    res.status(200).json({
      message: "Transfer Stok berhasil dikirim. Stok Gudang telah berkurang.",
      data: updatedTransfer,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 📦 UPDATE STATUS: TERIMA (Dari DIKIRIM ke DITERIMA)
// Endpoint: PUT /api/transferstok/:id/terima
// ===============================================
exports.markAsTerima = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    // Payload harus menyertakan items dengan qtyTerima
    const updatedTransfer = await TransferStokService.updateStatus(
      tenantID,
      id,
      "DITERIMA",
      req.body
    );
    res.status(200).json({
      message: "Transfer Stok berhasil diterima. Stok Toko telah bertambah.",
      data: updatedTransfer,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ❌ UPDATE STATUS: BATAL (Dari PENDING/DIKIRIM ke BATAL)
// Endpoint: PUT /api/transferstok/:id/batal
// ===============================================
exports.markAsBatal = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedTransfer = await TransferStokService.updateStatus(
      tenantID,
      id,
      "BATAL"
    );
    res.status(200).json({
      message: "Transfer Stok berhasil dibatalkan.",
      data: updatedTransfer,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 🗑️ DELETE DRAFT (Hanya saat PENDING)
// ===============================================
exports.deleteTransferDraft = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const result = await TransferStokService.deleteDraft(tenantID, id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
