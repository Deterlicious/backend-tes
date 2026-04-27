const JurnalStok = require("../models/jurnalStokModel");
const Inventory = require("../models/inventoryModel");
const redis = require("../config/redis");
const {
  validateJurnalPayload
} = require("../validators/jurnalStokValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `jurnalstok:list:${tenantID}`;
const KEY_DETAIL = (id) => `jurnalstok:detail:${id}`;

class JurnalStokService {
  async clearCache(tenantID, id) {
    const keys = [KEY_LIST(tenantID)];
    if (id) keys.push(KEY_DETAIL(id));

    await redis.del(keys);
  }

  _getMultiplier(tipe) {
    return tipe === "Masuk" ? 1 : -1;
  }

  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID required");

    const key = KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await JurnalStok.find({
        tenantID
      })
      .populate("bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama")
      .populate("locationID", "nama tipe")
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

    const data = await JurnalStok.findOne({
        _id: id,
        tenantID: requesterTenantID,
      })
      .populate("bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama")
      .populate("locationID", "nama tipe")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 300);
    return data;
  }

  async create(payload) {
    const validation = validateJurnalPayload(payload);
    if (!validation.valid) return {
      error: validation.errors
    };

    try {
      const jurnal = await JurnalStok.create(payload);

      const changeAmount = this._getMultiplier(payload.tipeKoreksi) * payload.jumlah;

      await Inventory.findOneAndUpdate({
        bahanBakuID: payload.bahanBakuID,
        locationID: payload.locationID,
        tenantID: payload.tenantID,
      }, {
        $inc: {
          stok: changeAmount
        }
      }, {
        upsert: true,
        new: true
      });

      await this.clearCache(payload.tenantID);

      return jurnal;
    } catch (err) {
      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateJurnalPayload(payload, true);
    if (!validation.valid) return {
      error: validation.errors
    };

    delete payload.tenantID;
    delete payload.bahanBakuID;
    delete payload.locationID;

    try {
      const oldJurnal = await JurnalStok.findOne({
        _id: id,
        tenantID: requesterTenantID
      });
      if (!oldJurnal) return null;

      const oldChange = this._getMultiplier(oldJurnal.tipeKoreksi) * oldJurnal.jumlah;
      await Inventory.updateOne({
        bahanBakuID: oldJurnal.bahanBakuID,
        locationID: oldJurnal.locationID,
        tenantID: requesterTenantID,
      }, {
        $inc: {
          stok: -oldChange
        }
      });

      const updated = await JurnalStok.findOneAndUpdate({
        _id: id,
        tenantID: requesterTenantID
      }, payload, {
        new: true,
        runValidators: true
      }).lean();

      const finalTipe = payload.tipeKoreksi || oldJurnal.tipeKoreksi;
      const finalJumlah = payload.jumlah !== undefined ? payload.jumlah : oldJurnal.jumlah;

      const newChange = this._getMultiplier(finalTipe) * finalJumlah;

      await Inventory.updateOne({
        bahanBakuID: oldJurnal.bahanBakuID,
        locationID: oldJurnal.locationID,
        tenantID: requesterTenantID,
      }, {
        $inc: {
          stok: newChange
        }
      }, {
        upsert: true
      });

      await this.clearCache(requesterTenantID, id);

      return updated;
    } catch (err) {
      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const deleted = await JurnalStok.findOneAndDelete({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (!deleted) return null;

    const changeAmount = this._getMultiplier(deleted.tipeKoreksi) * deleted.jumlah;

    await Inventory.updateOne({
      bahanBakuID: deleted.bahanBakuID,
      locationID: deleted.locationID,
      tenantID: requesterTenantID,
    }, {
      $inc: {
        stok: -changeAmount
      }
    });

    await this.clearCache(requesterTenantID, id);

    return true;
  }
}

module.exports = new JurnalStokService();
