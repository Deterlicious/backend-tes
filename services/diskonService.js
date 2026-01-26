const Diskon = require("../models/diskonModel");
const redis = require("../config/redis");
const {
  validateDiskonPayload
} = require("../validators/diskonValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `diskon:list:${tenantID}`;
const KEY_DETAIL = (id) => `diskon:detail:${id}`;

class DiskonService {
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

    const data = await Diskon.find({
        tenantID
      })
      .sort({
        status: -1,
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

    const data = await Diskon.findOne({
      _id: id,
      tenantID: requesterTenantID,
    }).lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 300);
    return data;
  }

  async create(payload) {
    const validation = validateDiskonPayload(payload);
    if (!validation.valid) return {
      error: validation.errors
    };

    try {
      const diskon = await Diskon.create(payload);
      await this.clearCache(payload.tenantID);

      return diskon;
    } catch (err) {
      if (err.code === 11000) {
        throw createError(400, "Nama diskon sudah digunakan di tenant ini");
      }
      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateDiskonPayload(payload, true);
    if (!validation.valid) return {
      error: validation.errors
    };

    delete payload.tenantID;

    try {
      const updated = await Diskon.findOneAndUpdate({
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
      if (err.code === 11000) {
        throw createError(400, "Nama diskon sudah digunakan di tenant ini");
      }
      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const result = await Diskon.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) return null;

    await this.clearCache(requesterTenantID, id);

    return true;
  }
}

module.exports = new DiskonService();