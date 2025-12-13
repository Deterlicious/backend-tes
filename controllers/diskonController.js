// diskonController.js
const DiskonService = require("../services/diskonService");
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
// ✅ CREATE: Tambah Diskon
// ===============================================
exports.createDiskon = async (req, res) => {
  try {
    const newDiskon = await DiskonService.create(req.body);
    res
      .status(201)
      .json({ message: "Diskon berhasil ditambahkan", data: newDiskon });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ ALL: Filter berdasarkan tenantID (Query)
// ===============================================
exports.getAllDiskon = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const diskon = await DiskonService.getAll(tenantID);
    res.status(200).json(diskon);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ BY ID (Query: tenantID, Params: id)
// ===============================================
exports.getDiskonById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query; // Wajib ada untuk keamanan
    const diskon = await DiskonService.getById(tenantID, id);
    res.status(200).json(diskon);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ UPDATE Diskon (Query: tenantID, Params: id)
// ===============================================
exports.updateDiskon = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedDiskon = await DiskonService.update(tenantID, id, req.body);
    res
      .status(200)
      .json({ message: "Diskon berhasil diperbarui", data: updatedDiskon });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ DELETE Diskon (Query: tenantID, Params: id)
// ===============================================
exports.deleteDiskon = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const result = await DiskonService.delete(tenantID, id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
