// izinCutiService.js
const IzinCuti = require("../models/izinCutiModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const redis = require("../utils/redisClient");
const { validateIzinCutiPayload } = require("../validators/izinCutiValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyIzinList = (tenantID) => `izincuti:tenant:${tenantID}`;
const keyIzinDetail = (id) => `izincuti:detail:${id}`;

class IzinCutiService {
  // Helper: Menangani Error Mongoose
  handleDbError(error, defaultMessage = "Gagal memproses data Izin Cuti") {
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
    const validation = validateIzinCutiPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const newIzinCuti = new IzinCuti(payload);
      const savedIzinCuti = await newIzinCuti.save();

      // Invalidate Cache List
      await redis.del(keyIzinList(payload.tenantID));

      return savedIzinCuti;
    } catch (error) {
      throw this.handleDbError(error, "Gagal menambahkan Izin Cuti.");
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    const cacheKey = keyIzinList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    try {
      const data = await IzinCuti.find({ tenantID })
        .populate("tenantID", "namaToko")
        .populate("penggunaID", "nama email")
        .populate("dicatatOleh", "nama")
        .sort({ createdAt: -1 });

      if (data.length === 0)
        throw createError(404, "Tidak ada data Izin/Cuti untuk tenant ini.");

      // Cache Miss: Simpan ke Redis (Expire 60 detik)
      await redis.setEx(cacheKey, 60, JSON.stringify(data));
      return data;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal mengambil daftar Izin Cuti.");
    }
  }

  // --- READ BY ID ---
  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Izin dan Tenant ID wajib disertakan dan harus valid."
      );

    const cacheKey = keyIzinDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      // Catatan: Data cache ini tidak diverifikasi tenantID-nya, asumsi caching dilakukan setelah filter
      return JSON.parse(cachedData);
    }

    try {
      // KEAMANAN KRITIS: Filter ID & tenantID
      const izinCuti = await IzinCuti.findOne({ _id: id, tenantID })
        .populate("tenantID", "namaToko")
        .populate("penggunaID", "nama email")
        .populate("dicatatOleh", "nama");

      if (!izinCuti)
        throw createError(
          404,
          "Data izin/cuti tidak ditemukan atau Anda tidak memiliki akses."
        );

      // Cache Miss: Simpan ke Redis (Expire 60 detik)
      await redis.setEx(cacheKey, 60, JSON.stringify(izinCuti));
      return izinCuti;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal mengambil detail Izin Cuti.");
    }
  }

  // --- UPDATE ---
  async update(tenantID, id, payload) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Izin dan Tenant ID wajib disertakan dan harus valid."
      );

    const validation = validateIzinCutiPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const updates = validation.updates;

      // 1. Ambil data lama untuk validasi silang (tanggalMulai/Selesai)
      const oldIzin = await IzinCuti.findOne({ _id: id, tenantID });
      if (!oldIzin)
        throw createError(
          404,
          "Data izin/cuti tidak ditemukan atau Anda tidak memiliki akses."
        );

      // 2. Validasi Logika Tanggal Lanjutan (gabungan data lama dan baru)
      const newStart = updates.tanggalMulai || oldIzin.tanggalMulai;
      const newEnd = updates.tanggalSelesai || oldIzin.tanggalSelesai;

      if (new Date(newEnd) < new Date(newStart)) {
        throw createError(
          400,
          "Tanggal selesai tidak boleh sebelum tanggal mulai."
        );
      }

      // 3. Update DB: Hanya jika _id dan tenantID cocok
      const updatedIzin = await IzinCuti.findOneAndUpdate(
        { _id: id, tenantID: tenantID },
        updates,
        { new: true, runValidators: true }
      )
        .populate("penggunaID", "nama")
        .populate("dicatatOleh", "nama");

      if (!updatedIzin)
        throw createError(
          404,
          "Data izin/cuti tidak ditemukan atau Anda tidak memiliki akses."
        );

      // Invalidate Cache
      await redis.del(keyIzinDetail(id));
      await redis.del(keyIzinList(tenantID));

      return updatedIzin;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal memperbarui Izin Cuti.");
    }
  }

  // --- DELETE ---
  async delete(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Izin dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      // KEAMANAN KRITIS: Delete hanya jika _id dan tenantID cocok
      const deletedIzin = await IzinCuti.findOneAndDelete({
        _id: id,
        tenantID: tenantID,
      });

      if (!deletedIzin)
        throw createError(
          404,
          "Data izin/cuti tidak ditemukan atau Anda tidak memiliki akses."
        );

      // Invalidate Cache
      await redis.del(keyIzinDetail(id));
      await redis.del(keyIzinList(tenantID));

      return { message: "Data izin/cuti berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus Izin Cuti.");
    }
  }
}

module.exports = new IzinCutiService();
