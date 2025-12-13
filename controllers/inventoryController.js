// inventoryController.js
const InventoryService = require("../services/inventoryService");
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
// ✅ CREATE: Tambah Entry Stok Baru
// ===============================================
exports.createInventory = async (req, res) => {
  try {
    const newInventory = await InventoryService.create(req.body);
    res.status(201).json(newInventory);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ ALL: Filter berdasarkan tenantID & locationID (Opsional)
// ===============================================
exports.getAllInventory = async (req, res) => {
  try {
    const { tenantID, locationID } = req.query;
    const data = await InventoryService.getAll(tenantID, locationID);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ READ BY ID (Query: tenantID, Params: id)
// ===============================================
exports.getInventoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query;
    const inventory = await InventoryService.getById(tenantID, id);
    res.status(200).json(inventory);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ UPDATE Stok (Penyesuaian Manual) (Query: tenantID, Params: id)
// ===============================================
exports.updateInventory = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const updatedInventory = await InventoryService.update(
      tenantID,
      id,
      req.body
    );
    res.status(200).json(updatedInventory);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// ===============================================
// ✅ DELETE Entry Stok (Query: tenantID, Params: id)
// ===============================================
exports.deleteInventory = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;
    const result = await InventoryService.delete(tenantID, id);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error);
  }
};
