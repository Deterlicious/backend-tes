const KategoriBeban = require("../models/kategoriBebanModel");
const redis = require("../config/redis");
const {
  validateKategoriPayload
} = require("../validators/kategoriBebanValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `kategori_beban:list:${tenantID}`;
const KEY_DETAIL = (id) => `kategori_beban:detail:${id}`;

class KategoriBebanService {
  async clearCache(tenantID, id) {
    const keys = [KEY_LIST(tenantID)];
    if (id) keys.push(KEY_DETAIL(id));
    await redis.del(keys);
  }

  async getAll(tenantID) {
    const key = KEY_LIST(tenantID);
    const cached = await redis.get(key);

    if (cached) return JSON.parse(cached);

    const data = await KategoriBeban.find({
        tenantID
      })
      .sort({
        namaKategori: 1
      })
      .lean();

    if (data.length > 0) {
      await redis.set(key, JSON.stringify(data), "EX", 3600);
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

    const data = await KategoriBeban.findOne({
      _id: id,
      tenantID: requesterTenantID
    }).lean();
    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 3600);
    return data;
  }

  async create(payload) {
    const validation = validateKategoriPayload(payload);
    if (!validation.valid) return {
      error: validation.errors
    };

    try {
      const result = await KategoriBeban.create(payload);
      await this.clearCache(payload.tenantID);
      return result;
    } catch (err) {
      if (err.code === 11000) return {
        error: ["Nama kategori sudah ada di tenant ini"]
      };
      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateKategoriPayload(payload, true);
    if (!validation.valid) return {
      error: validation.errors
    };

    delete payload.tenantID;

    try {
      const updated = await KategoriBeban.findOneAndUpdate({
        _id: id,
        tenantID: requesterTenantID
      }, {
        $set: payload
      }, {
        new: true,
        runValidators: true
      }).lean();

      if (!updated) return null;

      await this.clearCache(requesterTenantID, id);
      return updated;
    } catch (err) {
      if (err.code === 11000) return {
        error: ["Nama kategori sudah digunakan"]
      };
      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const result = await KategoriBeban.deleteOne({
      _id: id,
      tenantID: requesterTenantID
    });
    if (result.deletedCount === 0) return null;

    await this.clearCache(requesterTenantID, id);
    return true;
  }
}

module.exports = new KategoriBebanService();