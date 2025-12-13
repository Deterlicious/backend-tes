// bebanOperasionalService.js
const BebanOperasional = require("../models/bebanOperasionalModel");
const AkunKas = require("../models/akunKasModel"); // Diperlukan untuk logika bisnis saldo
const mongoose = require("mongoose");
const createError = require("http-errors");
const {
  validateBebanPayload,
} = require("../validators/bebanOperasionalValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

class BebanOperasionalService {
  // Helper: Menangani Error Mongoose (Dipindahkan dari Controller)
  handleDbError(
    error,
    defaultMessage = "Gagal memproses data Beban Operasional"
  ) {
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
    const validation = validateBebanPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // 1. BUAT DOKUMEN BEBAN
      const bebanOperasional = await BebanOperasional.create([payload], {
        session,
      });

      // 2. LOGIKA BISNIS: KURANGI SALDO AKUN KAS
      // Perlu memastikan AkunKasID valid dan milik tenant yang sama sebelum update
      const updateResult = await AkunKas.updateOne(
        { _id: payload.akunKasID, tenantID: payload.tenantID },
        { $inc: { saldo: -payload.jumlah } },
        { session }
      );

      // Validasi apakah update saldo berhasil (Akun Kas ditemukan)
      if (updateResult.matchedCount === 0) {
        throw createError(
          400,
          "Akun Kas tidak ditemukan atau bukan milik tenant ini."
        );
      }

      await session.commitTransaction();
      return bebanOperasional[0];
    } catch (error) {
      await session.abortTransaction();
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal menambahkan Beban Operasional.");
    } finally {
      session.endSession();
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    const bebanOperasional = await BebanOperasional.find({ tenantID })
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("kategoriBebanID", "namaKategori")
      .populate("dicatatOleh", "nama")
      .sort({ tanggal: -1, createdAt: -1 });

    if (bebanOperasional.length === 0)
      throw createError(
        404,
        "Tidak ada data Beban Operasional untuk tenant ini."
      );

    return bebanOperasional;
  }

  // --- READ BY ID ---
  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Beban dan Tenant ID wajib disertakan dan harus valid."
      );

    const bebanOperasional = await BebanOperasional.findOne({
      _id: id,
      tenantID,
    }) // KEAMANAN: Filter ID & tenantID
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("kategoriBebanID", "namaKategori")
      .populate("dicatatOleh", "nama");

    if (!bebanOperasional)
      throw createError(
        404,
        "Beban Operasional tidak ditemukan atau Anda tidak memiliki akses."
      );

    return bebanOperasional;
  }

  // --- UPDATE ---
  async update(tenantID, id, payload) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Beban dan Tenant ID wajib disertakan dan harus valid."
      );

    const validation = validateBebanPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // 1. AMBIL DATA LAMA DAN LAKUKAN UPDATE
      const oldBeban = await BebanOperasional.findOne({ _id: id, tenantID });
      if (!oldBeban)
        throw createError(
          404,
          "Beban Operasional tidak ditemukan atau Anda tidak memiliki akses."
        );

      const updatedBeban = await BebanOperasional.findByIdAndUpdate(
        id,
        validation.updates,
        { new: true, runValidators: true, session }
      );

      // 2. LOGIKA BISNIS: ADJUST SALDO
      // Logika ini kompleks: Batalkan transaksi lama, terapkan transaksi baru.

      // Revert transaksi lama: Kembalikan jumlah lama ke akun kas lama
      await AkunKas.updateOne(
        { _id: oldBeban.akunKasID, tenantID },
        { $inc: { saldo: oldBeban.jumlah } },
        { session }
      );

      // Terapkan transaksi baru: Kurangi jumlah baru dari akun kas baru
      const newJumlah = payload.jumlah || oldBeban.jumlah;
      const newAkunKasID = payload.akunKasID || oldBeban.akunKasID;

      await AkunKas.updateOne(
        { _id: newAkunKasID, tenantID },
        { $inc: { saldo: -newJumlah } },
        { session }
      );

      await session.commitTransaction();
      return updatedBeban;
    } catch (error) {
      await session.abortTransaction();
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal memperbarui Beban Operasional.");
    } finally {
      session.endSession();
    }
  }

  // --- DELETE ---
  async delete(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Beban dan Tenant ID wajib disertakan dan harus valid."
      );

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // 1. HAPUS DOKUMEN BEBAN (Ambil data sebelum dihapus untuk rollback saldo)
      const deletedBeban = await BebanOperasional.findOneAndDelete(
        { _id: id, tenantID },
        { session }
      );

      if (!deletedBeban)
        throw createError(
          404,
          "Beban Operasional tidak ditemukan atau Anda tidak memiliki akses."
        );

      // 2. LOGIKA BISNIS: KEMBALIKAN SALDO AKUN KAS
      await AkunKas.updateOne(
        { _id: deletedBeban.akunKasID, tenantID },
        { $inc: { saldo: deletedBeban.jumlah } },
        { session }
      );

      await session.commitTransaction();
      return { message: "Beban Operasional berhasil dihapus" };
    } catch (error) {
      await session.abortTransaction();
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal menghapus Beban Operasional.");
    } finally {
      session.endSession();
    }
  }
}

module.exports = new BebanOperasionalService();
