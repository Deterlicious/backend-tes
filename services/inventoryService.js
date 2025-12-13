// inventoryService.js
const Inventory = require("../models/inventoryModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const {
  validateInventoryPayload,
} = require("../validators/inventoryValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

class InventoryService {
  // Helper: Menangani Error Mongoose (Termasuk Unique Index)
  handleDbError(error, defaultMessage = "Gagal memproses data Stok") {
    if (error.code === 11000) {
      // Error ini terpicu oleh unique index: { bahanBakuID: 1, locationID: 1 }
      return createError(400, {
        message: "Stok untuk bahan baku ini sudah ada di lokasi yang sama.",
      });
    }
    if (error.name === "ValidationError") {
      let errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return createError(400, {
        message: "Validasi data gagal. Cek detail errors.",
        errors: errors,
      });
    }
    if (error.name === "CastError") {
      return createError(400, { message: "Format ID tidak valid." });
    }
    return createError(500, error.message || defaultMessage);
  }

  // --- CREATE ---
  async create(payload) {
    const validation = validateInventoryPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const newInventory = new Inventory(payload);
      const savedInventory = await newInventory.save();

      return savedInventory;
    } catch (error) {
      throw this.handleDbError(error, "Gagal menambahkan Stok Bahan Baku.");
    }
  }

  // --- READ ALL (Wajib filter berdasarkan tenantID dan opsional locationID) ---
  async getAll(tenantID, locationID = null) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    try {
      const filter = { tenantID };
      if (locationID) {
        if (!isValidObjectId(locationID))
          throw createError(400, "locationID tidak valid.");
        filter.locationID = locationID;
      }

      const inventory = await Inventory.find(filter)
        .populate("bahanBakuID", "namaBahan satuan")
        .populate("locationID", "nama tipe")
        .sort({ "locationID.nama": 1, "bahanBakuID.namaBahan": 1 });

      if (inventory.length === 0)
        throw createError(404, "Tidak ada data Stok yang ditemukan.");

      return inventory;
    } catch (error) {
      throw this.handleDbError(
        error,
        "Gagal mengambil daftar Stok Bahan Baku."
      );
    }
  }

  // --- READ BY ID ---
  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Stok dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      // KEAMANAN KRITIS: Filter ID & tenantID
      const inventory = await Inventory.findOne({ _id: id, tenantID })
        .populate("bahanBakuID", "namaBahan satuan")
        .populate("locationID", "nama tipe");

      if (!inventory)
        throw createError(
          404,
          "Data Stok tidak ditemukan atau Anda tidak memiliki akses."
        );

      return inventory;
    } catch (error) {
      throw this.handleDbError(
        error,
        "Gagal mengambil detail Stok Bahan Baku."
      );
    }
  }

  // --- UPDATE (Penyesuaian Stok Manual) ---
  async update(tenantID, id, payload) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Stok dan Tenant ID wajib disertakan dan harus valid."
      );

    const validation = validateInventoryPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const updates = validation.updates;

      // Update DB: Hanya jika _id dan tenantID cocok
      const updatedInventory = await Inventory.findOneAndUpdate(
        { _id: id, tenantID: tenantID },
        updates,
        { new: true, runValidators: true }
      );

      if (!updatedInventory)
        throw createError(
          404,
          "Data Stok tidak ditemukan atau Anda tidak memiliki akses."
        );

      return updatedInventory;
    } catch (error) {
      throw this.handleDbError(error, "Gagal memperbarui Stok Bahan Baku.");
    }
  }

  // --- DELETE (Menghapus entry stok per lokasi) ---
  async delete(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Stok dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      // KEAMANAN KRITIS: Delete hanya jika _id dan tenantID cocok
      const deletedInventory = await Inventory.findOneAndDelete({
        _id: id,
        tenantID: tenantID,
      });

      if (!deletedInventory)
        throw createError(
          404,
          "Data Stok tidak ditemukan atau Anda tidak memiliki akses."
        );

      return { message: "Entry Stok berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus entry Stok.");
    }
  }
}

module.exports = new InventoryService();
