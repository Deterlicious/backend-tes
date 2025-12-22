const Diskon = require("../models/diskonModel");
const mongoose = require("mongoose");
const redis = require("../config/redis");
const createError = require("http-errors");
const { validateDiskonPayload } = require("../validators/diskonValidator");

// --- CACHE KEYS (Sesuai Standar AkunService) ---
const KEY_LIST = (tenantID) => `diskon:list:${tenantID}`;
const KEY_DETAIL = (id) => `diskon:detail:${id}`;

class DiskonService {
  // --- CACHE HELPER ---
  async clearCache(id, tenantID) {
    if (id) await redis.del(KEY_DETAIL(id));
    if (tenantID) await redis.del(KEY_LIST(tenantID));
  }

  // --- PRIVATE DB ERROR HANDLER (#) ---
  #handleDbError(error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue);
      return createError(400, `Data ${field} sudah terdaftar di tenant ini.`);
    }
    if (error.name === "ValidationError") {
      return createError(400, Object.values(error.errors)[0].message);
    }
    if (error.name === "CastError") {
      return createError(400, "Format ID tidak valid.");
    }
    return createError(500, error.message);
  }

  // --- CREATE ---
  async create(payload) {
    const validation = validateDiskonPayload(payload, false);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      const diskon = await Diskon.create(payload);

      // Invalidate list cache agar data real-time muncul di GET ALL
      await this.clearCache(null, payload.tenantID);

      return diskon;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID wajib disertakan.");

    // 1. Cek Cache Redis
    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    // 2. Query DB dengan .lean() untuk performa (Sesuai Standar Teman Anda)
    const diskon = await Diskon.find({ tenantID })
      .sort({ status: -1, createdAt: -1 })
      .lean();

    if (diskon.length === 0)
      throw createError(404, "Data diskon tidak ditemukan.");

    // 3. Simpan ke Cache (Expired 5 menit)
    await redis.set(KEY_LIST(tenantID), JSON.stringify(diskon), "EX", 300);
    return diskon;
  }

  // --- READ BY ID ---
  async getById(id, tenantID) {
    // 1. Cek Cache Detail
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
      const data = JSON.parse(cached);
      // Validasi kepemilikan data di tingkat cache
      if (data.tenantID.toString() !== tenantID.toString())
        throw createError(403, "Akses ditolak.");
      return data;
    }

    // 2. Query DB
    const diskon = await Diskon.findOne({ _id: id, tenantID }).lean();
    if (!diskon) throw createError(404, "Diskon tidak ditemukan.");

    // 3. Set Cache Detail
    await redis.set(KEY_DETAIL(id), JSON.stringify(diskon), "EX", 600);
    return diskon;
  }

  // --- UPDATE ---
  async update(id, tenantID, payload) {
    const validation = validateDiskonPayload(payload, true);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      const updated = await Diskon.findOneAndUpdate(
        { _id: id, tenantID },
        { $set: validation.updates },
        { new: true, runValidators: true }
      ).lean();

      if (!updated)
        throw createError(404, "Data tidak ditemukan atau akses ditolak.");

      // Bersihkan Cache agar data baru langsung tampil (Real-time)
      await this.clearCache(id, tenantID);

      return updated;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  // --- DELETE ---
  async delete(id, tenantID) {
    try {
      const deleted = await Diskon.findOneAndDelete({ _id: id, tenantID });
      if (!deleted) throw createError(404, "Data tidak ditemukan.");

      // Bersihkan Cache
      await this.clearCache(id, tenantID);

      return { message: "Diskon berhasil dihapus" };
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }
}

module.exports = new DiskonService();
