const Aset = require("../models/asetModel");
const mongoose = require("mongoose");
const redis = require("../config/redis"); // Path disesuaikan dengan AkunService
const createError = require("http-errors");
const { validateAsetPayload } = require("../validators/asetValidator");

// --- CACHE KEYS (Konsisten dengan pola AkunService) ---
const KEY_LIST = (tenantID) => `aset:list:${tenantID}`;
const KEY_DETAIL = (id) => `aset:detail:${id}`;

class AsetService {
  // --- CACHE HELPER ---
  async clearCache(id, tenantID) {
    if (id) await redis.del(KEY_DETAIL(id));
    if (tenantID) await redis.del(KEY_LIST(tenantID));
  }

  // --- PRIVATE ERROR HANDLER (#) ---
  #handleDbError(error) {
    if (error.name === "CastError") {
      return createError(400, "Format ID tidak valid.");
    }
    if (error.name === "ValidationError") {
      return createError(400, Object.values(error.errors)[0].message);
    }
    return createError(500, error.message);
  }

  // --- CREATE ---
  async create(payload) {
    // 1. Validasi Input (Ambil error pertama sesuai standar Akun)
    const validation = validateAsetPayload(payload, false);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      const newAset = await Aset.create(payload);

      // 2. Clear Cache List Tenant
      await this.clearCache(null, payload.tenantID);

      return newAset;
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

    // 2. Query DB dengan .lean() dan Populate
    const asets = await Aset.find({ tenantID })
      .populate("tipeAsetID", "namaTipeAset deskripsi")
      .sort({ createdAt: -1 })
      .lean();

    if (asets.length === 0)
      throw createError(404, "Data Aset tidak ditemukan.");

    // 3. Simpan ke Cache (Expire 300 detik/5 menit)
    await redis.set(KEY_LIST(tenantID), JSON.stringify(asets), "EX", 300);

    return asets;
  }

  // --- READ BY ID ---
  async getById(id, tenantID) {
    // 1. Cek Cache Detail
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
      const data = JSON.parse(cached);
      // Security Check: Anti-ID-Tampering
      if (data.tenantID.toString() !== tenantID.toString())
        throw createError(403, "Akses ditolak.");
      return data;
    }

    // 2. Query DB dengan isolasi Tenant
    const aset = await Aset.findOne({ _id: id, tenantID })
      .populate("tipeAsetID", "namaTipeAset deskripsi")
      .lean();

    if (!aset) throw createError(404, "Aset tidak ditemukan.");

    // 3. Simpan ke Cache Detail (Expire 600 detik)
    await redis.set(KEY_DETAIL(id), JSON.stringify(aset), "EX", 600);

    return aset;
  }

  // --- UPDATE ---
  async update(id, tenantID, payload) {
    // 1. Validasi Input
    const validation = validateAsetPayload(payload, true);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      // 2. Update dengan filter tenantID (Keamanan Kritis)
      const updated = await Aset.findOneAndUpdate(
        { _id: id, tenantID },
        { $set: validation.updates },
        { new: true, runValidators: true }
      ).lean();

      if (!updated)
        throw createError(404, "Aset tidak ditemukan atau akses ditolak.");

      // 3. Invalidate Cache
      await this.clearCache(id, tenantID);

      return updated;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  // --- DELETE ---
  async delete(id, tenantID) {
    // 1. Delete dengan filter tenantID murni dari token
    const deleted = await Aset.findOneAndDelete({ _id: id, tenantID });

    if (!deleted)
      throw createError(404, "Aset tidak ditemukan atau akses ditolak.");

    // 2. Clear Cache
    await this.clearCache(id, tenantID);

    return { message: "Aset berhasil dihapus" };
  }
}

module.exports = new AsetService();
