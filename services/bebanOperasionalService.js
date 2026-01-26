const BebanOperasional = require("../models/bebanOperasionalModel");
const AkunKas = require("../models/akunKasModel");
const redis = require("../config/redis");
const createError = require("http-errors");
const {
  validateBebanPayload
} = require("../validators/bebanOperasionalValidator");

const KEY_LIST = (tenantID) => `beban:list:${tenantID}`;
const KEY_DETAIL = (id) => `beban:detail:${id}`;

class BebanOperasionalService {
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

    const data = await BebanOperasional.find({
        tenantID
      })
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("kategoriBebanID", "namaKategori")
      .populate("dicatatOleh", "nama")
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

    const data = await BebanOperasional.findOne({
        _id: id,
        tenantID: requesterTenantID,
      })
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("kategoriBebanID", "namaKategori")
      .populate("dicatatOleh", "nama")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 300);
    return data;
  }

  async create(payload) {
    const validation = validateBebanPayload(payload);
    if (!validation.valid) return {
      error: validation.errors
    };

    try {
      const updateKas = await AkunKas.findOneAndUpdate({
        _id: payload.akunKasID,
        tenantID: payload.tenantID
      }, {
        $inc: {
          saldo: -payload.jumlah
        }
      }, {
        new: true
      });

      if (!updateKas) {
        throw createError(400, "Akun Kas tidak ditemukan atau saldo tidak cukup");
      }

      const beban = await BebanOperasional.create(payload);
      await this.clearCache(payload.tenantID);

      return beban;
    } catch (err) {
      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateBebanPayload(payload, true);
    if (!validation.valid) return {
      error: validation.errors
    };

    delete payload.tenantID;
    delete payload.dicatatOleh;

    try {
      const oldBeban = await BebanOperasional.findOne({
        _id: id,
        tenantID: requesterTenantID
      });
      if (!oldBeban) return null;

      await AkunKas.updateOne({
        _id: oldBeban.akunKasID,
        tenantID: requesterTenantID
      }, {
        $inc: {
          saldo: oldBeban.jumlah
        }
      });

      const updated = await BebanOperasional.findOneAndUpdate({
        _id: id,
        tenantID: requesterTenantID
      }, payload, {
        new: true,
        runValidators: true
      }).lean();

      const newJumlah = payload.jumlah !== undefined ? payload.jumlah : oldBeban.jumlah;
      const newAkunID = payload.akunKasID || oldBeban.akunKasID;

      await AkunKas.updateOne({
        _id: newAkunID,
        tenantID: requesterTenantID
      }, {
        $inc: {
          saldo: -newJumlah
        }
      });

      await this.clearCache(requesterTenantID, id);

      return updated;
    } catch (err) {
      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const target = await BebanOperasional.findOne({
      _id: id,
      tenantID: requesterTenantID
    });
    if (!target) return null;

    const result = await BebanOperasional.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount > 0) {
      await AkunKas.updateOne({
        _id: target.akunKasID,
        tenantID: requesterTenantID
      }, {
        $inc: {
          saldo: target.jumlah
        }
      });

      await this.clearCache(requesterTenantID, id);
      return true;
    }

    return null;
  }
}

module.exports = new BebanOperasionalService();