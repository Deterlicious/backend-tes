const BarangInventory = require("../models/barangInventoryModel");
const createError = require("http-errors");
const redis = require("../config/redis");

class BarangInventoryService {
  #KEY_LIST(tenantID) {
    return `barangInventory:list:${tenantID}`;
  }

  #KEY_DETAIL(id) {
    return `barangInventory:detail:${id}`;
  }

  async create(payload) {
    const data = await BarangInventory.create(payload);
    await redis.del(this.#KEY_LIST(payload.tenantID));
    return data;
  }

  async getAll(tenantID) {
    const cache = await redis.get(this.#KEY_LIST(tenantID));
    if (cache) return JSON.parse(cache);

    const data = await BarangInventory.find({ tenantID }).sort({
      createdAt: -1,
    });
    await redis.set(this.#KEY_LIST(tenantID), JSON.stringify(data), "EX", 3600);
    return data;
  }

  async getById(id, tenantID) {
    const cache = await redis.get(this.#KEY_DETAIL(id));
    if (cache) return JSON.parse(cache);

    const data = await BarangInventory.findOne({ _id: id, tenantID });
    if (!data) throw createError(404, "Barang inventory tidak ditemukan.");

    await redis.set(this.#KEY_DETAIL(id), JSON.stringify(data), "EX", 3600);
    return data;
  }

  async update(id, tenantID, payload) {
    const updated = await BarangInventory.findOneAndUpdate(
      { _id: id, tenantID },
      { $set: payload },
      { new: true, runValidators: true },
    );
    if (!updated) throw createError(404, "Barang inventory tidak ditemukan.");

    await redis.del(this.#KEY_LIST(tenantID));
    await redis.del(this.#KEY_DETAIL(id));
    return updated;
  }

  async delete(id, tenantID) {
    const deleted = await BarangInventory.findOneAndDelete({
      _id: id,
      tenantID,
    });
    if (!deleted) throw createError(404, "Barang inventory tidak ditemukan.");

    await redis.del(this.#KEY_LIST(tenantID));
    await redis.del(this.#KEY_DETAIL(id));
    return deleted;
  }
}

module.exports = new BarangInventoryService();
