// jurnalStokController.js
const JurnalStokService = require("../services/jurnalStokService");
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
// ✅ CREATE: Tambah Jurnal Stok
// ===============================================
exports.createJurnalStok = async (req, res) => {
  try {
    const newJurnal = await JurnalStokService.create(req.body);
    res
      .status(201)
      .json({ message: "Jurnal Stok berhasil ditambahkan", data: newJurnal });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ ALL: Filter berdasarkan tenantID (Query)
// ===============================================
exports.getAllJurnalStok = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const jurnalStok = await JurnalStokService.getAll(tenantID);
    res.status(200).json(jurnalStok);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ BY ID (Query: tenantID, Params: id)
// ===============================================
exports.getJurnalStokById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query; // Wajib ada untuk keamanan
    const jurnalStok = await JurnalStokService.getById(tenantID, id);
    res.status(200).json(jurnalStok);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ UPDATE Jurnal Stok (Query: tenantID, Params: id)
// ===============================================
exports.updateJurnalStok = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedJurnal = await JurnalStokService.update(
      tenantID,
      id,
      req.body
    );
    res
      .status(200)
      .json({
        message: "Jurnal Stok berhasil diperbarui",
        data: updatedJurnal,
      });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ DELETE Jurnal Stok (Query: tenantID, Params: id)
// ===============================================
exports.deleteJurnalStok = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const result = await JurnalStokService.delete(tenantID, id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
