const Kategori = require("../models/kategoriModel");
const redis = require("../config/redis");
const { validateKategoriPayload } = require("../validators/kategoriValidator");
const createError = require("http-errors");

// CACHE KEYS
const CACHE_KEY_LIST = (tenantID) => `kategori:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `kategori:detail:${id}`;

class KategoriService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);

    // Cek Cache
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    // Ambil dari DB
    const categories = await Kategori.find({ tenantID })
      .populate("tenantID", "namaToko")
      .sort({ createdAt: -1 })
      .lean();

    // Simpan Cache (60 detik)
    if (categories.length > 0) {
      await redis.set(key, JSON.stringify(categories), "EX", 60);
    }

    return categories;
  }

  async getById(id) {
    const key = CACHE_KEY_DETAIL(id);

    // Cek Cache
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    // DB
    const kategori = await Kategori.findById(id)
      .populate("tenantID", "namaToko")
      .lean();
    
    if (!kategori) return null;

    // Cache
    await redis.set(key, JSON.stringify(kategori), "EX", 60);

    return kategori;
  }

  async create(payload) {
    // Validasi
    const validation = validateKategoriPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      // Create DB
      const kategori = await Kategori.create(payload);

      // Invalidate Cache List Tenant ini
      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      return kategori;
    } catch (err) {
      // Handle Duplicate Entry
      if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return { error: [`${field} sudah digunakan di tenant ini`] };
      }
      throw err;
    }
  }

  async update(id, payload) {
    // Validasi
    const validation = validateKategoriPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    // Security: Jangan biarkan tenantID diubah saat update
    delete payload.tenantID;

    try {
      // Update DB
      const updated = await Kategori.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      }).lean();

      if (!updated) return null;

      // Invalidate Cache (List Tenant & Detail ID)
      await redis.del(CACHE_KEY_LIST(updated.tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      return updated;
    } catch (err) {
      if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return { error: [`${field} sudah digunakan di tenant ini`] };
      }
      throw err;
    }
  }

  async delete(id) {
    const target = await Kategori.findById(id).lean();
    if (!target) return null;

    await Kategori.deleteOne({ _id: id });

    // Cleanup Cache
    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new KategoriService();