const Aset = require("../models/asetModel");
const redis = require("../config/redis");
const {
  validateAsetPayload
} = require("../validators/asetValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `aset:list:${tenantID}`;
const KEY_DETAIL = (id) => `aset:detail:${id}`;

class AsetService {
  async clearCache(tenantID, id) {
    const keys = [KEY_LIST(tenantID)];
    if (id) keys.push(KEY_DETAIL(id));

    await redis.del(keys);
  }

  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID required");

    const key = KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await Aset.find({
        tenantID
      })
      .populate("tipeAsetID", "namaTipeAset deskripsi")
      .sort({
        createdAt: -1
      })
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

    const data = await Aset.findOne({
        _id: id,
        tenantID: requesterTenantID,
      })
      .populate("tipeAsetID", "namaTipeAset deskripsi")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 300);
    return data;
  }

  async create(payload) {
    const validation = validateAsetPayload(payload);
    if (!validation.valid) return {
      error: validation.errors
    };

    try {
      const aset = await Aset.create(payload);
      await this.clearCache(payload.tenantID);

      return aset;
    } catch (err) {
      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateAsetPayload(payload, true);
    if (!validation.valid) return {
      error: validation.errors
    };

    delete payload.tenantID;

    try {
      const updated = await Aset.findOneAndUpdate({
        _id: id,
        tenantID: requesterTenantID,
      }, payload, {
        new: true,
        runValidators: true,
      }).lean();

      if (!updated) return null;

      await this.clearCache(requesterTenantID, id);

      return updated;
    } catch (err) {
      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const result = await Aset.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) return null;

    await this.clearCache(requesterTenantID, id);

    return true;
  }
}

module.exports = new AsetService();