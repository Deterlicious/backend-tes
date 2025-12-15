const LaporanBulanan = require("../models/laporanBulananModel");
const LaporanHarian = require("../models/laporanHarianModel"); // Diperlukan untuk Agregasi
const mongoose = require("mongoose");
const createError = require("http-errors");
const {
  validateLaporanBulananPayload,
} = require("../validators/laporanBulananValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

class LaporanBulananService {
  // Helper: Menangani Error Mongoose
  handleDbError(
    error,
    defaultMessage = "Gagal memproses data Laporan Bulanan"
  ) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue);
      return createError(400, {
        message: `Nomor Laporan Bulanan '${error.keyValue[field]}' sudah terdaftar.`,
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
  } // --- CREATE / GENERATE LOGIC (Placeholder: Logika Agregasi) ---

  async generateLaporan(tenantID, bulan, tahun) {
    // Logika Bisnis: Menghitung total dari LaporanHarian di bulan & tahun yang ditentukan.
    // 1. Tentukan rentang tanggal bulan tersebut
    const startDate = new Date(tahun, bulan - 1, 1); // Bulan di JS: 0-11
    const endDate = new Date(tahun, bulan, 0); // Hari terakhir bulan

    try {
      const aggregation = await LaporanHarian.aggregate([
        {
          $match: {
            tenantID: new mongoose.Types.ObjectId(tenantID),
            tanggal: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: null,
            jumlahTransaksi: { $sum: "$jumlahTransaksi" },
            totalOmzet: { $sum: "$totalOmzet" },
            totalHPP: { $sum: "$totalHPP" },
            totalLabaKotor: { $sum: "$totalLabaKotor" },
            totalBebanOperasional: { $sum: "$totalBebanOperasional" },
            totalLabaBersih: { $sum: "$totalLabaBersih" },
            totalUangKeluarBulanan: { $sum: "$totalUangKeluar" },
          },
        },
      ]);

      if (aggregation.length === 0)
        throw createError(
          404,
          `Tidak ada data Laporan Harian untuk ${bulan}/${tahun}.`
        );

      const dataAgregasi = aggregation[0]; // Siapkan data untuk Laporan Bulanan

      const payload = {
        laporanBulananID: `LPH-${tenantID.substring(0, 4)}-${tahun}${bulan
          .toString()
          .padStart(2, "0")}`,
        tenantID: tenantID,
        bulan: bulan,
        tahun: tahun,
        ...dataAgregasi,
      }; // Upsert (Update jika ada, Create jika tidak ada)

      const laporan = await LaporanBulanan.findOneAndUpdate(
        { tenantID, bulan, tahun },
        payload,
        { new: true, upsert: true, runValidators: true }
      );

      return laporan;
    } catch (error) {
      throw this.handleDbError(error, "Gagal menggenerasi Laporan Bulanan.");
    }
  } // --- READ ALL ---

  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    try {
      const laporan = await LaporanBulanan.find({ tenantID }).sort({
        tahun: -1,
        bulan: -1,
        createdAt: -1,
      });

      if (laporan.length === 0)
        throw createError(
          404,
          "Tidak ada data Laporan Bulanan untuk tenant ini."
        );

      return laporan;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(
        error,
        "Gagal mengambil daftar Laporan Bulanan."
      );
    }
  } // --- READ BY ID ---

  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Laporan dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      const laporan = await LaporanBulanan.findOne({ _id: id, tenantID });

      if (!laporan)
        throw createError(
          404,
          "Laporan Bulanan tidak ditemukan atau Anda tidak memiliki akses."
        );

      return laporan;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(
        error,
        "Gagal mengambil detail Laporan Bulanan."
      );
    }
  } // --- DELETE ---

  async delete(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Laporan dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      const deletedLaporan = await LaporanBulanan.findOneAndDelete({
        _id: id,
        tenantID: tenantID,
      });

      if (!deletedLaporan)
        throw createError(
          404,
          "Laporan Bulanan tidak ditemukan atau Anda tidak memiliki akses."
        );

      return { message: "Laporan Bulanan berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus Laporan Bulanan.");
    }
  }
}

module.exports = new LaporanBulananService();
