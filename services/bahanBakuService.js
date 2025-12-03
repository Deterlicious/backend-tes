const BahanBaku = require("../models/bahanBakuModel");
const redis = require("../config/redis");
const {
  validateBahanBakuPayload,
} = require("../validators/bahanBakuValidator");
const createError = require("http-errors");

// CACHE KEYS
const CACHE_KEY_LIST = (tenantID) => `bahanbaku:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `bahanbaku:detail:${id}`;

class BahanBakuService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);

    // Cek Cache
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    // DB Query
    const bahan = await BahanBaku.find({ tenantID })
      .sort({ namaBahan: 1 })
      .lean();

    // Set Cache (TTL 60s)
    if (bahan.length > 0) {
      await redis.set(key, JSON.stringify(bahan), "EX", 60);
    }

    return bahan;
  }

  async getById(id) {
    const key = CACHE_KEY_DETAIL(id);

    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const bahan = await BahanBaku.findById(id).lean();
    if (!bahan) return null;

    await redis.set(key, JSON.stringify(bahan), "EX", 60);
    return bahan;
  }

  async create(payload) {
    const validation = validateBahanBakuPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const bahan = await BahanBaku.create(payload);

      // Invalidate Cache
      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      // TRIGGER SINKRONISASI (Lazy Import)
      const produkService = require("./produkService");
      await produkService.syncStockByBahan(bahan._id, payload.tenantID);

      return bahan;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Nama bahan baku sudah ada di tenant ini"] };
      }
      throw err;
    }
  }

  async update(id, payload) {
    const validation = validateBahanBakuPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID; // Security

    try {
      const updated = await BahanBaku.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      }).lean();

      if (!updated) return null;

      // Invalidate Cache
      await redis.del(CACHE_KEY_LIST(updated.tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      // TRIGGER SINKRONISASI (Lazy Import)
      const produkService = require("./produkService");
      await produkService.syncStockByBahan(id, updated.tenantID);

      return updated;
    } catch (err) {
      if (err.code === 11000)
        return { error: ["Nama bahan baku sudah digunakan"] };
      throw err;
    }
  }

  async delete(id) {
    const target = await BahanBaku.findById(id).lean();
    if (!target) return null;

    await BahanBaku.deleteOne({ _id: id });

    // Cleanup Cache
    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new BahanBakuService();
