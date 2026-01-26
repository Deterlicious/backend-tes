const Absensi = require("../models/absensiModel");
const redis = require("../config/redis");
const {
  validateAbsensiPayload
} = require("../validators/absensiValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `absensi:list:${tenantID}`;
const KEY_DETAIL = (id) => `absensi:detail:${id}`;

class AbsensiService {
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

    const data = await Absensi.find({
        tenantID
      })
      .populate("penggunaID", "nama email")
      .sort({
        tanggal: -1,
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

    const data = await Absensi.findOne({
        _id: id,
        tenantID: requesterTenantID,
      })
      .populate("penggunaID", "nama email")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 300);
    return data;
  }

  async create(payload) {
    const validation = validateAbsensiPayload(payload);
    if (!validation.valid) return {
      error: validation.errors
    };

    if (new Date(payload.waktuPulang) <= new Date(payload.waktuMasuk)) {
      return {
        error: ["Waktu pulang harus setelah waktu masuk."]
      };
    }

    try {
      const absensi = await Absensi.create(payload);
      await this.clearCache(payload.tenantID);

      return absensi;
    } catch (err) {
      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateAbsensiPayload(payload, true);
    if (!validation.valid) return {
      error: validation.errors
    };

    delete payload.tenantID;
    delete payload.penggunaID;

    try {
      const updated = await Absensi.findOneAndUpdate({
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
    const result = await Absensi.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) return null;

    await this.clearCache(requesterTenantID, id);

    return true;
  }
}

module.exports = new AbsensiService();