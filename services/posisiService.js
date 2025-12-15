const Posisi = require("../models/posisiModel");
const redis = require("../config/redis");
const { validatePosisiPayload } = require("../validators/posisiValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `posisi:tenant:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `posisi:detail:${id}`;

class PosisiService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);

    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const posisi = await Posisi.find({ tenantID })
      .populate("tenantID", "namaToko status")
      .sort({ namaPosisi: 1 })
      .lean();

    if (posisi.length > 0) {
      await redis.set(key, JSON.stringify(posisi), "EX", 3600);
    }

    return posisi;
  }

  async getById(id) {
    const key = CACHE_KEY_DETAIL(id);

    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const posisi = await Posisi.findById(id).populate("tenantID").lean();
    if (!posisi) return null;

    await redis.set(key, JSON.stringify(posisi), "EX", 3600);
    return posisi;
  }

  async create(payload) {
    const validation = validatePosisiPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const posisi = await Posisi.create(payload);

      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      return posisi;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Nama posisi sudah ada di tenant ini"] };
      }
      throw err;
    }
  }

  async update(id, payload) {
    const validation = validatePosisiPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    const allowedUpdates = ["namaPosisi", "deskripsi", "status"];
    const updates = {};
    Object.keys(payload).forEach((key) => {
      if (allowedUpdates.includes(key)) updates[key] = payload[key];
    });

    if (Object.keys(updates).length === 0) {
      return { error: ["Tidak ada data valid untuk diupdate"] };
    }

    try {
      const updated = await Posisi.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      }).lean();

      if (!updated) return null;

      await redis.del(CACHE_KEY_LIST(updated.tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      return updated;
    } catch (err) {
      if (err.code === 11000)
        return { error: ["Nama posisi sudah digunakan"] };
      throw err;
    }
  }

  async delete(id) {
    const target = await Posisi.findById(id).lean();
    if (!target) return null;

    await Posisi.deleteOne({ _id: id });

    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new PosisiService();