const Inventory = require("../models/inventoryModel");
const createError = require("http-errors");
const redis = require("../config/redis");
const JurnalStok = require("../models/jurnalStokModel");
const Produk = require("../models/produkModel");

class InventoryService {
  #KEY_LIST(tenantID) {
    return `inventory:list:${tenantID}`;
  }
  #KEY_DETAIL(id) {
    return `inventory:detail:${id}`;
  }

  async create(payload) {
    const data = await Inventory.create(payload);
    await redis.del(this.#KEY_LIST(payload.tenantID));
    return data;
  }

  async getAll(query, user) {
    const { tenantID } = user;
    // Konsistensi: Hanya menggunakan locationID sesuai nama field di Model
    const { locationID, kategori, search } = query;

    // 1. Cek Cache (Hanya untuk view tanpa filter)
    const isFiltered = locationID || kategori || search;
    if (!isFiltered) {
      const cache = await redis.get(this.#KEY_LIST(tenantID));
      if (cache) return JSON.parse(cache);
    }

    // 2. Membangun Filter Query
    let filter = { tenantID };

    if (locationID) {
      filter.locationID = locationID;
    }

    // 3. Eksekusi Query
    let data = await Inventory.find(filter)
      .populate({
        path: "bahanBakuID",
        select: "namaBahan satuan kategori",
        match: kategori ? { kategori: kategori } : {},
      })
      .populate("barangInventoryID", "namaBarang tipe satuan")
      .populate("locationID", "nama tipe")
      .sort({ createdAt: -1 })
      .lean();

    // 4. Post-Filtering: Membersihkan data item yang referensinya sudah hilang.
    data = data.filter((item) => {
      if (kategori) return item.bahanBakuID !== null;
      return item.bahanBakuID !== null || item.barangInventoryID !== null;
    });

    // 5. Post-Filtering: Pencarian Nama Bahan
    if (search) {
      const searchRegex = new RegExp(search, "i");
      data = data.filter((item) => {
        const namaBahan = item.bahanBakuID?.namaBahan || "";
        const namaBarang = item.barangInventoryID?.namaBarang || "";
        return searchRegex.test(namaBahan) || searchRegex.test(namaBarang);
      });
    }

    // 6. Simpan Cache
    if (!isFiltered && data.length > 0) {
      await redis.set(
        this.#KEY_LIST(tenantID),
        JSON.stringify(data),
        "EX",
        3600,
      );
    }

    return data;
  }

  async getById(id, tenantID) {
    const cache = await redis.get(this.#KEY_DETAIL(id));
    if (cache) return JSON.parse(cache);

    const data = await Inventory.findOne({ _id: id, tenantID })
      .populate("bahanBakuID", "namaBahan satuan")
      .populate("barangInventoryID", "namaBarang tipe satuan")
      .populate("locationID", "nama tipe");

    if (!data) throw createError(404, "Data inventory tidak ditemukan.");

    await redis.set(this.#KEY_DETAIL(id), JSON.stringify(data), "EX", 3600);
    return data;
  }

  async update(id, tenantID, payload) {
    const updated = await Inventory.findOneAndUpdate(
      { _id: id, tenantID },
      { $set: payload },
      { new: true, runValidators: true },
    );
    if (!updated) throw createError(404, "Data inventory tidak ditemukan.");

    await redis.del(this.#KEY_LIST(tenantID));
    await redis.del(this.#KEY_DETAIL(id));
    return updated;
  }

  async delete(id, tenantID) {
    const deleted = await Inventory.findOneAndDelete({ _id: id, tenantID });
    if (!deleted) throw createError(404, "Data inventory tidak ditemukan.");

    await redis.del(this.#KEY_LIST(tenantID));
    await redis.del(this.#KEY_DETAIL(id));
    return deleted;
  }

  async submitOpname(id, payload, user) {
    const { fisikAktual, catatan } = payload;
    const { tenantID, _id: userID } = user;

    const inventory = await Inventory.findOne({ _id: id, tenantID });
    if (!inventory) throw createError(404, "Data stok tidak ditemukan");

    const stokLama = inventory.stok;
    const delta = fisikAktual - stokLama;

    inventory.stok = fisikAktual;
    await inventory.save();

    await JurnalStok.create({
      bahanBakuID: inventory.bahanBakuID,
      tanggal: new Date(),
      tipeKoreksi: delta > 0 ? "Masuk" : "Keluar",
      jumlah: Math.abs(delta),
      alasan: "Stok Opname",
      keterangan: catatan || "Koreksi stok fisik",
      dicatatOleh: userID,
      locationID: inventory.locationID, // Konsisten menggunakan field model
      tenantID: tenantID,
    });

    await redis.del(this.#KEY_LIST(tenantID));
    return inventory;
  }

  async updateMinimumStok(id, payload, user) {
    const { stokMinimum } = payload;
    const { tenantID } = user;

    if (stokMinimum < 0)
      throw createError(400, "Stok minimum tidak boleh negatif");

    const inventory = await Inventory.findOneAndUpdate(
      { _id: id, tenantID },
      { stokMinimum },
      { new: true },
    );

    if (!inventory) throw createError(404, "Data stok tidak ditemukan");

    await redis.del(this.#KEY_LIST(tenantID));
    return inventory;
  }

  async decreaseStok(id, qty, user) {
    const { tenantID } = user;

    const inventory = await Inventory.findOneAndUpdate(
      {
        _id: id,
        tenantID,
        stok: { $gte: qty },
      },
      { $inc: { stok: -qty } },
      { new: true },
    );

    if (!inventory) {
      throw createError(
        400,
        "Stok tidak mencukupi untuk melakukan transaksi ini",
      );
    }

    await redis.del(this.#KEY_LIST(tenantID));
    return inventory;
  }

  async processSaleStock(produkID, qtyJual, locationID, tenantID, userID) {
    // Parameter diganti menjadi locationID agar konsisten dengan tim FE
    if (!produkID || !locationID || !tenantID || !userID) {
      throw createError(
        400,
        "Data transaksi tidak lengkap (ID Produk/Location/Tenant/User wajib ada)",
      );
    }

    if (qtyJual <= 0)
      throw createError(400, "Jumlah penjualan harus lebih dari 0");

    const produk = await Produk.findOne({ _id: produkID, tenantID }).lean();
    if (!produk) throw createError(404, "Produk tidak ditemukan");

    const updatedProduk = await Produk.findOneAndUpdate(
      { _id: produkID, tenantID, stok: { $gte: qtyJual } },
      { $inc: { stok: -qtyJual } },
      { new: true },
    );

    if (!updatedProduk)
      throw createError(400, "Stok porsi produk tidak mencukupi");

    if (produk.resep && produk.resep.length > 0) {
      try {
        for (const item of produk.resep) {
          const totalButuh = item.jumlah * qtyJual;

          const inv = await Inventory.findOneAndUpdate(
            {
              bahanBakuID: item.bahanBakuID,
              locationID: locationID, // Konsisten
              tenantID: tenantID,
              stok: { $gte: totalButuh },
            },
            { $inc: { stok: -totalButuh } },
            { new: true },
          );

          if (!inv)
            throw createError(
              400,
              `Bahan baku ${item.bahanBakuID} tidak mencukupi`,
            );

          await JurnalStok.create({
            bahanBakuID: item.bahanBakuID,
            locationID: locationID, // Konsisten
            jumlah: totalButuh,
            tipeKoreksi: "Keluar",
            alasan: "Lainnya",
            keterangan: `Penjualan ${produk.namaProduk} x${qtyJual}`,
            dicatatOleh: userID,
            tenantID: tenantID,
            tanggal: new Date(),
          });
        }
      } catch (error) {
        // Rollback stok produk
        await Produk.findOneAndUpdate(
          { _id: produkID, tenantID },
          { $inc: { stok: qtyJual } },
        );
        throw error;
      }
    }

    await redis.del(this.#KEY_LIST(tenantID));
    return updatedProduk;
  }
}

module.exports = new InventoryService();
