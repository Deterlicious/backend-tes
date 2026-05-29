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

    const data = await JurnalStok.find({ tenantID })
      .populate("bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama")
      .populate("locationID", "nama tipe")
      .sort({ tanggal: -1, createdAt: -1 })
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

  // ---------------------------------------------------------------------------
  // WMS AUDIT TRAIL
  // ---------------------------------------------------------------------------

  async kirimBarangJurnal(bahanBakuID, dariLocationID, qtyKirim, noDokumen, tenantID, dicatatOleh = null) {
    if (qtyKirim <= 0) {
      throw createError(400, "Jumlah kirim harus lebih dari 0.");
    }

    const inventory = await Inventory.findOneAndUpdate(
      { bahanBakuID, locationID: dariLocationID, tenantID, stok: { $gte: qtyKirim } },
      { $inc: { stok: -qtyKirim } },
      { new: true },
    );

    if (!inventory) {
      throw createError(400, "Stok tidak mencukupi atau data inventaris tidak ditemukan di lokasi asal.");
    }

    try {
      const jurnal = await JurnalStok.create({
        bahanBakuID,
        tanggal: new Date(),
        tipeKoreksi: "Keluar",
        jumlah: qtyKirim,
        alasan: "Transfer Gudang",
        keterangan: `Kirim Transfer: ${noDokumen}`,
        dicatatOleh,
        locationID: dariLocationID,
        tenantID,
      });
      return { inventory, jurnal };
    } catch (err) {
      await Inventory.findOneAndUpdate(
        { bahanBakuID, locationID: dariLocationID, tenantID },
        { $inc: { stok: qtyKirim } },
      );
      throw err;
    }
  }

  async terimaBarangJurnal(bahanBakuID, keLocationID, qtyTerima, noDokumen, tenantID, dicatatOleh = null) {
    if (qtyTerima <= 0) {
      throw createError(400, "Jumlah terima harus lebih dari 0.");
    }

    let inventory = await Inventory.findOneAndUpdate(
      { bahanBakuID, locationID: keLocationID, tenantID },
      { $inc: { stok: qtyTerima } },
      { new: true },
    );

    const isNewRecord = !inventory;
    if (isNewRecord) {
      inventory = await Inventory.create({
        bahanBakuID,
        locationID: keLocationID,
        stok: qtyTerima,
        tenantID,
      });
    }

    try {
      const jurnal = await JurnalStok.create({
        bahanBakuID,
        tanggal: new Date(),
        tipeKoreksi: "Masuk",
        jumlah: qtyTerima,
        alasan: "Transfer Gudang",
        keterangan: `Terima Transfer: ${noDokumen}`,
        dicatatOleh,
        locationID: keLocationID,
        tenantID,
      });
      return { inventory, jurnal };
    } catch (err) {
      if (isNewRecord) {
        await Inventory.findOneAndDelete({ _id: inventory._id });
      } else {
        await Inventory.findOneAndUpdate(
          { bahanBakuID, locationID: keLocationID, tenantID },
          { $inc: { stok: -qtyTerima } },
        );
      }
      throw err;
    }
  }

  async rollbackBarangJurnal(bahanBakuID, dariLocationID, qtyKirim, noDokumen, tenantID, dicatatOleh = null) {
    if (qtyKirim <= 0) {
      throw createError(400, "Jumlah rollback harus lebih dari 0.");
    }

    const inventory = await Inventory.findOneAndUpdate(
      { bahanBakuID, locationID: dariLocationID, tenantID },
      { $inc: { stok: qtyKirim } },
      { new: true },
    );

    if (!inventory) {
      throw createError(404, "Data inventaris tidak ditemukan di lokasi asal. Rollback tidak dapat dilakukan.");
    }

    try {
      const jurnal = await JurnalStok.create({
        bahanBakuID,
        tanggal: new Date(),
        tipeKoreksi: "Masuk",
        jumlah: qtyKirim,
        alasan: "Lainnya",
        keterangan: `Pembatalan Transfer: ${noDokumen}`,
        dicatatOleh,
        locationID: dariLocationID,
        tenantID,
      });
      return { inventory, jurnal };
    } catch (err) {
      await Inventory.findOneAndUpdate(
        { bahanBakuID, locationID: dariLocationID, tenantID },
        { $inc: { stok: -qtyKirim } },
      );
      throw err;
    }
  }

  async opnameBarangJurnal(inventoryID, fisikAktual, catatan, tenantID, dicatatOleh = null) {
    if (fisikAktual < 0) {
      throw createError(400, "Jumlah stok fisik aktual tidak boleh bernilai negatif.");
    }

    const inventory = await Inventory.findOne({ _id: inventoryID, tenantID });
    if (!inventory) {
      throw createError(404, "Data inventaris tidak ditemukan.");
    }

    const stokSebelumnya = inventory.stok;
    const delta = fisikAktual - stokSebelumnya;
    inventory.stok = fisikAktual;
    await inventory.save();

    try {
      const jurnal = await JurnalStok.create({
        bahanBakuID: inventory.bahanBakuID,
        tanggal: new Date(),
        tipeKoreksi: delta >= 0 ? "Masuk" : "Keluar",
        jumlah: Math.abs(delta),
        alasan: "Stok Opname",
        keterangan: catatan || "Penyesuaian stok fisik",
        dicatatOleh,
        locationID: inventory.locationID,
        tenantID,
      });
      return { inventory, jurnal, delta };
    } catch (err) {
      inventory.stok = stokSebelumnya;
      await inventory.save();
      throw err;
    }
  }
}

module.exports = new JurnalStokService();
