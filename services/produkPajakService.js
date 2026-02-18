const ProdukPajak = require("../models/produkPajakModel");
const Pajak = require("../models/pajakModel");
const redis = require("../config/redis");
const createError = require("http-errors");

const KEY_PROD_PAJAK = (produkID) => `produkPajak:list:${produkID}`;

class ProdukPajakService {
  #handleDbError(error) {
    if (error.code === 11000)
      return createError(
        400,
        "Pajak ini sudah terpasang pada produk tersebut.",
      );
    return createError(500, error.message);
  }

  // Assign pajak ke produk
  async assignPajak(payload) {
    try {
      // 1. Ambil data Master Pajak untuk mendapatkan namanya
      const masterPajak = await Pajak.findById(payload.pajakID);
      if (!masterPajak) throw createError(404, "Master Pajak tidak ditemukan.");

      // 2. Injeksi namaPajak ke payload sebelum simpan
      payload.namaPajak = masterPajak.namaPajak;

      const data = await ProdukPajak.create(payload);
      await redis.del(KEY_PROD_PAJAK(payload.produkID));
      return data;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  // Ambil daftar pajak yang aktif untuk satu produk (Audit & Kalkulasi Ready)
  async getPajakByProduk(produkID, tenantID) {
    const cached = await redis.get(KEY_PROD_PAJAK(produkID));
    if (cached) return JSON.parse(cached);

    // Kita populate ke Pajak untuk dapat tarif dan prioritasnya
    const data = await ProdukPajak.find({ produkID, tenantID })
      .populate({
        path: "pajakID",
        select: "namaPajak tarifPajak modelPerhitungan prioritas statusPajak",
      })
      .lean();

    // Filter hanya pajak yang statusnya ON
    const activeTaxes = data.filter(
      (item) => item.pajakID?.statusPajak === true,
    );

    await redis.set(
      KEY_PROD_PAJAK(produkID),
      JSON.stringify(activeTaxes),
      "EX",
      60,
    );
    return activeTaxes;
  }

  // Menghapus hubungan pajak dari produk
  async unassignPajak(id, tenantID) {
    const deleted = await ProdukPajak.findOneAndDelete({ _id: id, tenantID });
    if (!deleted) throw createError(404, "Relasi pajak tidak ditemukan.");
    await redis.del(KEY_PROD_PAJAK(deleted.produkID));
    return { message: "Pajak dilepas dari produk." };
  }
}

module.exports = new ProdukPajakService();
