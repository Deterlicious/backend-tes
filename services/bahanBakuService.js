const BahanBaku = require("../models/bahanBakuModel");
const createError = require("http-errors");
const redis = require("../config/redis");
const { getAvailableUnits } = require("../utils/unitConverter");

class BahanBakuService {
  #KEY_LIST(tenantID) {
    return `bahanBaku:list:${tenantID}`;
  }
  #KEY_DETAIL(id) {
    return `bahanBaku:detail:${id}`;
  }

  async create(payload) {
    const data = await BahanBaku.create(payload);
    await redis.del(this.#KEY_LIST(payload.tenantID));
    return data;
  }

  async getAll(tenantID) {
    const cache = await redis.get(this.#KEY_LIST(tenantID));

    // Ambil data (dari cache atau DB)
    let data;
    if (cache) {
      data = JSON.parse(cache);
    } else {
      data = await BahanBaku.find({ tenantID }).sort({ createdAt: -1 });
      await redis.set(this.#KEY_LIST(tenantID), JSON.stringify(data), "EX", 3600);
    }

    // Enrich dengan availableUnits — dilakukan di luar cache agar selalu segar
    // dan tidak perlu invalidate cache ketika getAvailableUnits berubah.
    // Konsep: availableUnits adalah computed field, bukan data yang disimpan di DB.
    return data.map((bb) => ({
      ...(bb.toObject ? bb.toObject() : bb), // toObject() jika dari Mongoose, spread jika dari cache
      availableUnits: getAvailableUnits(bb.satuan),
    }));
  }

  async getById(id, tenantID) {
    const cache = await redis.get(this.#KEY_DETAIL(id));

    let data;
    if (cache) {
      data = JSON.parse(cache);
    } else {
      data = await BahanBaku.findOne({ _id: id, tenantID });
      if (!data) throw createError(404, "Bahan baku tidak ditemukan.");
      await redis.set(this.#KEY_DETAIL(id), JSON.stringify(data), "EX", 3600);
    }

    // Enrich dengan availableUnits
    return {
      ...(data.toObject ? data.toObject() : data),
      availableUnits: getAvailableUnits(data.satuan),
    };
  }

  async update(id, tenantID, payload) {
    const updated = await BahanBaku.findOneAndUpdate(
      { _id: id, tenantID },
      { $set: payload },
      { new: true, runValidators: true },
    );
    if (!updated) throw createError(404, "Bahan baku tidak ditemukan.");

    await redis.del(this.#KEY_LIST(tenantID));
    await redis.del(this.#KEY_DETAIL(id));
    return updated;
  }

  async delete(id, tenantID) {
    const deleted = await BahanBaku.findOneAndDelete({ _id: id, tenantID });
    if (!deleted) throw createError(404, "Bahan baku tidak ditemukan.");

    await redis.del(this.#KEY_LIST(tenantID));
    await redis.del(this.#KEY_DETAIL(id));
    return deleted;
  }
}

module.exports = new BahanBakuService();
