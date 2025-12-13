// diskonService.js
const Diskon = require("../models/diskonModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const { validateDiskonPayload } = require("../validators/diskonValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

class DiskonService {
  // Helper: Menangani Error Mongoose (Dipindahkan dari Controller)
  handleDbError(error, defaultMessage = "Gagal memproses data Diskon") {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue);
      return createError(400, {
        message: `Gagal menambahkan/memperbarui. ${field} '${error.keyValue[field]}' sudah terdaftar (dalam tenant yang sama).`,
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
    const validation = validateDiskonPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const diskon = await Diskon.create(payload);
      return diskon;
    } catch (error) {
      throw this.handleDbError(error, "Gagal menambahkan Diskon.");
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    const diskon = await Diskon.find({ tenantID }).sort({
      status: -1,
      nilai: -1,
    });

    if (diskon.length === 0)
      throw createError(404, "Tidak ada data Diskon untuk tenant ini.");

    return diskon;
  }

  // --- READ BY ID ---
  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Diskon dan Tenant ID wajib disertakan dan harus valid."
      );

    const diskon = await Diskon.findOne({ _id: id, tenantID }); // KEAMANAN: Filter ID & tenantID

    if (!diskon)
      throw createError(
        404,
        "Diskon tidak ditemukan atau Anda tidak memiliki akses."
      );

    return diskon;
  }

  // --- UPDATE ---
  async update(tenantID, id, payload) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Diskon dan Tenant ID wajib disertakan dan harus valid."
      );

    const validation = validateDiskonPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      // KEAMANAN KRITIS: Update hanya jika _id dan tenantID cocok
      const diskon = await Diskon.findOneAndUpdate(
        { _id: id, tenantID: tenantID },
        validation.updates,
        { new: true, runValidators: true, context: "query" }
      );

      if (!diskon)
        throw createError(
          404,
          "Diskon tidak ditemukan atau Anda tidak memiliki akses."
        );

      return diskon;
    } catch (error) {
      throw this.handleDbError(error, "Gagal memperbarui Diskon.");
    }
  }

  // --- DELETE ---
  async delete(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Diskon dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      // KEAMANAN KRITIS: Delete hanya jika _id dan tenantID cocok
      const deletedDiskon = await Diskon.findOneAndDelete({
        _id: id,
        tenantID: tenantID,
      });

      if (!deletedDiskon)
        throw createError(
          404,
          "Diskon tidak ditemukan atau Anda tidak memiliki akses."
        );

      return { message: "Diskon berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus Diskon.");
    }
  }
}

module.exports = new DiskonService();
