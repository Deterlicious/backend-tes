const JurnalTransfer = require("../models/jurnalTransferModel");
const redis = require("../config/redis");
const {
  validateJurnalTransferPayload,
} = require("../validators/jurnalTransferValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `jurnal_transfer:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `jurnal_transfer:detail:${id}`;

class JurnalTransferService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await JurnalTransfer.find({ tenantID })
      .populate("kasSumberID", "namaAkun nomorAkun")
      .populate("kasTujuanID", "namaAkun nomorAkun")
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

    const data = await JurnalTransfer.findById(id)
      .populate("kasSumberID", "namaAkun nomorAkun")
      .populate("kasTujuanID", "namaAkun nomorAkun")
      .populate("dicatatOleh", "nama")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 60);
    return data;
  }

  async create(payload) {
    const validation = validateJurnalTransferPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const jurnal = await JurnalTransfer.create(payload);

      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      return jurnal;
    } catch (err) {
      throw err;
    }
  }

  async update(id, payload) {
    const validation = validateJurnalTransferPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload.kasSumberID;
    delete payload.kasTujuanID;

    try {
      const updated = await JurnalTransfer.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
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
    const target = await JurnalTransfer.findById(id).lean();
    if (!target) return null;

    await JurnalTransfer.deleteOne({ _id: id });

    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new JurnalTransferService();