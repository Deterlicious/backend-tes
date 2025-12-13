const AbsensiService = require("../services/absensiService"); // Sesuaikan path
const createError = require("http-errors");

// Helper untuk menangani HttpErrors yang dilempar dari Service
const handleServiceError = (res, error) => {
  if (createError.isHttpError(error) && error.statusCode) {
    return res
      .status(error.statusCode)
      .json({ message: error.message, errors: error.errors });
  }
  res.status(500).json({ message: error.message });
};

exports.createAbsensi = async (req, res) => {
  try {
    const newAbsensi = await AbsensiService.create(req.body);
    res
      .status(201)
      .json({ message: "Absensi berhasil dibuat", data: newAbsensi });
  } catch (error) {
    handleServiceError(res, error);
  }
};

exports.getAllAbsensi = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const absensi = await AbsensiService.getAll(tenantID);
    res.json(absensi);
  } catch (error) {
    handleServiceError(res, error);
  }
};

exports.getAbsensiById = async (req, res) => {
  try {
    const { id } = req.params;
    const absensi = await AbsensiService.getById(id);
    res.json(absensi);
  } catch (error) {
    handleServiceError(res, error);
  }
};

exports.updateAbsensi = async (req, res) => {
  try {
    const { id } = req.params;
    const absensi = await AbsensiService.update(id, req.body);
    res.json(absensi);
  } catch (error) {
    handleServiceError(res, error);
  }
};

exports.deleteAbsensi = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await AbsensiService.delete(id);
    res.json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
