const mongoose = require("mongoose");
const Produk = require("../models/produkModel");
const BahanBaku = require("../models/bahanBakuModel");
const redis = require("../config/redis");
const createError = require("http-errors");
const { toBaseUnit } = require("../utils/unitConverter");

const CACHE_KEY_LIST = (tenantID) => `produk:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `produk:detail:${id}`;

class ProdukService {
  // Private Helper untuk Error Database (Konsisten dengan ProdukPajakService)
  #handleDbError(error) {
    if (error.code === 11000) {
      return createError(400, "Nama produk sudah terdaftar di tenant ini.");
    }
    return createError(500, error.message);
  }

  // Helper Internal: Hitung Stok Berdasarkan Resep
  async calculatePotentialStock(resep, tenantID) {
    if (!resep || resep.length === 0) return 0;

    const bahanIds = resep.map((r) => r.bahanBakuID);
    const bahanBakuList = await BahanBaku.find({
      _id: { $in: bahanIds },
      tenantID,
    }).lean();

    const bahanMap = {};
    bahanBakuList.forEach((b) => {
      bahanMap[b._id.toString()] = b;
    });

    let minStock = Infinity;
    for (const item of resep) {
      const bahanDb = bahanMap[item.bahanBakuID.toString()];
      if (!bahanDb) return 0;

      const stokTersedia = toBaseUnit(bahanDb.stok, bahanDb.satuan);
      const kebutuhanResep = toBaseUnit(item.jumlah, item.satuan);

      if (kebutuhanResep === 0) continue;

      const porsiBisaDibuat = Math.floor(stokTersedia / kebutuhanResep);
      if (porsiBisaDibuat < minStock) minStock = porsiBisaDibuat;
    }
    return minStock === Infinity ? 0 : minStock;
  }

  async getAll(tenantID) {
    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const produk = await Produk.aggregate([
      { $match: { tenantID: new mongoose.Types.ObjectId(tenantID) } },
      { $sort: { namaProduk: 1 } },
      {
        $lookup: {
          from: "produkpajaks",
          localField: "_id",
          foreignField: "produkID",
          as: "relasiPajak",
        },
      },
      {
        $lookup: {
          from: "pajaks",
          localField: "relasiPajak.pajakID",
          foreignField: "_id",
          as: "pajakData",
        },
      },
      {
        $lookup: {
          from: "kategoris",
          localField: "kategoriID",
          foreignField: "_id",
          as: "kategoriData",
        },
      },
      { $unwind: { path: "$kategoriData", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          namaProduk: 1,
          gambarProduk: 1,
          stok: 1,
          hargaDasar: 1,
          hargaJual: 1,
          keterangan: 1,
          createdAt: 1,
          updatedAt: 1,
          kategori: "$kategoriData.namaKategori",
          pajakList: {
            $map: {
              input: "$pajakData",
              as: "p",
              in: { _id: "$$p._id", namaPajak: "$$p.namaPajak" },
            },
          },
        },
      },
    ]);

    if (produk.length > 0) {
      await redis.set(key, JSON.stringify(produk), "EX", 120);
    }
    return produk;
  }

  async getById(id, tenantID) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const result = await Produk.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
          tenantID: new mongoose.Types.ObjectId(tenantID),
        },
      },
      {
        $lookup: {
          from: "produkpajaks",
          localField: "_id",
          foreignField: "produkID",
          as: "relasiPajak",
        },
      },
      {
        $lookup: {
          from: "pajaks",
          localField: "relasiPajak.pajakID",
          foreignField: "_id",
          as: "pajakData",
        },
      },
      {
        $lookup: {
          from: "kategoris",
          localField: "kategoriID",
          foreignField: "_id",
          as: "kategoriData",
        },
      },
      { $unwind: { path: "$kategoriData", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          namaProduk: 1,
          gambarProduk: 1,
          stok: 1,
          hargaDasar: 1,
          hargaJual: 1,
          keterangan: 1,
          kategori: "$kategoriData.namaKategori",
          pajakList: {
            $map: {
              input: "$pajakData",
              as: "p",
              in: { _id: "$$p._id", namaPajak: "$$p.namaPajak" },
            },
          },
        },
      },
    ]);

    const data = result.length > 0 ? result[0] : null;
    if (data) {
      await redis.set(key, JSON.stringify(data), "EX", 120);
    }
    return data;
  }

  async create(payload) {
    try {
      if (payload.resep?.length > 0) {
        payload.stok = await this.calculatePotentialStock(
          payload.resep,
          payload.tenantID,
        );
      }

      const data = await Produk.create(payload);
      await redis.del(CACHE_KEY_LIST(payload.tenantID));
      return data;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  async update(id, payload, tenantID) {
    try {
      const existing = await Produk.findOne({ _id: id, tenantID }).lean();
      if (!existing) throw createError(404, "Produk tidak ditemukan.");

      if (payload.resep) {
        payload.stok = await this.calculatePotentialStock(
          payload.resep,
          tenantID,
        );
      }

      const data = await Produk.findByIdAndUpdate(id, payload, {
        new: true,
      }).lean();

      await redis.del(CACHE_KEY_LIST(tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));
      return data;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  async delete(id, tenantID) {
    const data = await Produk.findOne({ _id: id, tenantID });
    if (!data) throw createError(404, "Produk tidak ditemukan.");

    await Produk.deleteOne({ _id: id, tenantID });

    await redis.del(CACHE_KEY_LIST(tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));
    return { message: "Produk berhasil dihapus." };
  }
}

module.exports = new ProdukService();
