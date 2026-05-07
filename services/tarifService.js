const Tarif = require("../models/tarifModel");
const TipeAset = require("../models/tipeAsetModel");
const redis = require("../config/redis");
const { validateTarifPayload } = require("../validators/tarifValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID, filterKey) => `tarif:list:${tenantID}:${filterKey}`;
const KEY_DETAIL = (id) => `tarif:detail:${id}`;

class TarifService {
  async clearCache(tenantID, id) {
    const pattern = `tarif:list:${tenantID}:*`;
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

  async verifyAssetOwnership(assetIds, tenantID) {
    if (!assetIds || assetIds.length === 0) return;

    const uniqueIds = [...new Set(assetIds)];

    const validAssets = await TipeAset.find({
      _id: { $in: uniqueIds },
      tenantID,
    }).select("_id");

    if (validAssets.length !== uniqueIds.length) {
      throw createError(
        403,
        "Security Violation: Satu atau lebih Tipe Aset tidak ditemukan atau milik tenant lain.",
      );
    }
  }

  _formatOutput(doc) {
    if (!doc) return null;
    if (Array.isArray(doc)) return doc.map((d) => this._formatOutput(d));

    return {
      _id: doc._id,
      tenantID: doc.tenantID,
      namaTarif: doc.namaTarif,
      basisPerhitungan: doc.basisPerhitungan,
      harga: doc.harga,
      durasiMinimum: doc.durasiMinimum,
      isActive: doc.isActive, // Diubah
      hariAktif: doc.hariAktif,
      jamMulai: doc.jamMulai,
      jamSelesai: doc.jamSelesai,
      prioritas: doc.prioritas,
      dataAset: Array.isArray(doc.tipeAsetID)
        ? doc.tipeAsetID.map((aset) => ({
            _id: aset._id,
            namaTipeAset: aset.namaTipeAset,
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

    if (query.isActive !== undefined) {
      // Diubah
      filter.isActive = query.isActive === "true";
    }

    if (query.basisPerhitungan) {
      filter.basisPerhitungan = query.basisPerhitungan;
    }

    const filterKey = JSON.stringify(filter);
    const key = KEY_LIST(tenantID, filterKey);

    const cached = await redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    const data = await Tarif.find(filter)
      .populate("tipeAsetID", "namaTipeAset")
      .sort({ prioritas: -1, createdAt: -1 })
      .lean();

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

    const data = await Tarif.findOne({
      _id: id,
      tenantID,
    })
      .populate("tipeAsetID", "namaTipeAset")
      .lean();

    if (!data) {
      return null;
    }

    const formatted = this._formatOutput(data);
    await redis.set(key, JSON.stringify(formatted), "EX", 300);

    return formatted;
  }

  async create(payload) {
    const validation = validateTarifPayload(payload);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    if (payload.tipeAsetID && !Array.isArray(payload.tipeAsetID)) {
      payload.tipeAsetID = [payload.tipeAsetID];
    }

    try {
      if (payload.tipeAsetID) {
        await this.verifyAssetOwnership(payload.tipeAsetID, payload.tenantID);
      }

      const tarif = await Tarif.create(payload);

      await this.clearCache(payload.tenantID);

      const created = await Tarif.findById(tarif._id)
        .populate("tipeAsetID", "namaTipeAset")
        .lean();

      return this._formatOutput(created);
    } catch (err) {
      if (err.code === 11000) {
        throw createError(400, "Nama tarif sudah digunakan di tenant ini");
      }

      throw err;
    }
  }

  async update(id, tenantID, payload) {
    const validation = validateTarifPayload(payload, true);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    delete payload.tenantID;

    let idsToCheck = [];

    if (payload.tipeAsetID) {
      idsToCheck = Array.isArray(payload.tipeAsetID)
        ? payload.tipeAsetID
        : [payload.tipeAsetID];
    }

    try {
      if (idsToCheck.length > 0) {
        await this.verifyAssetOwnership(idsToCheck, tenantID);
      }

      const updateFields = { ...payload };

      if (payload.tipeAsetID) {
        delete updateFields.tipeAsetID;
        updateFields.$addToSet = {
          tipeAsetID: { $each: idsToCheck },
        };
      }

      const updated = await Tarif.findOneAndUpdate(
        { _id: id, tenantID },
        updateFields,
        { new: true, runValidators: true },
      )
        .populate("tipeAsetID", "namaTipeAset")
        .lean();

      if (!updated) {
        return null;
      }

      await this.clearCache(tenantID, id);

      return this._formatOutput(updated);
    } catch (err) {
      if (err.code === 11000) {
        throw createError(400, "Nama tarif sudah digunakan di tenant ini");
      }

      throw err;
    }
  }

  async delete(id, tenantID) {
    const result = await Tarif.deleteOne({
      _id: id,
      tenantID,
    });

    if (result.deletedCount === 0) {
      return null;
    }

    await this.clearCache(tenantID, id);

    return true;
  }
}

module.exports = new TarifService();
