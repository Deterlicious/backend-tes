// asetController.js
const AsetService = require("../services/asetService");
const createError = require("http-errors");

// Helper untuk menangani HttpErrors yang dilempar dari Service
const handleServiceError = (res, error) => {
  if (createError.isHttpError(error) && error.statusCode) {
    // Menggunakan 'error.errors' untuk menampilkan detail validasi Mongoose/Custom
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
// ✅ CREATE: Tambah Aset
// ===============================================
exports.createAset = async (req, res) => {
  try {
    const newAset = await AsetService.create(req.body);
    res.status(201).json(newAset);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ ALL: Filter berdasarkan tenantID (Query)
// ===============================================
exports.getAllAset = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const asets = await AsetService.getAll(tenantID);
    res.status(200).json(asets);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ BY ID (Params)
// ===============================================
exports.getAsetById = async (req, res) => {
  try {
    const { id } = req.params;
    const aset = await AsetService.getById(id);
    res.status(200).json(aset);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ UPDATE Aset (Query: tenantID, Params: id)
// ===============================================
exports.updateAset = async (req, res) => {
  try {
    const { tenantID } = req.query; // Wajib ada untuk keamanan
    const { id } = req.params;
    const updatedAset = await AsetService.update(tenantID, id, req.body);
    res.status(200).json(updatedAset);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ DELETE Aset (Query: tenantID, Params: id)
// ===============================================
exports.deleteAset = async (req, res) => {
  try {
    const { tenantID } = req.query; // Wajib ada untuk keamanan
    const { id } = req.params;
    const result = await AsetService.delete(tenantID, id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
