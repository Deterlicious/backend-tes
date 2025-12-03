const Produk = require("../models/produkModel");
const BahanBaku = require("../models/bahanBakuModel");
const redis = require("../config/redis");
const { validateProdukPayload } = require("../validators/produkValidator");
const { toBaseUnit } = require("../utils/unitConverter");
const createError = require("http-errors");

// CACHE KEYS
const CACHE_KEY_LIST = (tenantID) => `produk:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `produk:detail:${id}`;

class ProdukService {
  // HELPER INTERNAL: Hitung Stok Berdasarkan Resep
  async calculatePotentialStock(resep, tenantID) {
    if (!resep || resep.length === 0) return 0;

    // Ambil ID semua bahan baku di resep
    const bahanIds = resep.map((r) => r.bahanBakuID);

    // Ambil data bahan baku dari DB (Stok saat ini)
    const bahanBakuList = await BahanBaku.find({
      _id: { $in: bahanIds },
      tenantID: tenantID,
    }).lean();

    // Buat map biar gampang akses
    const bahanMap = {};
    bahanBakuList.forEach((b) => {
      bahanMap[b._id.toString()] = b;
    });

    let minStock = Infinity; // Set nilai awal tak terhingga

    // Iterasi resep untuk cari 'Limiting Reagent'
    for (const item of resep) {
      const bahanDb = bahanMap[item.bahanBakuID.toString()];

      if (!bahanDb) {
        // Jika bahan baku hilang dari DB, stok produk otomatis 0
        return 0;
      }

      try {
        // Konversi stok tersedia di gudang ke unit dasar (misal kg -> gram)
        const stokTersedia = toBaseUnit(bahanDb.stok, bahanDb.satuan);

        // Konversi kebutuhan resep ke unit dasar
        const kebutuhanResep = toBaseUnit(item.jumlah, item.satuan);

        if (kebutuhanResep === 0) continue; // Hindari pembagian dengan 0

        // Berapa porsi yang bisa dibuat dari bahan ini?
        const porsiBisaDibuat = Math.floor(stokTersedia / kebutuhanResep);

        // Update nilai minimal
        if (porsiBisaDibuat < minStock) {
          minStock = porsiBisaDibuat;
        }
      } catch (error) {
        // Jika satuan tidak kompatibel (misal kg vs liter), lempar error
        throw createError(
          400,
          `Konversi unit gagal pada bahan: ${bahanDb.namaBahan}. Pastikan satuan kompatibel.`
        );
      }
    }

    return minStock === Infinity ? 0 : minStock;
  }

  async syncStockByBahan(bahanBakuID, tenantID) {
    // Cari semua produk yang menggunakan bahan baku ini
    const affectedProducts = await Produk.find({
      tenantID: tenantID,
      "resep.bahanBakuID": bahanBakuID,
    });

    if (affectedProducts.length === 0) return;

    // Loop setiap produk dan hitung ulang stoknya dengan Promise.all agar berjalan paralel (cepat)
    await Promise.all(
      affectedProducts.map(async (produk) => {
        const newStock = await this.calculatePotentialStock(
          produk.resep,
          tenantID
        );

        // Update stok di DB
        await Produk.findByIdAndUpdate(produk._id, { stok: newStock });
        
        // Update cache detail produk
        await redis.del(CACHE_KEY_DETAIL(produk._id));
      })
    );

    // Hapus cache list agar data di frontend fresh
    await redis.del(CACHE_KEY_LIST(tenantID));
    
    console.log(`🔄 Stok ${affectedProducts.length} produk telah disinkronisasi.`);
  }

  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const produk = await Produk.find({ tenantID })
      .populate("kategoriID", "namaKategori")
      .populate("resep.bahanBakuID", "namaBahan satuan")
      .sort({ namaProduk: 1 })
      .lean();

    if (produk.length > 0) {
      await redis.set(key, JSON.stringify(produk), "EX", 120);
    }

    return produk;
  }

  async getById(id) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const produk = await Produk.findById(id)
      .populate("kategoriID", "namaKategori")
      .populate("resep.bahanBakuID", "namaBahan satuan")
      .lean();

    if (!produk) return null;

    await redis.set(key, JSON.stringify(produk), "EX", 120);
    return produk;
  }

  async create(payload) {
    const validation = validateProdukPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      // ✅ LOGIKA BARU: Abaikan input stok manual, hitung otomatis
      if (payload.resep && payload.resep.length > 0) {
        payload.stok = await this.calculatePotentialStock(
          payload.resep,
          payload.tenantID
        );
      } else {
        // Jika tidak ada resep (misal produk jadi), gunakan stok manual atau default 0
        payload.stok = payload.stok || 0;
      }

      const produk = await Produk.create(payload);
      await redis.del(CACHE_KEY_LIST(payload.tenantID));
      return produk;
    } catch (err) {
      if (err.code === 11000)
        return { error: ["Nama produk sudah ada di tenant ini"] };
      throw err;
    }
  }

  async update(id, payload) {
    const validation = validateProdukPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;

    try {
      // Hitung ulang stok saat update
      const existingProduk = await Produk.findById(id).lean();
      if (!existingProduk) return null;

      // Gunakan resep baru jika ada, atau pakai resep lama
      const resepFinal = payload.resep ? payload.resep : existingProduk.resep;

      if (resepFinal && resepFinal.length > 0) {
        payload.stok = await this.calculatePotentialStock(
          resepFinal,
          existingProduk.tenantID
        );
      }

      const updated = await Produk.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      }).lean();

      if (!updated) return null;

      await redis.del(CACHE_KEY_LIST(updated.tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      return updated;
    } catch (err) {
      if (err.code === 11000) return { error: ["Nama produk sudah digunakan"] };
      throw err;
    }
  }

  async delete(id) {
    const target = await Produk.findById(id).lean();
    if (!target) return null;

    await Produk.deleteOne({ _id: id });
    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));
    return true;
  }
}

module.exports = new ProdukService();
