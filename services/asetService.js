// asetService.js
const Aset = require("../models/asetModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const redis = require("../utils/redisClient"); // Redis Client
const { validateAsetPayload } = require("../validators/asetValidator"); // Import Validator

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyAsetList = (tenantID) => `aset:tenant:${tenantID}`;
const keyAsetDetail = (id) => `aset:detail:${id}`;

class AsetService {
  // Helper untuk menangani error Mongoose dan lainnya
  handleServiceError(error, defaultMessage = "Gagal memproses data Aset") {
    // ... (Tambahkan logika error handling Mongoose/Duplikasi jika diperlukan) ...
    if (error.name === "CastError") {
      return createError(400, { message: "Format ID tidak valid." });
    }
    return createError(500, error.message || defaultMessage);
  }

  // --- CREATE ---
  async create(payload) {
    const validation = validateAsetPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const newAset = new Aset(payload);
      const savedAset = await newAset.save();

      // Invalidate Cache List
      await redis.del(keyAsetList(payload.tenantID));

      return savedAset;
    } catch (error) {
      throw this.handleServiceError(error, "Gagal menambahkan Aset.");
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    const cacheKey = keyAsetList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    try {
      // Populate tipeAsetID
      const asets = await Aset.find({ tenantID }).populate(
        "tipeAsetID",
        "namaTipeAset deskripsi"
      );

      if (asets.length === 0)
        throw createError(404, "Tidak ada data Aset untuk tenant ini.");

      // Cache Miss: Simpan ke Redis (Expire 60 detik)
      await redis.setEx(cacheKey, 60, JSON.stringify(asets));
      return asets;
    } catch (error) {
      throw this.handleServiceError(error, "Gagal mengambil daftar Aset.");
    }
  }

  // --- READ BY ID ---
  async getById(id) {
    if (!isValidObjectId(id))
      throw createError(400, "Format ID Aset tidak valid.");

    const cacheKey = keyAsetDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    try {
      const aset = await Aset.findById(id).populate(
        "tipeAsetID",
        "namaTipeAset deskripsi"
      );

      if (!aset) throw createError(404, "Aset tidak ditemukan");

      // Cache Miss: Simpan ke Redis (Expire 60 detik)
      await redis.setEx(cacheKey, 60, JSON.stringify(aset));
      return aset;
    } catch (error) {
      throw this.handleServiceError(error, "Gagal mengambil detail Aset.");
    }
  }

  // --- UPDATE ---
  async update(tenantID, id, payload) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Aset dan Tenant ID wajib disertakan dan harus valid."
      );

    const validation = validateAsetPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      // KEAMANAN KRITIS: Filter berdasarkan _id dan tenantID
      const updatedAset = await Aset.findOneAndUpdate(
        { _id: id, tenantID: tenantID },
        validation.updates,
        { new: true, runValidators: true }
      );

      if (!updatedAset)
        throw createError(
          404,
          "Aset tidak ditemukan atau Anda tidak memiliki akses."
        );

      // Invalidate Cache
      await redis.del(keyAsetDetail(id));
      await redis.del(keyAsetList(tenantID)); // Gunakan tenantID dari request karena sudah divalidasi

      return updatedAset;
    } catch (error) {
      throw this.handleServiceError(error, "Gagal memperbarui Aset.");
    }
  }

  // --- DELETE ---
  async delete(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Aset dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      // KEAMANAN KRITIS: Filter berdasarkan _id dan tenantID
      const deletedAset = await Aset.findOneAndDelete({
        _id: id,
        tenantID: tenantID,
      });

      if (!deletedAset)
        throw createError(
          404,
          "Aset tidak ditemukan atau Anda tidak memiliki akses."
        );

      // Invalidate Cache
      await redis.del(keyAsetDetail(id));
      await redis.del(keyAsetList(tenantID));

      return { message: "Aset berhasil dihapus" };
    } catch (error) {
      throw this.handleServiceError(error, "Gagal menghapus Aset.");
    }
  }
}

module.exports = new AsetService();
