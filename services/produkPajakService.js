const ProdukPajak = require("../models/produkPajakModel");
const Pajak = require("../models/pajakModel");
const createError = require("http-errors");

class ProdukPajakService {
  #handleDbError(error) {
    if (error.code === 11000) {
      return createError(400, "Pajak ini sudah terpasang pada item tersebut.");
    }

    return createError(500, error.message);
  }

  async assignPajak(payload) {
    try {
      const masterPajak = await Pajak.findById(payload.pajakID).lean();

      if (!masterPajak) {
        throw createError(404, "Master Pajak tidak ditemukan.");
      }

      payload.namaPajak = masterPajak.namaPajak;

      const data = await ProdukPajak.create({
        produkID: payload.produkID || null,
        assetID: payload.assetID || null,
        pajakID: payload.pajakID,
        namaPajak: payload.namaPajak,
        tenantID: payload.tenantID,
      });

      return data;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  async getPajakByTarget(id, tenantID) {
    const data = await ProdukPajak.find({
      $or: [{ produkID: id }, { assetID: id }],
      tenantID,
    })
      .populate({
        path: "pajakID",
        select:
          "namaPajak tarifPajak tipePajak modelPerhitungan prioritas statusPajak",
      })
      .lean();

    return data.filter((item) => item.pajakID?.statusPajak === true);
  }

  async getPajakByProduk(produkID, tenantID) {
    return this.getPajakByTarget(produkID, tenantID);
  }

  async getPajakByAsset(assetID, tenantID) {
    return this.getPajakByTarget(assetID, tenantID);
  }

  async unassignPajak(id, tenantID) {
    const data = await ProdukPajak.findOne({ _id: id, tenantID });

    if (!data) {
      throw createError(404, "Relasi pajak tidak ditemukan.");
    }

    await ProdukPajak.deleteOne({ _id: id, tenantID });

    return { message: "Pajak berhasil dilepas dari item." };
  }
}

module.exports = new ProdukPajakService();