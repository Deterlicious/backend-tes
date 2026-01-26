const IzinCuti = require("../models/izinCutiModel");
const redis = require("../config/redis");
const {
  validateIzinCutiPayload
} = require("../validators/izinCutiValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `izincuti:list:${tenantID}`;
const KEY_DETAIL = (id) => `izincuti:detail:${id}`;

class IzinCutiService {
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

    const data = await IzinCuti.find({
        tenantID
      })
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama")
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

    const data = await IzinCuti.findOne({
        _id: id,
        tenantID: requesterTenantID,
      })
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 300);
    return data;
  }

  async create(payload) {
    const validation = validateIzinCutiPayload(payload);
    if (!validation.valid) return {
      error: validation.errors
    };

    if (new Date(payload.tanggalSelesai) < new Date(payload.tanggalMulai)) {
      return {
        error: ["Tanggal selesai tidak boleh sebelum tanggal mulai"]
      };
    }

    try {
      const newIzinCuti = await IzinCuti.create(payload);
      await this.clearCache(payload.tenantID);

      return newIzinCuti;
    } catch (err) {
      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateIzinCutiPayload(payload, true);
    if (!validation.valid) return {
      error: validation.errors
    };

    delete payload.tenantID;
    delete payload.penggunaID;

    try {
      const oldIzin = await IzinCuti.findOne({
        _id: id,
        tenantID: requesterTenantID
      });
      if (!oldIzin) return null;

      const start = payload.tanggalMulai ? new Date(payload.tanggalMulai) : oldIzin.tanggalMulai;
      const end = payload.tanggalSelesai ? new Date(payload.tanggalSelesai) : oldIzin.tanggalSelesai;

      if (end < start) {
        return {
          error: ["Tanggal selesai tidak boleh sebelum tanggal mulai"]
        };
      }

      const updated = await IzinCuti.findOneAndUpdate({
          _id: id,
          tenantID: requesterTenantID,
        },
        payload, {
          new: true,
          runValidators: true,
        }
      ).populate("penggunaID", "nama").lean();

      await this.clearCache(requesterTenantID, id);

      return updated;
    } catch (err) {
      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const result = await IzinCuti.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) return null;

    await this.clearCache(requesterTenantID, id);

    return true;
  }
}

module.exports = new IzinCutiService();