const Tarif = require("../models/tarifModel");
const TipeAset = require("../models/tipeAsetModel");
const redis = require("../config/redis"); // Pastikan path config redis benar
const { validateTarifPayload } = require("../validators/tarifValidator");
const createError = require("http-errors");

// CACHE KEYS
const KEY_LIST = (tenantID) => `tarif:list:${tenantID}`;
const KEY_DETAIL = (tenantID, id) => `tarif:detail:${tenantID}:${id}`;

class TarifService {
  async verifyAssetOwnership(assetIds, tenantID) {
    if (!assetIds || assetIds.length === 0) return;

    // Pastikan assetIds adalah array unik
    const uniqueIds = [...new Set(assetIds)];

    // Cari aset di DB berdasarkan ID list DAN tenantID
    // Artinya: "Cari aset-aset ini, TAPI hanya yang milik tenant ini"
    const validAssets = await TipeAset.find({
      _id: { $in: uniqueIds },
      tenantID: tenantID,
    }).select("_id");

    if (validAssets.length !== uniqueIds.length) {
      throw createError(
        403,
        "Security Violation: Satu atau lebih Tipe Aset tidak ditemukan atau milik tenant lain."
      );
    }
  }

  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID required");

    const key = KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const tarifs = await Tarif.find({ tenantID })
      .populate("tipeAsetID", "namaTipeAset") // Asumsi model TipeAset punya field nama
      .lean();

    if (tarifs.length > 0) {
      await redis.set(key, JSON.stringify(tarifs), "EX", 60);
    }

    return tarifs;
  }

  async getById(id, tenantID) {
    const key = KEY_DETAIL(tenantID, id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const tarif = await Tarif.findOne({ _id: id, tenantID })
      .populate("tipeAsetID", "namaTipeAset")
      .lean();

    if (!tarif) return null;

    await redis.set(key, JSON.stringify(tarif), "EX", 60);
    return tarif;
  }

  async create(payload) {
    const validation = validateTarifPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    // Normalisasi Array
    if (payload.tipeAsetID && !Array.isArray(payload.tipeAsetID)) {
      payload.tipeAsetID = [payload.tipeAsetID];
    }

    try {
      // security check
      if (payload.tipeAsetID) {
        await this.verifyAssetOwnership(payload.tipeAsetID, payload.tenantID);
      }

      const newTarif = await Tarif.create(payload);

      await redis.del(KEY_LIST(payload.tenantID));
      return newTarif;
    } catch (err) {
      if (err.code === 11000)
        return { error: ["Nama tarif sudah ada di tenant ini"] };
      throw err;
    }
  }

  async update(id, tenantID, payload) {
    const validation = validateTarifPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID; // Security

    // Normalisasi Array untuk pengecekan
    let idsToCheck = [];
    if (payload.tipeAsetID) {
      idsToCheck = Array.isArray(payload.tipeAsetID)
        ? payload.tipeAsetID
        : [payload.tipeAsetID];
    }

    try {
      // security check
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
        { new: true, runValidators: true }
      ).lean();

      if (!updated) return null;

      await redis.del(KEY_LIST(tenantID));
      await redis.del(KEY_DETAIL(tenantID, id));

      return updated;
    } catch (err) {
      if (err.code === 11000) return { error: ["Nama tarif conflict"] };
      throw err;
    }
  }

  async delete(id, tenantID) {
    const deleted = await Tarif.findOneAndDelete({ _id: id, tenantID });
    if (!deleted) return null;

    await redis.del(KEY_LIST(tenantID));
    await redis.del(KEY_DETAIL(tenantID, id));

    return true;
  }
}

module.exports = new TarifService();
