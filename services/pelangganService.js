const Pelanggan = require("../models/pelangganModel");
const redis = require("../config/redis");
const { validatePelangganPayload } = require("../validators/pelangganValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `pelanggan:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `pelanggan:detail:${id}`;

class PelangganService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const pelanggan = await Pelanggan.find({ tenantID })
      .sort({ namaPelanggan: 1 })
      .lean();

    if (pelanggan.length > 0) {
      await redis.set(key, JSON.stringify(pelanggan), "EX", 60);
    }

    return pelanggan;
  }

  async getById(id) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const pelanggan = await Pelanggan.findById(id).lean();
    if (!pelanggan) return null;

    await redis.set(key, JSON.stringify(pelanggan), "EX", 60);
    return pelanggan;
  }

  async create(payload) {
    const validation = validatePelangganPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const pelanggan = await Pelanggan.create(payload);
      await redis.del(CACHE_KEY_LIST(payload.tenantID));
      return pelanggan;
    } catch (err) {
      return this._handleDbError(err);
    }
  }

  async update(id, payload) {
    const validation = validatePelangganPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload._id;

    try {
      const updated = await Pelanggan.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      }).lean();

      if (!updated) return null;

      await redis.del(CACHE_KEY_LIST(updated.tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      return updated;
    } catch (err) {
      return this._handleDbError(err);
    }
  }

  async delete(id) {
    const target = await Pelanggan.findById(id).lean();
    if (!target) return null;

    await Pelanggan.deleteOne({ _id: id });
    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));
    return true;
  }

  _handleDbError(err) {
    if (err.code === 11000) {
      const fields = err.keyValue;

      if (fields.namaPelanggan) {
        return {
          error: [`Nama pelanggan '${fields.namaPelanggan}' sudah terdaftar.`]
        };
      }
      if (fields.nomorHp) {
        return {
          error: [`Nomor HP '${fields.nomorHp}' sudah digunakan oleh pelanggan lain.`]
        };
      }
      if (fields.email) {
        return {
          error: [`Email '${fields.email}' sudah digunakan oleh pelanggan lain.`]
        };
      }

      return { error: ["Data duplikat terdeteksi."] };
    }
    throw err;
  }
}

module.exports = new PelangganService();