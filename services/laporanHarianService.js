const LaporanHarian = require("../models/laporanHarianModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
// const { validateLaporanHarianPayload } = require("../validators/laporanHarianValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

class LaporanHarianService {
  // Helper: Menangani Error Mongoose
  handleDbError(error, defaultMessage = "Gagal memproses data Laporan Harian") {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue);
      return createError(400, {
        message: `Nomor Laporan Harian '${error.keyValue[field]}' sudah terdaftar.`,
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
  } // --- READ ALL ---

  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    try {
      const laporan = await LaporanHarian.find({ tenantID }).sort({
        tanggal: -1,
        createdAt: -1,
      });

      if (laporan.length === 0)
        throw createError(
          404,
          "Tidak ada data Laporan Harian untuk tenant ini."
        );

      return laporan;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal mengambil daftar Laporan Harian.");
    }
  } // --- READ BY ID ---

  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Laporan dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      const laporan = await LaporanHarian.findOne({ _id: id, tenantID });

      if (!laporan)
        throw createError(
          404,
          "Laporan Harian tidak ditemukan atau Anda tidak memiliki akses."
        );

      return laporan;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal mengambil detail Laporan Harian.");
    }
  } // --- DELETE (Hanya jika diperlukan untuk koreksi data) ---

  async delete(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Laporan dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      const deletedLaporan = await LaporanHarian.findOneAndDelete({
        _id: id,
        tenantID: tenantID,
      });

      if (!deletedLaporan)
        throw createError(
          404,
          "Laporan Harian tidak ditemukan atau Anda tidak memiliki akses."
        );

      return { message: "Laporan Harian berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus Laporan Harian.");
    }
  }
}

module.exports = new LaporanHarianService();
