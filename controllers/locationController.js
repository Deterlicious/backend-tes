// locationController.js
const LocationService = require("../services/locationService");
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
// ✅ CREATE: Tambah Lokasi
// ===============================================
exports.createLocation = async (req, res) => {
  try {
    const newLocation = await LocationService.create(req.body);
    res.status(201).json(newLocation);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ ALL: Filter berdasarkan tenantID (Query)
// ===============================================
exports.getAllLocations = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const data = await LocationService.getAll(tenantID);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ BY ID (Query: tenantID, Params: id)
// ===============================================
exports.getLocationById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query;
    const location = await LocationService.getById(tenantID, id);
    res.status(200).json(location);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ UPDATE Lokasi (Query: tenantID, Params: id)
// ===============================================
exports.updateLocation = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedLocation = await LocationService.update(
      tenantID,
      id,
      req.body
    );
    res.status(200).json(updatedLocation);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ DELETE Lokasi (Query: tenantID, Params: id)
// ===============================================
exports.deleteLocation = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const result = await LocationService.delete(tenantID, id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
