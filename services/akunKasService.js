const AkunKas = require("../models/akunKasModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const { validateAkunKasPayload } = require("../validators/akunKasValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

class AkunKasService {
  // Helper: Menangani Error Mongoose (Dipindahkan dari Controller)
  handleDbError(error, defaultMessage = "Gagal memproses data Akun Kas") {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue);
      return createError(400, {
        message: `Gagal menambahkan/memperbarui. ${field} '${error.keyValue[field]}' sudah terdaftar (dalam tenant yang sama).`,
      });
    }
    if (error.name === "ValidationError") {
      // Konversi Mongoose ValidationError menjadi format http-errors
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
    const validation = validateAkunKasPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const akunKas = await AkunKas.create(payload);
      return akunKas;
    } catch (error) {
      throw this.handleDbError(error, "Gagal menambahkan Akun Kas.");
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    const akunKas = await AkunKas.find({ tenantID }).sort({ createdAt: -1 });

    if (akunKas.length === 0)
      throw createError(404, "Tidak ada data Akun Kas untuk tenant ini.");

    return akunKas;
  }

  // --- READ BY ID ---
  async getById(id) {
    if (!isValidObjectId(id)) throw createError(400, "Format ID tidak valid.");

    try {
      const akunKas = await AkunKas.findById(id);
      if (!akunKas) throw createError(404, "Akun Kas tidak ditemukan.");
      return akunKas;
    } catch (error) {
      throw this.handleDbError(error, "Gagal mengambil Akun Kas.");
    }
  }

  // --- UPDATE ---
  async update(tenantID, id, payload) {
    if (!isValidObjectId(tenantID) || !isValidObjectId(id))
      throw createError(
        400,
        "Parameter tenantID dan ID wajib disertakan dan harus valid."
      );

    const validation = validateAkunKasPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      // KEAMANAN KRITIS: Update hanya jika _id dan tenantID cocok
      const akunKas = await AkunKas.findOneAndUpdate(
        { _id: id, tenantID },
        validation.updates,
        { new: true, runValidators: true, context: "query" }
      );

      if (!akunKas)
        throw createError(
          404,
          "Akun Kas tidak ditemukan atau Anda tidak memiliki akses."
        );
      return akunKas;
    } catch (error) {
      throw this.handleDbError(error, "Gagal memperbarui Akun Kas.");
    }
  }

  // --- DELETE ---
  async delete(tenantID, id) {
    if (!isValidObjectId(tenantID) || !isValidObjectId(id))
      throw createError(
        400,
        "Parameter tenantID dan ID wajib disertakan dan harus valid."
      );

    try {
      // KEAMANAN KRITIS: Delete hanya jika _id dan tenantID cocok
      const akunKas = await AkunKas.findOneAndDelete({ _id: id, tenantID });

      if (!akunKas)
        throw createError(
          404,
          "Akun Kas tidak ditemukan atau Anda tidak memiliki akses."
        );
      return { message: "Akun Kas berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus Akun Kas.");
    }
  }
}

module.exports = new AkunKasService();
