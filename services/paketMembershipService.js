const PaketMembership = require("../models/paketMembershipModel");
const redis = require("../config/redis");
const {
  validatePaketMembershipPayload
} = require("../validators/paketMembershipValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `paket:list:${tenantID}`;
const KEY_DETAIL = (id) => `paket:detail:${id}`;

class PaketMembershipService {
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

    const data = await PaketMembership.find({
        tenantID
      })
      .sort({
        harga: 1
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

    const data = await PaketMembership.findOne({
      _id: id,
      tenantID: requesterTenantID,
    }).lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 300);
    return data;
  }

  async create(payload) {
    const validation = validatePaketMembershipPayload(payload);
    if (!validation.valid) return {
      error: validation.errors
    };

    try {
      const paket = await PaketMembership.create(payload);
      await this.clearCache(payload.tenantID);

      return paket;
    } catch (err) {
      if (err.code === 11000) {
        throw createError(400, "Nama paket sudah terdaftar di tenant ini");
      }
      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validatePaketMembershipPayload(payload, true);
    if (!validation.valid) return {
      error: validation.errors
    };

    delete payload.tenantID;

    try {
      const updated = await PaketMembership.findOneAndUpdate({
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
        throw createError(400, "Nama paket sudah terdaftar di tenant ini");
      }
      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const result = await PaketMembership.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) return null;

    await this.clearCache(requesterTenantID, id);

    return true;
  }
}

module.exports = new PaketMembershipService();