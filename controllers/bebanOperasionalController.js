// bebanOperasionalController.js
const BebanOperasionalService = require("../services/bebanOperasionalService");
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
// ✅ CREATE: Tambah Beban Operasional
// ===============================================
exports.createBebanOperasional = async (req, res) => {
  try {
    const newBeban = await BebanOperasionalService.create(req.body);
    res
      .status(201)
      .json({
        message: "Beban Operasional berhasil ditambahkan",
        data: newBeban,
      });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ ALL: Filter berdasarkan tenantID (Query)
// ===============================================
exports.getAllBebanOperasional = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const bebanOperasional = await BebanOperasionalService.getAll(tenantID);
    res.status(200).json(bebanOperasional);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ BY ID (Query: tenantID, Params: id)
// ===============================================
exports.getBebanOperasionalById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query; // Wajib ada untuk keamanan
    const bebanOperasional = await BebanOperasionalService.getById(
      tenantID,
      id
    );
    res.status(200).json(bebanOperasional);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ UPDATE Beban Operasional (Query: tenantID, Params: id)
// ===============================================
exports.updateBebanOperasional = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedBeban = await BebanOperasionalService.update(
      tenantID,
      id,
      req.body
    );
    res
      .status(200)
      .json({
        message: "Beban Operasional berhasil diperbarui",
        data: updatedBeban,
      });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ DELETE Beban Operasional (Query: tenantID, Params: id)
// ===============================================
exports.deleteBebanOperasional = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const result = await BebanOperasionalService.delete(tenantID, id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
