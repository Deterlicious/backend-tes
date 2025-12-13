// permintaanStokController.js
const PermintaanStokService = require("../services/permintaanStokService");
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
// 1. CREATE: Membuat Draft Permintaan
// ===============================================
exports.createPermintaanStok = async (req, res) => {
  try {
    const newRequest = await PermintaanStokService.create(req.body);
    res
      .status(201)
      .json({
        message: "Draft Permintaan Stok berhasil dibuat (DRAFT)",
        data: newRequest,
      });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 2. READ ALL: Filter berdasarkan tenantID (Query)
// ===============================================
exports.getAllPermintaanStok = async (req, res) => {
  try {
    const { tenantID, status, dariLocationID } = req.query; // Service akan mengurus filter berdasarkan tenantID (wajib) dan filter opsional lainnya
    const data = await PermintaanStokService.getAll(tenantID, {
      status,
      dariLocationID,
    });
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 3. READ BY ID (Query: tenantID, Params: id)
// ===============================================
exports.getPermintaanStokById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query;
    const request = await PermintaanStokService.getById(tenantID, id);
    res.status(200).json(request);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 4. UPDATE DRAFT (Hanya status DRAFT)
// ===============================================
exports.updatePermintaanDraft = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params; // Service harus mengecek bahwa statusnya masih DRAFT sebelum update
    const updatedRequest = await PermintaanStokService.updateDraft(
      tenantID,
      id,
      req.body
    );
    res
      .status(200)
      .json({
        message: "Draft Permintaan berhasil diperbarui.",
        data: updatedRequest,
      });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 5. DELETE DRAFT (Hanya status DRAFT)
// ===============================================
exports.deletePermintaanDraft = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params; // Service harus mengecek bahwa statusnya masih DRAFT sebelum delete
    const result = await PermintaanStokService.deleteDraft(tenantID, id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 6. UPDATE STATUS: SUBMIT (DRAFT -> SUBMITTED)
// ===============================================
exports.submitRequest = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedRequest = await PermintaanStokService.updateStatus(
      tenantID,
      id,
      "SUBMITTED",
      req.body
    );
    res
      .status(200)
      .json({
        message: "Permintaan Stok berhasil disubmit ke Gudang.",
        data: updatedRequest.request,
      });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 7. UPDATE STATUS: APPROVE (SUBMITTED -> APPROVED)
// ===============================================
exports.approveRequest = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    // Payload harus menyertakan items dengan qtyApproved dan diprosesOleh
    const result = await PermintaanStokService.updateStatus(
      tenantID,
      id,
      "APPROVED",
      req.body
    );
    res.status(200).json({
      message: "Permintaan disetujui. Dokumen Transfer Stok berhasil dibuat.",
      request: result.request,
      transferStokBaru: result.transferStok,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// 8. UPDATE STATUS: REJECT (SUBMITTED -> REJECTED)
// ===============================================
exports.rejectRequest = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedRequest = await PermintaanStokService.updateStatus(
      tenantID,
      id,
      "REJECTED",
      req.body
    );
    res.status(200).json({
      message: "Permintaan Stok ditolak oleh Gudang.",
      data: updatedRequest.request,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};
