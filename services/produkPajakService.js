const ProdukPajak = require("../models/produkPajakModel");
const Pajak = require("../models/pajakModel");
const redis = require("../config/redis");
const createError = require("http-errors");

// Cache key sekarang lebih fleksibel (bisa ID Produk atau ID Asset)
const KEY_PAJAK_RELASI = (id) => `pajakRelasi:list:${id}`;

class ProdukPajakService {
  #handleDbError(error) {
    if (error.code === 11000)
      return createError(400, "Pajak ini sudah terpasang pada item tersebut.");
    return createError(500, error.message);
  }

  async assignPajak(payload) {
    try {
      const masterPajak = await Pajak.findById(payload.pajakID);
      if (!masterPajak) throw createError(404, "Master Pajak tidak ditemukan.");

      payload.nama_pajak = masterPajak.namaPajak; // Injeksi nama sesuai gambar revisi

      const data = await ProdukPajak.create(payload);

      // Hapus cache sesuai targetnya (Produk atau Asset)
      const targetID = payload.produkID || payload.assetID;
      await redis.del(KEY_PAJAK_RELASI(targetID));

      return data;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  async getPajakByTarget(id, tenantID) {
    const cached = await redis.get(KEY_PAJAK_RELASI(id));
    if (cached) return JSON.parse(cached);

    // Cari bisa berdasarkan produkID ATAU assetID
    const data = await ProdukPajak.find({
      $or: [{ produkID: id }, { assetID: id }],
      tenantID,
    })
      .populate({
        path: "pajakID",
        select: "namaPajak tarifPajak modelPerhitungan prioritas statusPajak",
      })
      .lean();

    const activeTaxes = data.filter(
      (item) => item.pajakID?.statusPajak === true,
    );

    await redis.set(
      KEY_PAJAK_RELASI(id),
      JSON.stringify(activeTaxes),
      "EX",
      3600,
    );
    return activeTaxes;
  }

  async unassignPajak(id, tenantID) {
    // Cari data sebelum dihapus untuk mendapatkan ID Produk/Asset agar bisa hapus cache
    const data = await ProdukPajak.findOne({ _id: id, tenant_ID: tenantID });
    if (!data) throw createError(404, "Relasi pajak tidak ditemukan.");

    const deleted = await ProdukPajak.deleteOne({
      _id: id,
      tenant_ID: tenantID,
    });

    // Hapus cache agar data di Postman/Frontend langsung terupdate
    const targetID = data.produkID || data.assetID;
    if (targetID) {
      await redis.del(KEY_PAJAK_RELASI(targetID));
    }

    return { message: "Pajak berhasil dilepas dari item." };
  }
}

module.exports = new ProdukPajakService();
