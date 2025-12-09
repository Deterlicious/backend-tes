const Tarif = require("../models/tarifModel");
const redis = require("../config/redis"); // Pastikan path config redis benar
const { validateTarifPayload } = require("../validators/tarifValidator");
const createError = require("http-errors");

// CACHE KEYS
const KEY_LIST = (tenantID) => `tarif:list:${tenantID}`;
const KEY_DETAIL = (tenantID, id) => `tarif:detail:${tenantID}:${id}`;

class TarifService {
  
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

    try {
      // Normalisasi tipeAsetID ke Array jika dikirim string
      if (payload.tipeAsetID && !Array.isArray(payload.tipeAsetID)) {
        payload.tipeAsetID = [payload.tipeAsetID];
      }

      const newTarif = await Tarif.create(payload);
      
      await redis.del(KEY_LIST(payload.tenantID));
      
      return newTarif;
    } catch (err) {
      if (err.code === 11000) return { error: ["Nama tarif sudah ada di tenant ini"] };
      throw err;
    }
  }

  async update(id, tenantID, payload) {
    const validation = validateTarifPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID; // Security

    const updateFields = { ...payload };

    // --- FIX BUG $addToSet ---
    // Kita tangani logika tipeAsetID secara khusus
    if (payload.tipeAsetID) {
        delete updateFields.tipeAsetID; // Hapus dari set standar

        // Pastikan input menjadi Array, lalu gunakan $addToSet dengan $each
        const idsArray = Array.isArray(payload.tipeAsetID) 
            ? payload.tipeAsetID 
            : [payload.tipeAsetID];
            
        updateFields.$addToSet = { 
            tipeAsetID: { $each: idsArray } 
        };
    }

    try {
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