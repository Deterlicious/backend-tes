const TipeAset = require("../models/tipeAsetModel");
const redis = require("../config/redis"); // Pastikan path config redis benar
const { validateTipeAsetPayload } = require("../validators/tipeAsetValidator");
const createError = require("http-errors");

// CACHE KEYS
const KEY_LIST = (tenantID) => `tipeAset:list:${tenantID}`;
const KEY_DETAIL = (tenantID, id) => `tipeAset:detail:${tenantID}:${id}`;

class TipeAsetService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID required");

    const key = KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await TipeAset.find({ tenantID })
      // panggil field virtual tadi
      .populate("listTarif", "namaTarif harga durasiMinimum")
      .sort({ namaTipeAset: 1 })
      .lean({ virtuals: true }); // Pastikan virtuals true saat lean

    if (data.length > 0) {
      await redis.set(key, JSON.stringify(data), "EX", 60);
    }

    return data;
  }

  async getById(id, tenantID) {
    const key = KEY_DETAIL(tenantID, id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await TipeAset.findOne({ _id: id, tenantID })
      .populate("listTarif", "namaTarif harga durasiMinimum")
      .lean({ virtuals: true });

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 60);
    return data;
  }

  async create(payload) {
    const validation = validateTipeAsetPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const newTipeAset = await TipeAset.create(payload);

      await redis.del(KEY_LIST(payload.tenantID));

      return newTipeAset;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Nama Tipe Aset sudah ada di tenant ini"] };
      }
      throw err;
    }
  }

  async update(id, tenantID, payload) {
    const validation = validateTipeAsetPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID; // Security

    try {
      const updated = await TipeAset.findOneAndUpdate(
        { _id: id, tenantID },
        payload,
        { new: true, runValidators: true }
      ).lean();

      if (!updated) return null;

      await redis.del(KEY_LIST(tenantID));
      await redis.del(KEY_DETAIL(tenantID, id));

      return updated;
    } catch (err) {
      if (err.code === 11000) return { error: ["Nama Tipe Aset conflict"] };
      throw err;
    }
  }

  async delete(id, tenantID) {
    const deleted = await TipeAset.findOneAndDelete({ _id: id, tenantID });
    if (!deleted) return null;

    await redis.del(KEY_LIST(tenantID));
    await redis.del(KEY_DETAIL(tenantID, id));

    return true;
  }
}

module.exports = new TipeAsetService();
