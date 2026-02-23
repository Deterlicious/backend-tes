const Inventory = require("../models/inventoryModel");
const createError = require("http-errors");
const redis = require("../config/redis");

class InventoryService {
  #KEY_LIST(tenantID) {
    return `inventory:list:${tenantID}`;
  }
  #KEY_DETAIL(id) {
    return `inventory:detail:${id}`;
  }

  async create(payload) {
    const data = await Inventory.create(payload);
    await redis.del(this.#KEY_LIST(payload.tenantID));
    return data;
  }

  async getAll(tenantID) {
    const cache = await redis.get(this.#KEY_LIST(tenantID));
    if (cache) return JSON.parse(cache);

    // Gunakan populate untuk menarik data Nama Bahan dan Nama Lokasi agar informatif
    const data = await Inventory.find({ tenantID })
      .populate("bahanBakuID", "namaBahan satuan")
      .populate("locationID", "nama tipe")
      .sort({ createdAt: -1 });

    await redis.set(this.#KEY_LIST(tenantID), JSON.stringify(data), "EX", 3600);
    return data;
  }

  async getById(id, tenantID) {
    const cache = await redis.get(this.#KEY_DETAIL(id));
    if (cache) return JSON.parse(cache);

    const data = await Inventory.findOne({ _id: id, tenantID })
      .populate("bahanBakuID", "namaBahan satuan")
      .populate("locationID", "nama tipe");

    if (!data) throw createError(404, "Data inventory tidak ditemukan.");

    await redis.set(this.#KEY_DETAIL(id), JSON.stringify(data), "EX", 3600);
    return data;
  }

  async update(id, tenantID, payload) {
    const updated = await Inventory.findOneAndUpdate(
      { _id: id, tenantID },
      { $set: payload },
      { new: true, runValidators: true },
    );
    if (!updated) throw createError(404, "Data inventory tidak ditemukan.");

    await redis.del(this.#KEY_LIST(tenantID));
    await redis.del(this.#KEY_DETAIL(id));
    return updated;
  }

  async delete(id, tenantID) {
    const deleted = await Inventory.findOneAndDelete({ _id: id, tenantID });
    if (!deleted) throw createError(404, "Data inventory tidak ditemukan.");

    await redis.del(this.#KEY_LIST(tenantID));
    await redis.del(this.#KEY_DETAIL(id));
    return deleted;
  }
}

module.exports = new InventoryService();
