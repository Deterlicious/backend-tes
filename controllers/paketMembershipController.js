const PaketMembershipService = require("../services/paketMembershipService"); // Sesuaikan path
const createError = require("http-errors");

// Helper untuk menangani HttpErrors yang dilempar dari Service
const handleServiceError = (res, error) => {
  // Memeriksa apakah error dilempar oleh http-errors atau service custom
  if (createError.isHttpError(error) && error.statusCode) {
    return res
      .status(error.statusCode)
      .json({ message: error.message, errors: error.errors });
  }
  // Menangkap CastError, Mongoose Errors, dll.
  res.status(500).json({ message: error.message });
};

// ===============================================
// ✅ CREATE: Tambah Paket Membership
// ===============================================
exports.createPaketMembership = async (req, res) => {
  try {
    const newPaket = await PaketMembershipService.create(req.body);
    res.status(201).json({
      message: "Paket Membership berhasil ditambahkan",
      data: newPaket,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ ALL
// ===============================================
exports.getAllPaketMembership = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const paketMembership = await PaketMembershipService.getAll(tenantID);
    res.status(200).json(paketMembership);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ BY ID
// ===============================================
exports.getPaketMembershipById = async (req, res) => {
  try {
    const { id } = req.params;
    const paketMembership = await PaketMembershipService.getById(id);
    res.status(200).json(paketMembership);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ UPDATE
// ===============================================
exports.updatePaketMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPaket = await PaketMembershipService.update(id, req.body);
    res.status(200).json({
      message: "Paket Membership berhasil diperbarui",
      data: updatedPaket,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ DELETE
// ===============================================
exports.deletePaketMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await PaketMembershipService.delete(id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
