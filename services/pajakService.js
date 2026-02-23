const Pajak = require("../models/pajakModel");
const redis = require("../config/redis");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `pajak:list:${tenantID}`;
const KEY_DETAIL = (id) => `pajak:detail:${id}`;

class PajakService {
  #handleDbError(error) {
    if (error.code === 11000)
      return createError(400, "Nama pajak sudah digunakan.");
    if (error.name === "ValidationError")
      return createError(400, Object.values(error.errors)[0].message);
    return createError(500, error.message);
  }

  #calculateTaxLogic(hargaDasar, listPajak) {
    // 1. FILTER: Pastikan pajakID benar-benar ada (tidak null/undefined)
    // Kita filter dulu listPajak yang dikirim dari simulasiHitung
    const validPajak = listPajak.filter((item) => item != null);

    if (validPajak.length === 0) {
      return {
        hargaAwal: hargaDasar,
        totalPajak: 0,
        grandTotal: hargaDasar,
        rincian: [],
      };
    }

    // 2. SORT: Urutkan berdasarkan prioritas (1 paling dulu)
    // Gunakan variabel ini sekali saja.
    const sortedPajak = [...validPajak].sort(
      (a, b) => (a.prioritas || 0) - (b.prioritas || 0),
    );

    let totalPajak = 0;
    let runningTotal = hargaDasar;
    const rincian = [];

    // 3. LOGIKA HITUNG
    sortedPajak.forEach((p) => {
      let nilaiPajakPerItem = 0;

      // --- LOGIKA HITUNG BERDASARKAN MODEL ---
      if (p.modelPerhitungan === 1) {
        // Inclusive
        nilaiPajakPerItem =
          (runningTotal / (1 + p.tarifPajak / 100)) * (p.tarifPajak / 100);
      } else if (p.modelPerhitungan === 2) {
        // Exclusive
        nilaiPajakPerItem = hargaDasar * (p.tarifPajak / 100);
        runningTotal += nilaiPajakPerItem;
      } else if (p.modelPerhitungan === 3) {
        // Compound
        nilaiPajakPerItem = runningTotal * (p.tarifPajak / 100);
        runningTotal += nilaiPajakPerItem;
      }

      totalPajak += nilaiPajakPerItem;

      rincian.push({
        pajakID: p._id,
        namaPajak: p.namaPajak,
        tarif: p.tarifPajak,
        tipe: p.tipePajak,
        prioritas: p.prioritas,
        model:
          p.modelPerhitungan === 1
            ? "Inclusive"
            : p.modelPerhitungan === 2
              ? "Exclusive"
              : "Compound",
        jumlah: Math.round(nilaiPajakPerItem),
      });
    });

    return {
      hargaAwal: hargaDasar,
      totalPajak: Math.round(totalPajak),
      grandTotal: Math.round(runningTotal),
      rincian,
    };
  }

  async simulasiHitung(produkID, hargaCustom, tenantID) {
    const produkPajakService = require("./produkPajakService");
    const listPajakRelasi = await produkPajakService.getPajakByProduk(
      produkID,
      tenantID,
    );

    // Cek jika listPajakRelasi kosong sebelum akses index [0] untuk menghindari error
    if (!listPajakRelasi || listPajakRelasi.length === 0) {
      return {
        hargaAwal: hargaCustom,
        totalPajak: 0,
        grandTotal: hargaCustom,
        rincian: [],
      };
    }

    console.log(
      "Model Perhitungan yang terbaca:",
      listPajakRelasi[0].pajakID?.modelPerhitungan,
    );

    // Ambil data pajak asli dari hasil populate (item.pajakID)
    const pajakMurni = listPajakRelasi.map((item) => item.pajakID);

    return this.#calculateTaxLogic(hargaCustom, pajakMurni);
  }

  async #clearCache(id, tenantID) {
    if (id) await redis.del(KEY_DETAIL(id));
    if (tenantID) await redis.del(KEY_LIST(tenantID));
  }

  async create(payload) {
    try {
      const pajak = await Pajak.create(payload);
      await this.#clearCache(null, payload.tenantID);
      return pajak;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  async getAll(tenantID) {
    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    const data = await Pajak.find({ tenantID }).sort({ prioritas: 1 }).lean();
    await redis.set(KEY_LIST(tenantID), JSON.stringify(data), "EX", 300);
    return data;
  }

  async getById(id, tenantID) {
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
      const data = JSON.parse(cached);
      if (data.tenantID.toString() !== tenantID.toString())
        throw createError(403, "Akses dilarang.");
      return data;
    }

    const pajak = await Pajak.findOne({ _id: id, tenantID }).lean();
    if (!pajak) throw createError(404, "Data pajak tidak ditemukan.");

    await redis.set(KEY_DETAIL(id), JSON.stringify(pajak), "EX", 600);
    return pajak;
  }

  async update(id, tenantID, payload) {
    try {
      const updated = await Pajak.findOneAndUpdate(
        { _id: id, tenantID },
        { $set: payload },
        { new: true, runValidators: true },
      ).lean();

      if (!updated) throw createError(404, "Data tidak ditemukan.");

      // Sync nama pajak ke tabel relasi jika nama berubah
      if (payload.namaPajak) {
        const ProdukPajak = require("../models/produkPajakModel");
        await ProdukPajak.updateMany(
          { pajakID: id },
          { $set: { namaPajak: payload.namaPajak } },
        );
      }

      await this.#clearCache(id, tenantID);
      return updated;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  async delete(id, tenantID) {
    const deleted = await Pajak.findOneAndDelete({ _id: id, tenantID });
    if (!deleted) throw createError(404, "Data tidak ditemukan.");
    await this.#clearCache(id, tenantID);
    return { message: "Pajak berhasil dihapus." };
  }
}

module.exports = new PajakService();
