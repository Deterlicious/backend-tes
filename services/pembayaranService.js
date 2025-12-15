const Pembayaran = require("../models/pembayaranModel");
const redis = require("../config/redis");
const { validatePembayaranPayload } = require("../validators/pembayaranValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `pembayaran:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `pembayaran:detail:${id}`;

class PembayaranService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await Pembayaran.find({ tenantID })
      .populate("penjualanID", "nomorFaktur totalBayar")
      .populate("akunKasID", "namaAkun nomorAkun")
      .sort({ paymentTimestamp: -1, createdAt: -1 })
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

    const data = await Pembayaran.findById(id)
      .populate("penjualanID", "nomorFaktur totalBayar")
      .populate("akunKasID", "namaAkun nomorAkun")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 60);
    return data;
  }

  async create(payload) {
    const validation = validatePembayaranPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const pembayaran = await Pembayaran.create(payload);

      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      return pembayaran;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Pembayaran untuk ID Penjualan ini sudah ada."] };
      }
      throw err;
    }
  }

  async update(id, payload) {
    const validation = validatePembayaranPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload.penjualanID;
    delete payload.createdAt;

    try {
      const updated = await Pembayaran.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
        context: "query",
      }).lean();

      if (!updated) return null;

      await redis.del(CACHE_KEY_LIST(updated.tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      return updated;
    } catch (err) {
      throw err;
    }
  }

  async delete(id) {
    const target = await Pembayaran.findById(id).lean();
    if (!target) return null;

    await Pembayaran.deleteOne({ _id: id });

    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new PembayaranService();