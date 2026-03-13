const Pajak = require("../models/pajakModel");
const createError = require("http-errors");
const redis = require("../config/redis");

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
      (a, b) => (a.prioritas || 0) - (b.prioritas || 0),
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

  // FUNGSI 1: Khusus Pajak Per Produk (Item Level)
  async hitungPajakProduk(produkID, hargaCustom, tenantID) {
    const produkPajakService = require("./produkPajakService");

    // 1. Ambil data relasi dari tabel produkpajaks
    const listPajakRelasi = await produkPajakService.getPajakByProduk(
      produkID,
      tenantID,
    );

    if (!listPajakRelasi || listPajakRelasi.length === 0) {
      return this.#calculateTaxLogic(hargaCustom, []);
    }

    // 2. Ekstrak ID menggunakan nama variabel pajakID agar konsisten dengan model
    const pajakID = listPajakRelasi
      .map((item) => (item.pajak ? item.pajak._id : null))
      .filter((id) => id);

    // 3. Ambil data asli dari Master Pajak
    const pajakMurni = await Pajak.find({
      _id: { $in: pajakID }, // Menggunakan variabel pajakID
      tenantID: tenantID,
      tipePajak: true,
      statusPajak: true,
    })
      .sort({ prioritas: 1 })
      .lean();

    // 4. Jalankan kalkulasi
    return this.#calculateTaxLogic(hargaCustom, pajakMurni);
  }

  // FUNGSI: Khusus Pajak Per Transaksi (Summary Level)
  async hitungPajakTransaksi(subtotal, tenantID) {
    // PROTEKSI: Selalu gunakan limit(1) untuk menjamin aturan "1 Transaksi 1 Pajak"
    const pajakTransaksi = await Pajak.find({
      tenantID,
      tipePajak: false,
      statusPajak: true,
    })
      .sort({ updatedAt: -1 }) // Ambil yang paling baru diaktifkan
      .limit(1)
      .lean();

    if (!pajakTransaksi.length) return this.#calculateTaxLogic(subtotal, []);

    return this.#calculateTaxLogic(subtotal, pajakTransaksi);
  }

  async create(payload) {
    try {
      // AUTO-SWITCH SAAT CREATE
      if (payload.tipePajak === false && payload.statusPajak === true) {
        await Pajak.updateMany(
          { tenantID: payload.tenantID, tipePajak: false },
          { $set: { statusPajak: false } },
        );
      }
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
      // AUTO-SWITCH SAAT UPDATE
      // Kita cek jika statusPajak dikirim sebagai true
      if (payload.statusPajak === true) {
        // Ambil data asli untuk memastikan apakah ini tipe transaksi (false)
        const dataLama = await Pajak.findOne({ _id: id, tenantID });

        // Jika di payload tipePajak adalah false, ATAU di database tipePajak-nya false
        const isTipeTransaksi =
          payload.tipePajak === false ||
          (dataLama && dataLama.tipePajak === false);

        if (isTipeTransaksi) {
          await Pajak.updateMany(
            { tenantID, tipePajak: false, _id: { $ne: id } },
            { $set: { statusPajak: false } },
          );
        }
      }

      const updated = await Pajak.findOneAndUpdate(
        { _id: id, tenantID },
        { $set: payload },
        { new: true, runValidators: true },
      ).lean();

      // ... rest of code (redis del, etc)
      return updated;
    } catch (error) {
      throw this.#handleDbError(error);
    }
  }

  async delete(id, tenantID) {
    const deleted = await Pajak.findOneAndDelete({ _id: id, tenantID });
    if (!deleted) throw createError(404, "Data tidak ditemukan.");

    // Hapus semua relasi yang menggantung di ProdukPajak
    const ProdukPajak = require("../models/produkPajakModel");
    await ProdukPajak.deleteMany({ pajakID: id, tenantID });

    // Bersihkan cache produk agar pajak yang dihapus hilang dari list produk
    await redis.del(`produk:list:${tenantID}`);

    return { message: "Pajak berhasil dihapus." };
  }
}

module.exports = new PajakService();
