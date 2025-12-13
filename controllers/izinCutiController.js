// izinCutiController.js
const IzinCutiService = require("../services/izinCutiService");
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
// ✅ CREATE: Tambah Izin Cuti
// ===============================================
exports.createIzinCuti = async (req, res) => {
  try {
    const newIzinCuti = await IzinCutiService.create(req.body);
    res.status(201).json(newIzinCuti);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ ALL: Filter berdasarkan tenantID (Query)
// ===============================================
exports.getAllIzinCuti = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const data = await IzinCutiService.getAll(tenantID);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ BY ID (Query: tenantID, Params: id)
// ===============================================
exports.getIzinCutiById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query; // Wajib ada untuk keamanan
    const izinCuti = await IzinCutiService.getById(tenantID, id);
    res.status(200).json(izinCuti);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ UPDATE Izin Cuti (Query: tenantID, Params: id)
// ===============================================
exports.updateIzinCuti = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedIzinCuti = await IzinCutiService.update(
      tenantID,
      id,
      req.body
    );
    res.status(200).json(updatedIzinCuti);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ DELETE Izin Cuti (Query: tenantID, Params: id)
// ===============================================
exports.deleteIzinCuti = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const result = await IzinCutiService.delete(tenantID, id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
