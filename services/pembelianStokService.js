const PembelianStok = require("../models/pembelianStokModel");
const redis = require("../config/redis");
const { validatePembelianPayload } = require("../validators/pembelianStokValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `pembelian:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `pembelian:detail:${id}`;

class PembelianStokService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await PembelianStok.find({ tenantID })
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("items.bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama")
      .sort({ tanggal: -1, createdAt: -1 })
      .lean();

    if (data.length > 0) {
      await redis.set(key, JSON.stringify(data), "EX", 60);
    }
    return data;
  }

  async getById(id) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await PembelianStok.findById(id)
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("items.bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 60);
    return data;
  }

  async create(payload) {
    const validation = validatePembelianPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const pembelian = await PembelianStok.create(payload);

      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      return pembelian;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Nomor Faktur sudah digunakan di tenant ini"] };
      }
      throw err;
    }
  }

  async update(id, payload) {
    const validation = validatePembelianPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload.createdAt;

    try {
      const updated = await PembelianStok.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
        context: "query",
      }).lean();

      if (!updated) return null;

      await redis.del(CACHE_KEY_LIST(updated.tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      return updated;
    } catch (err) {
      if (err.code === 11000) return { error: ["Nomor Faktur duplikat"] };
      throw err;
    }
  }

  async delete(id) {
    const target = await PembelianStok.findById(id).lean();
    if (!target) return null;

    await PembelianStok.deleteOne({ _id: id });

    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new PembelianStokService();