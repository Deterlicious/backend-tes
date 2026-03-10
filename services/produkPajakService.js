const ProdukPajak = require("../models/produkPajakModel");
const Pajak = require("../models/pajakModel");
const createError = require("http-errors");
const redis = require("../config/redis");

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
      if (!masterPajak) throw createError(404, "Master Pajak tidak ditemukan.");

      payload.namaPajak = masterPajak.namaPajak;

      const data = await ProdukPajak.create({
        produkID: payload.produkID || null,
        assetID: payload.assetID || null,
        pajakID: payload.pajakID,
        namaPajak: payload.namaPajak,
        tenantID: payload.tenantID,
      });

      // --- LOGIKA PEMBERSIHAN CACHE ---
      if (payload.produkID) {
        // Hapus cache list produk tenant tersebut
        await redis.del(`produk:list:${payload.tenantID}`);
        // Hapus cache detail produk spesifik tersebut
        await redis.del(`produk:detail:${payload.produkID}`);
      }

      return data;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  async getPajakByTarget(id, tenantID) {
    const rawData = await ProdukPajak.find({
      $or: [{ produkID: id }, { assetID: id }],
      tenantID,
    })
      .populate({
        path: "pajakID",
        select:
          "namaPajak tarifPajak tipePajak modelPerhitungan prioritas statusPajak",
      })
      .lean();

    // Mapping biar bersih
    return rawData
      .filter((item) => item.pajakID?.statusPajak === true)
      .map((item) => ({
        _id: item._id,
        // Gunakan spread operator atau pengecekan manual
        ...(item.produkID && { produkID: item.produkID }),
        ...(item.assetID && { assetID: item.assetID }),
        pajak: {
          _id: item.pajakID._id,
          nama: item.pajakID.namaPajak,
          tarif: item.pajakID.tarifPajak,
          tipe: item.pajakID.tipePajak,
          prioritas: item.pajakID.prioritas,
          // Konversi angka model ke teks biar Frontend nggak bingung
          model:
            item.pajakID.modelPerhitungan === 1
              ? "Inclusive"
              : item.pajakID.modelPerhitungan === 2
                ? "Exclusive"
                : "Compound",
        },
      }));
  }

  async getPajakByProduk(produkID, tenantID) {
    return this.getPajakByTarget(produkID, tenantID);
  }

  async getPajakByAsset(assetID, tenantID) {
    return this.getPajakByTarget(assetID, tenantID);
  }

  async unassignPajak(id, tenantID) {
    const data = await ProdukPajak.findOne({ _id: id, tenantID });
    if (!data) throw createError(404, "Relasi pajak tidak ditemukan.");

    const { produkID } = data; // Simpan ID produk sebelum dihapus

    await ProdukPajak.deleteOne({ _id: id, tenantID });

    // Bersihkan cache agar data di Produk Service jadi fresh
    await redis.del(`produk:list:${tenantID}`);
    if (produkID) await redis.del(`produk:detail:${produkID}`);

    return { message: "Pajak berhasil dilepas dari item." };
  }
}

module.exports = new ProdukPajakService();
