const KategoriBeban = require("../models/kategoriBebanModel");
const redis = require("../config/redis");
const { validateKategoriPayload } = require("../validators/kategoriBebanValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `kategori_beban:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `kategori_beban:detail:${id}`;

class KategoriBebanService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await KategoriBeban.find({ tenantID })
      .sort({ namaKategori: 1 })
      .lean();

    if (data.length > 0) {
      await redis.set(key, JSON.stringify(data), "EX", 3600);
    }
    return data;
  }

  async getById(id) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await KategoriBeban.findById(id).lean();
    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 3600);
    return data;
  }

  async create(payload) {
    const validation = validateKategoriPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const result = await KategoriBeban.create(payload);

      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      return result;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Nama kategori beban sudah ada di tenant ini"] };
      }
      throw err;
    }
  }

  async update(id, payload) {
    const validation = validateKategoriPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    const updates = {};
    if (payload.namaKategori) updates.namaKategori = payload.namaKategori;

    if (Object.keys(updates).length === 0) {
      return { error: ["Tidak ada data valid untuk diupdate"] };
    }

    try {
      const updated = await KategoriBeban.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      }).lean();

      if (!updated) return null;

      await redis.del(CACHE_KEY_LIST(updated.tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      return updated;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Nama kategori beban sudah digunakan"] };
      }
      throw err;
    }
  }

  async delete(id) {
    const target = await KategoriBeban.findById(id).lean();
    if (!target) return null;

    await KategoriBeban.deleteOne({ _id: id });

    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new KategoriBebanService();