const TipeAset = require("../models/tipeAsetModel");
const redis = require("../config/redis");
const { validateTipeAsetPayload } = require("../validators/tipeAsetValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID, filterKey) =>
  `tipeAset:list:${tenantID}:${filterKey}`;
const KEY_DETAIL = (id) => `tipeAset:detail:${id}`;

class TipeAsetService {
  async clearCache(tenantID, id) {
    const pattern = `tipeAset:list:${tenantID}:*`;
    let cursor = "0";
    const keysToDelete = [];

    do {
      const res = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = res[0];
      const keys = res[1] || [];

      if (keys.length) {
        keysToDelete.push(...keys);
      }
    } while (cursor !== "0");

    if (id) {
      keysToDelete.push(KEY_DETAIL(id));
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
  }

  _formatOutput(doc) {
    if (!doc) return null;
    if (Array.isArray(doc)) return doc.map((d) => this._formatOutput(d));

    return {
      _id: doc._id,
      tenantID: doc.tenantID,
      namaTipeAset: doc.namaTipeAset,
      deskripsi: doc.deskripsi,
      dataTarif: Array.isArray(doc.listTarif)
        ? doc.listTarif.map((tarif) => ({
            _id: tarif._id,
            namaTarif: tarif.namaTarif,
            harga: tarif.harga,
            durasiMinimum: tarif.durasiMinimum,
          }))
        : [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async getAll(tenantID, query = {}) {
    if (!tenantID) {
      throw createError(400, "tenantID required");
    }

    const filter = { tenantID };

    if (query.namaTipeAset) {
      filter.namaTipeAset = {
        $regex: query.namaTipeAset,
        $options: "i",
      };
    }

    const filterKey = JSON.stringify({
      tenantID: String(tenantID),
      namaTipeAset: query.namaTipeAset || null,
    });

    const key = KEY_LIST(tenantID, filterKey);
    const cached = await redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    const data = await TipeAset.find(filter)
      .populate("listTarif", "namaTarif harga durasiMinimum")
      .sort({ namaTipeAset: 1 })
      .lean({ virtuals: true });

    const formatted = this._formatOutput(data);

    if (formatted.length > 0) {
      await redis.set(key, JSON.stringify(formatted), "EX", 300);
    }

    return formatted;
  }

  async getById(id, tenantID) {
    const key = KEY_DETAIL(id);
    const cached = await redis.get(key);

    if (cached) {
      const parsed = JSON.parse(cached);

      if (parsed.tenantID !== tenantID.toString()) {
        return null;
      }

      return parsed;
    }

    const data = await TipeAset.findOne({ _id: id, tenantID })
      .populate("listTarif", "namaTarif harga durasiMinimum")
      .lean({ virtuals: true });

    if (!data) {
      return null;
    }

    const formatted = this._formatOutput(data);
    await redis.set(key, JSON.stringify(formatted), "EX", 300);

    return formatted;
  }

  async create(payload) {
    const validation = validateTipeAsetPayload(payload);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    try {
      const tipeAset = await TipeAset.create(payload);

      await this.clearCache(payload.tenantID);

      const created = await TipeAset.findById(tipeAset._id)
        .populate("listTarif", "namaTarif harga durasiMinimum")
        .lean({ virtuals: true });

      return this._formatOutput(created);
    } catch (err) {
      if (err.code === 11000) {
        throw createError(400, "Nama tipe aset sudah digunakan di tenant ini");
      }

      throw err;
    }
  }

  async update(id, tenantID, payload) {
    const validation = validateTipeAsetPayload(payload, true);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    delete payload.tenantID;

    try {
      const updated = await TipeAset.findOneAndUpdate(
        { _id: id, tenantID },
        payload,
        { new: true, runValidators: true }
      )
        .populate("listTarif", "namaTarif harga durasiMinimum")
        .lean({ virtuals: true });

      if (!updated) {
        return null;
      }

      await this.clearCache(tenantID, id);

      return this._formatOutput(updated);
    } catch (err) {
      if (err.code === 11000) {
        throw createError(400, "Nama tipe aset sudah digunakan di tenant ini");
      }

      throw err;
    }
  }

  async delete(id, tenantID) {
    const result = await TipeAset.deleteOne({ _id: id, tenantID });

    if (result.deletedCount === 0) {
      return null;
    }

    await this.clearCache(tenantID, id);

    return true;
  }
}

module.exports = new TipeAsetService();