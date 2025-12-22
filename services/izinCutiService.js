const IzinCuti = require("../models/izinCutiModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const redis = require("../config/redis"); // Menggunakan config redis standar
const { validateIzinCutiPayload } = require("../validators/izinCutiValidator");

// --- CACHE KEYS (Sesuai Standar AkunService) ---
const KEY_LIST = (tenantID) => `izincuti:list:${tenantID}`;
const KEY_DETAIL = (id) => `izincuti:detail:${id}`;

class IzinCutiService {
  // --- CACHE HELPER ---
  async clearCache(id, tenantID) {
    if (id) await redis.del(KEY_DETAIL(id));
    if (tenantID) await redis.del(KEY_LIST(tenantID));
  }

  // --- PRIVATE DB ERROR HANDLER (#) ---
  #handleDbError(error) {
    if (error.name === "ValidationError") {
      // Mengambil pesan error pertama dari Mongoose validation
      return createError(400, Object.values(error.errors)[0].message);
    }
    if (error.name === "CastError") {
      return createError(400, "Format ID tidak valid.");
    }
    return createError(500, error.message || "Kesalahan Database.");
  }

  // --- CREATE ---
  async create(payload) {
    const validation = validateIzinCutiPayload(payload, false);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      const newIzinCuti = await IzinCuti.create(payload);

      // Invalidate cache list agar data baru muncul
      await this.clearCache(null, payload.tenantID);

      return newIzinCuti;
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

    // 2. Query DB dengan populate sesuai kebutuhan UI
    const data = await IzinCuti.find({ tenantID })
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama")
      .sort({ createdAt: -1 })
      .lean(); // Performa lebih cepat

    if (data.length === 0)
      throw createError(404, "Data izin/cuti tidak ditemukan.");

    // 3. Simpan ke Cache (Expire 5 menit/300 detik)
    await redis.set(KEY_LIST(tenantID), JSON.stringify(data), "EX", 300);
    return data;
  }

  // --- READ BY ID ---
  async getById(id, tenantID) {
    // 1. Cek Cache Detail
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
      const data = JSON.parse(cached);
      // Validasi kepemilikan data di tingkat cache (Keamanan Berlapis)
      if (data.tenantID.toString() !== tenantID.toString())
        throw createError(403, "Akses ditolak.");
      return data;
    }

    // 2. Query DB
    const izinCuti = await IzinCuti.findOne({ _id: id, tenantID })
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama")
      .lean();

    if (!izinCuti)
      throw createError(404, "Data tidak ditemukan atau akses ditolak.");

    // 3. Set Cache Detail
    await redis.set(KEY_DETAIL(id), JSON.stringify(izinCuti), "EX", 600);
    return izinCuti;
  }

  // --- UPDATE ---
  async update(id, tenantID, payload) {
    const validation = validateIzinCutiPayload(payload, true);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      const updates = validation.updates;

      // Ambil data lama untuk validasi logika tanggal
      const oldIzin = await IzinCuti.findOne({ _id: id, tenantID });
      if (!oldIzin) throw createError(404, "Data tidak ditemukan.");

      const newStart = updates.tanggalMulai || oldIzin.tanggalMulai;
      const newEnd = updates.tanggalSelesai || oldIzin.tanggalSelesai;

      if (new Date(newEnd) < new Date(newStart)) {
        throw createError(
          400,
          "Tanggal selesai tidak boleh sebelum tanggal mulai."
        );
      }

      const updated = await IzinCuti.findOneAndUpdate(
        { _id: id, tenantID },
        { $set: updates },
        { new: true, runValidators: true }
      )
        .populate("penggunaID", "nama")
        .lean();

      if (!updated) throw createError(404, "Gagal memperbarui data.");

      // Bersihkan Cache
      await this.clearCache(id, tenantID);

      return updated;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.#handleDbError(error);
    }
  }

  // --- DELETE ---
  async delete(id, tenantID) {
    try {
      const deleted = await IzinCuti.findOneAndDelete({ _id: id, tenantID });
      if (!deleted) throw createError(404, "Data tidak ditemukan.");

      // Bersihkan Cache
      await this.clearCache(id, tenantID);

      return { message: "Data izin/cuti berhasil dihapus" };
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }
}

module.exports = new IzinCutiService();
