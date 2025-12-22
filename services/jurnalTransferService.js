const JurnalTransfer = require("../models/jurnalTransferModel");
const redis = require("../config/redis");
const { validateJurnalTransferPayload } = require("../validators/jurnalTransferValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `jurnal_transfer:list:${tenantID}`;
const KEY_DETAIL = (id) => `jurnal_transfer:detail:${id}`;

class JurnalTransferService {
  async clearCache(tenantID, id) {
    await redis.del(KEY_LIST(tenantID));
    if (id) await redis.del(KEY_DETAIL(id));
  }

  async getAll(tenantID) {
    const key = KEY_LIST(tenantID);
    const cached = await redis.get(key);

    if (cached) return JSON.parse(cached);

    const data = await JurnalTransfer.find({ tenantID })
      .populate("kasSumberID", "namaAkun nomorAkun")
      .populate("kasTujuanID", "namaAkun nomorAkun")
      .populate("dicatatOleh", "nama")
      .sort({ tanggal: -1, createdAt: -1 })
      .lean();

    if (data.length > 0) {
      await redis.set(key, JSON.stringify(data), "EX", 300);
    }

    return data;
  }

  async getById(id, requesterTenantID) {
    const key = KEY_DETAIL(id);
    const cached = await redis.get(key);

    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.tenantID !== requesterTenantID.toString()) return null;
      return parsed;
    }

    const data = await JurnalTransfer.findOne({ _id: id, tenantID: requesterTenantID })
      .populate("kasSumberID", "namaAkun nomorAkun")
      .populate("kasTujuanID", "namaAkun nomorAkun")
      .populate("dicatatOleh", "nama")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 300);
    return data;
  }

  async create(payload) {
    const validation = validateJurnalTransferPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    const jurnal = await JurnalTransfer.create(payload);
    await this.clearCache(payload.tenantID);

    return jurnal;
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateJurnalTransferPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload.kasSumberID;
    delete payload.kasTujuanID;
    delete payload.dicatatOleh;

    const updated = await JurnalTransfer.findOneAndUpdate(
      { _id: id, tenantID: requesterTenantID },
      payload,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return null;

    await this.clearCache(requesterTenantID, id);
    return updated;
  }

  async delete(id, requesterTenantID) {
    const result = await JurnalTransfer.deleteOne({ _id: id, tenantID: requesterTenantID });
    if (result.deletedCount === 0) return null;

    await this.clearCache(requesterTenantID, id);
    return true;
  }
}

module.exports = new JurnalTransferService();