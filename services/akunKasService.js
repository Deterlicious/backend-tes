const AkunKas = require("../models/akunKasModel");
const mongoose = require("mongoose");
const redis = require("../config/redis");
const createError = require("http-errors");
const { validateAkunKasPayload } = require("../validators/akunKasValidator");

// --- CACHE KEYS (Mengikuti Standar AkunService) ---
const KEY_LIST = (tenantID) => `akunkas:list:${tenantID}`;
const KEY_DETAIL = (id) => `akunkas:detail:${id}`;

class AkunKasService {
  // --- CACHE HELPER ---
  async clearCache(id, tenantID) {
    if (id) await redis.del(KEY_DETAIL(id));
    if (tenantID) await redis.del(KEY_LIST(tenantID));
  }

  // --- PRIVATE DB ERROR HANDLER (Clean & Reusable) ---
  #handleDbError(error) {
    if (error.code === 11000) {
      return createError(
        400,
        "Nama atau Kode Akun Kas sudah terdaftar dalam tenant ini."
      );
    }
    if (error.name === "ValidationError") {
      return createError(400, Object.values(error.errors)[0].message);
    }
    return createError(500, error.message);
  }

  // --- CREATE ---
  async create(payload) {
    // 1. Validasi Input Dasar
    const validation = validateAkunKasPayload(payload, false);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      const akunKas = await AkunKas.create(payload);

      // 2. Invalidate List Cache agar data terbaru muncul
      await this.clearCache(null, payload.tenantID);

      return akunKas;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID wajib disertakan.");

    // 1. Cek Redis Cache
    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    // 2. Query DB dengan .lean()
    const akunKas = await AkunKas.find({ tenantID })
      .sort({ createdAt: -1 })
      .lean();

    if (akunKas.length === 0)
      throw createError(404, "Data Akun Kas tidak ditemukan.");

    // 3. Simpan ke Cache (300 detik)
    await redis.set(KEY_LIST(tenantID), JSON.stringify(akunKas), "EX", 300);

    return akunKas;
  }

  // --- READ BY ID ---
  async getById(id, tenantID) {
    // 1. Cek Detail Cache
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
      const data = JSON.parse(cached);
      // Anti-Tampering: Pastikan tenantID sesuai
      if (data.tenantID.toString() !== tenantID.toString())
        throw createError(403, "Akses ditolak.");
      return data;
    }

    // 2. Query DB dengan isolasi tenant
    const akunKas = await AkunKas.findOne({ _id: id, tenantID }).lean();
    if (!akunKas) throw createError(404, "Akun Kas tidak ditemukan.");

    // 3. Simpan ke Cache (600 detik)
    await redis.set(KEY_DETAIL(id), JSON.stringify(akunKas), "EX", 600);

    return akunKas;
  }

  // --- UPDATE ---
  async update(id, tenantID, payload) {
    // 1. Validasi Input
    const validation = validateAkunKasPayload(payload, true);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      // 2. Update dengan filter tenantID (Hanya bisa ubah milik sendiri)
      const updated = await AkunKas.findOneAndUpdate(
        { _id: id, tenantID },
        { $set: validation.updates },
        { new: true, runValidators: true, context: "query" }
      ).lean();

      if (!updated)
        throw createError(404, "Data tidak ditemukan atau akses ditolak.");

      // 3. Clear Cache Detail & List
      await this.clearCache(id, tenantID);

      return updated;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  // --- DELETE ---
  async delete(id, tenantID) {
    // 1. Delete dengan filter tenantID murni dari token
    const deleted = await AkunKas.findOneAndDelete({ _id: id, tenantID });

    if (!deleted)
      throw createError(404, "Data tidak ditemukan atau akses ditolak.");

    // 2. Clear Cache
    await this.clearCache(id, tenantID);

    return { message: "Akun Kas berhasil dihapus" };
  }
}

module.exports = new AkunKasService();
