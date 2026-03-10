const Aset = require("../models/asetModel");
const redis = require("../config/redis");
const { validateAsetPayload } = require("../validators/asetValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID, filterKey) => `aset:list:${tenantID}:${filterKey}`;
const KEY_DETAIL = (id) => `aset:detail:${id}`;

class AsetService {
  async clearCache(tenantID, id) {
    const pattern = `aset:list:${tenantID}:*`;
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
      namaAset: doc.namaAset,
      dataAset: doc.tipeAsetID
        ? {
            _id: doc.tipeAsetID._id,
            namaTipeAset: doc.tipeAsetID.namaTipeAset,
            deskripsi: doc.tipeAsetID.deskripsi,
          }
        : null,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async getAll(tenantID, query = {}) {
    if (!tenantID) {
      throw createError(400, "Tenant ID required");
    }

    const filter = { tenantID };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.tipeAsetID) {
      filter.tipeAsetID = query.tipeAsetID;
    }

    const filterKey = JSON.stringify(filter);
    const key = KEY_LIST(tenantID, filterKey);

    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await Aset.find(filter)
      .populate("tipeAsetID", "namaTipeAset deskripsi")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = this._formatOutput(data);

    if (formatted.length > 0) {
      await redis.set(key, JSON.stringify(formatted), "EX", 300);
    }

    return formatted;
  }

  async getById(id, requesterTenantID) {
    const key = KEY_DETAIL(id);
    const cached = await redis.get(key);

    if (cached) {
      const parsed = JSON.parse(cached);

      if (parsed.tenantID !== requesterTenantID.toString()) {
        return null;
      }

      return parsed;
    }

    const data = await Aset.findOne({
      _id: id,
      tenantID: requesterTenantID,
    })
      .populate("tipeAsetID", "namaTipeAset deskripsi")
      .lean();

    if (!data) {
      return null;
    }

    const formatted = this._formatOutput(data);
    await redis.set(key, JSON.stringify(formatted), "EX", 300);

    return formatted;
  }

  async create(payload) {
    const validation = validateAsetPayload(payload);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    const aset = await Aset.create(payload);

    await this.clearCache(payload.tenantID);

    const created = await Aset.findById(aset._id)
      .populate("tipeAsetID", "namaTipeAset deskripsi")
      .lean();

    return this._formatOutput(created);
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateAsetPayload(payload, true);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    delete payload.tenantID;

    const updated = await Aset.findOneAndUpdate(
      { _id: id, tenantID: requesterTenantID },
      payload,
      { new: true, runValidators: true }
    )
      .populate("tipeAsetID", "namaTipeAset deskripsi")
      .lean();

    if (!updated) {
      return null;
    }

    await this.clearCache(requesterTenantID, id);

    return this._formatOutput(updated);
  }

  async delete(id, requesterTenantID) {
    const result = await Aset.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) {
      return null;
    }

    await this.clearCache(requesterTenantID, id);

    return true;
  }
}

module.exports = new AsetService();