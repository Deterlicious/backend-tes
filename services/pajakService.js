const Pajak = require("../models/pajakModel");
const createError = require("http-errors");

class PajakService {
  #handleDbError(error) {
    if (error.code === 11000) {
      return createError(400, "Nama pajak sudah digunakan.");
    }

    if (error.name === "ValidationError") {
      return createError(400, Object.values(error.errors)[0].message);
    }

    return createError(500, error.message);
  }

  #calculateTaxLogic(hargaDasar, listPajak) {
    const validPajak = Array.isArray(listPajak)
      ? listPajak.filter((item) => item != null && item.statusPajak === true)
      : [];

    if (validPajak.length === 0) {
      return {
        hargaAwal: hargaDasar,
        totalPajak: 0,
        grandTotal: hargaDasar,
        rincian: [],
      };
    }

    const sortedPajak = [...validPajak].sort(
      (a, b) => (a.prioritas || 0) - (b.prioritas || 0)
    );

    let totalPajak = 0;
    let runningTotal = Number(hargaDasar) || 0;
    const rincian = [];

    sortedPajak.forEach((p) => {
      let nilaiPajakPerItem = 0;

      if (p.modelPerhitungan === 1) {
        nilaiPajakPerItem =
          (runningTotal / (1 + p.tarifPajak / 100)) * (p.tarifPajak / 100);
      } else if (p.modelPerhitungan === 2) {
        nilaiPajakPerItem = (Number(hargaDasar) || 0) * (p.tarifPajak / 100);
        runningTotal += nilaiPajakPerItem;
      } else if (p.modelPerhitungan === 3) {
        nilaiPajakPerItem = runningTotal * (p.tarifPajak / 100);
        runningTotal += nilaiPajakPerItem;
      }

      totalPajak += nilaiPajakPerItem;

      rincian.push({
        _id: p._id,
        namaPajak: p.namaPajak,
        tarifPajak: p.tarifPajak,
        jumlah: Math.round(nilaiPajakPerItem),
        model:
          p.modelPerhitungan === 1
            ? "Inclusive"
            : p.modelPerhitungan === 2
              ? "Exclusive"
              : "Compound",
      });
    });

    return {
      hargaAwal: Number(hargaDasar) || 0,
      totalPajak: Math.round(totalPajak),
      grandTotal: Math.round(runningTotal),
      rincian,
    };
  }

  async simulasiHitung(produkID, hargaCustom, tenantID) {
    const produkPajakService = require("./produkPajakService");
    const listPajakRelasi = await produkPajakService.getPajakByProduk(
      produkID,
      tenantID
    );

    if (!listPajakRelasi || listPajakRelasi.length === 0) {
      return {
        hargaAwal: hargaCustom,
        totalPajak: 0,
        grandTotal: hargaCustom,
        rincian: [],
      };
    }

    const pajakMurni = listPajakRelasi
      .map((item) => item.pajakID)
      .filter((item) => item && item.tipePajak === "Per Produk");

    return this.#calculateTaxLogic(hargaCustom, pajakMurni);
  }

  async create(payload) {
    try {
      return await Pajak.create(payload);
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  async getAll(tenantID) {
    return await Pajak.find({ tenantID })
      .sort({ prioritas: 1, createdAt: 1 })
      .lean();
  }

  async getById(id, tenantID) {
    const pajak = await Pajak.findOne({ _id: id, tenantID }).lean();

    if (!pajak) {
      throw createError(404, "Data pajak tidak ditemukan.");
    }

    return pajak;
  }

  async update(id, tenantID, payload) {
    try {
      const updated = await Pajak.findOneAndUpdate(
        { _id: id, tenantID },
        { $set: payload },
        { new: true, runValidators: true }
      ).lean();

      if (!updated) {
        throw createError(404, "Data tidak ditemukan.");
      }

      if (payload.namaPajak) {
        const ProdukPajak = require("../models/produkPajakModel");

        await ProdukPajak.updateMany(
          { pajakID: id, tenantID },
          { $set: { namaPajak: payload.namaPajak } }
        );
      }

      return updated;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  async delete(id, tenantID) {
    const deleted = await Pajak.findOneAndDelete({ _id: id, tenantID });

    if (!deleted) {
      throw createError(404, "Data tidak ditemukan.");
    }

    return { message: "Pajak berhasil dihapus." };
  }
}

module.exports = new PajakService();