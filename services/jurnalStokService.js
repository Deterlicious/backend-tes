const JurnalStok = require("../models/jurnalStokModel");
const Inventory = require("../models/inventoryModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const redis = require("../config/redis");
const { validateJurnalPayload } = require("../validators/jurnalStokValidator");

// --- CACHE KEYS ---
const KEY_LIST = (tenantID) => `jurnalstok:list:${tenantID}`;
const KEY_DETAIL = (id) => `jurnalstok:detail:${id}`;

class JurnalStokService {
  // --- PRIVATE HELPERS (#) ---
  #getStokOperation(tipe) {
    const ops = { masuk: 1, keluar: -1, penyesuaian: 1 };
    return ops[tipe] || 0;
  }

  #handleDbError(error) {
    if (error.name === "ValidationError") {
      return createError(400, Object.values(error.errors)[0].message);
    }
    if (error.name === "CastError") {
      return createError(400, "Format ID tidak valid.");
    }
    return createError(500, error.message || "Kesalahan Database.");
  }

  async #clearCache(id, tenantID) {
    if (id) await redis.del(KEY_DETAIL(id));
    if (tenantID) await redis.del(KEY_LIST(tenantID));
  }

  // --- CREATE ---
  async create(payload) {
    const validation = validateJurnalPayload(payload, false);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      const { bahanBakuID, locationID, tenantID, tipe, jumlah } = payload;

      // 1. Simpan Jurnal
      const jurnalStok = await JurnalStok.create(payload);

      // 2. Update Stok secara Atomik menggunakan $inc
      const amount = this.#getStokOperation(tipe) * jumlah;

      await Inventory.findOneAndUpdate(
        { bahanBakuID, locationID, tenantID },
        { $inc: { stok: amount } },
        { upsert: true, new: true } // Upsert: buat baru jika belum ada
      );

      await this.#clearCache(null, tenantID);
      return jurnalStok;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID wajib ada.");

    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    const data = await JurnalStok.find({ tenantID })
      .populate("bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama")
      .sort({ tanggal: -1, createdAt: -1 })
      .lean();

    if (data.length === 0)
      throw createError(404, "Data jurnal stok tidak ditemukan.");

    await redis.set(KEY_LIST(tenantID), JSON.stringify(data), "EX", 300);
    return data;
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

    const jurnalStok = await JurnalStok.findOne({ _id: id, tenantID })
      .populate("bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama")
      .lean();

    if (!jurnalStok) throw createError(404, "Jurnal stok tidak ditemukan.");

    await redis.set(KEY_DETAIL(id), JSON.stringify(jurnalStok), "EX", 600);
    return jurnalStok;
  }

  // --- UPDATE ---
  async update(id, tenantID, payload) {
    const validation = validateJurnalPayload(payload, true);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      const updates = validation.updates;
      const oldJurnal = await JurnalStok.findOne({ _id: id, tenantID });
      if (!oldJurnal) throw createError(404, "Jurnal tidak ditemukan.");

      // Hitung selisih stok (Delta)
      const oldAmount =
        this.#getStokOperation(oldJurnal.tipe) * oldJurnal.jumlah;
      const newAmount =
        this.#getStokOperation(oldJurnal.tipe) *
        (updates.jumlah || oldJurnal.jumlah);
      const diffAmount = newAmount - oldAmount;

      const updated = await JurnalStok.findOneAndUpdate(
        { _id: id, tenantID },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();

      // Terapkan selisih ke Inventory
      if (diffAmount !== 0) {
        await Inventory.updateOne(
          {
            bahanBakuID: updated.bahanBakuID,
            locationID: updated.locationID,
            tenantID,
          },
          { $inc: { stok: diffAmount } }
        );
      }

      await this.#clearCache(id, tenantID);
      return updated;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.#handleDbError(error);
    }
  }

  // --- DELETE ---
  async delete(id, tenantID) {
    try {
      const deleted = await JurnalStok.findOneAndDelete({ _id: id, tenantID });
      if (!deleted) throw createError(404, "Jurnal tidak ditemukan.");

      // Kembalikan stok (Reverse)
      const reverseAmount = -(
        this.#getStokOperation(deleted.tipe) * deleted.jumlah
      );

      await Inventory.updateOne(
        {
          bahanBakuID: deleted.bahanBakuID,
          locationID: deleted.locationID,
          tenantID,
        },
        { $inc: { stok: reverseAmount } }
      );

      await this.#clearCache(id, tenantID);
      return { message: "Jurnal Stok berhasil dihapus" };
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }
}

module.exports = new JurnalStokService();
