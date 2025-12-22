const BebanOperasional = require("../models/bebanOperasionalModel");
const AkunKas = require("../models/akunKasModel");
const mongoose = require("mongoose");
const redis = require("../config/redis");
const createError = require("http-errors");
const {
  validateBebanPayload,
} = require("../validators/bebanOperasionalValidator");

// --- CACHE KEYS ---
const KEY_LIST = (tenantID) => `beban:list:${tenantID}`;
const KEY_DETAIL = (id) => `beban:detail:${id}`;

class BebanOperasionalService {
  // --- CACHE HELPER ---
  async clearCache(id, tenantID) {
    if (id) await redis.del(KEY_DETAIL(id));
    if (tenantID) await redis.del(KEY_LIST(tenantID));
  }

  // --- PRIVATE DB ERROR HANDLER (#) ---
  #handleDbError(error) {
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
    const validation = validateBebanPayload(payload, false);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      // 1. Update Saldo Akun Kas terlebih dahulu (Pengecekan akses & saldo)
      const updateKas = await AkunKas.findOneAndUpdate(
        { _id: payload.akunKasID, tenantID: payload.tenantID },
        { $inc: { saldo: -payload.jumlah } },
        { new: true }
      );

      if (!updateKas) {
        throw createError(400, "Akun Kas tidak ditemukan atau akses ditolak.");
      }

      // 2. Buat Dokumen Beban
      const newBeban = await BebanOperasional.create(payload);

      // 3. Invalidate Cache
      await this.clearCache(null, payload.tenantID);

      return newBeban;
    } catch (error) {
      throw createError.isHttpError(error) ? error : this.#handleDbError(error);
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID wajib disertakan.");

    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    const beban = await BebanOperasional.find({ tenantID })
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("kategoriBebanID", "namaKategori")
      .sort({ tanggal: -1, createdAt: -1 })
      .lean();

    if (beban.length === 0)
      throw createError(404, "Data beban tidak ditemukan.");

    await redis.set(KEY_LIST(tenantID), JSON.stringify(beban), "EX", 300);
    return beban;
  }

  // --- READ BY ID ---
  async getById(id, tenantID) {
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
      const data = JSON.parse(cached);
      if (data.tenantID.toString() !== tenantID.toString())
        throw createError(403, "Akses ditolak.");
      return data;
    }

    const beban = await BebanOperasional.findOne({ _id: id, tenantID })
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("kategoriBebanID", "namaKategori")
      .lean();

    if (!beban) throw createError(404, "Beban tidak ditemukan.");

    await redis.set(KEY_DETAIL(id), JSON.stringify(beban), "EX", 600);
    return beban;
  }

  // --- UPDATE ---
  async update(id, tenantID, payload) {
    const validation = validateBebanPayload(payload, true);

    // console.log("Payload Jumlah yang diterima:", payload.jumlah);
    // console.log("Tipe Data Jumlah:", typeof payload.jumlah);

    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      // 1. Ambil data lama untuk kalkulasi saldo
      const oldBeban = await BebanOperasional.findOne({ _id: id, tenantID });
      if (!oldBeban) throw createError(404, "Data tidak ditemukan.");

      // 2. Revert saldo lama
      await AkunKas.updateOne(
        { _id: oldBeban.akunKasID, tenantID },
        { $inc: { saldo: oldBeban.jumlah } }
      );

      // 3. Update data Beban
      const updated = await BebanOperasional.findOneAndUpdate(
        { _id: id, tenantID },
        { $set: validation.updates },
        { new: true, runValidators: true }
      ).lean();

      // 4. Terapkan saldo baru
      const newJumlah = payload.jumlah || oldBeban.jumlah;
      const newAkunID = payload.akunKasID || oldBeban.akunKasID;

      await AkunKas.updateOne(
        { _id: newAkunID, tenantID },
        { $inc: { saldo: -newJumlah } }
      );

      await this.clearCache(id, tenantID);
      return updated;
    } catch (error) {
      throw createError.isHttpError(error) ? error : this.#handleDbError(error);
    }
  }

  // --- DELETE ---
  async delete(id, tenantID) {
    try {
      const deleted = await BebanOperasional.findOneAndDelete({
        _id: id,
        tenantID,
      });
      if (!deleted) throw createError(404, "Data tidak ditemukan.");

      // Kembalikan saldo Akun Kas
      await AkunKas.updateOne(
        { _id: deleted.akunKasID, tenantID },
        { $inc: { saldo: deleted.jumlah } }
      );

      await this.clearCache(id, tenantID);
      return { message: "Beban Operasional berhasil dihapus" };
    } catch (error) {
      throw createError.isHttpError(error) ? error : this.#handleDbError(error);
    }
  }
}

module.exports = new BebanOperasionalService();
