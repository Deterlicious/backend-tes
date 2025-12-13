// membershipController.js
const MembershipService = require("../services/membershipService"); // Sesuaikan path
const createError = require("http-errors");

// Helper untuk menangani HttpErrors yang dilempar dari Service
const handleServiceError = (res, error) => {
  // Memeriksa apakah error dilempar oleh http-errors atau service custom
  if (createError.isHttpError(error) && error.statusCode) {
    return res
      .status(error.statusCode)
      .json({ message: error.message, errors: error.errors });
  }
  // Menangkap error 500 lainnya
  res.status(500).json({ message: error.message });
};

// ===============================================
// ✅ CREATE: Tambah Membership
// ===============================================
exports.createMembership = async (req, res) => {
  try {
    const newMembership = await MembershipService.create(req.body);
    res
      .status(201)
      .json({
        message: "Membership berhasil ditambahkan",
        data: newMembership,
      });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ ALL
// ===============================================
exports.getAllMembership = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const membership = await MembershipService.getAll(tenantID);
    res.status(200).json(membership);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ BY ID
// ===============================================
exports.getMembershipById = async (req, res) => {
  try {
    const { id } = req.params;
    const membership = await MembershipService.getById(id);
    res.status(200).json(membership);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ UPDATE
// ===============================================
exports.updateMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedMembership = await MembershipService.update(id, req.body);
    res
      .status(200)
      .json({
        message: "Membership berhasil diperbarui",
        data: updatedMembership,
      });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ DELETE
// ===============================================
exports.deleteMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await MembershipService.delete(id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
