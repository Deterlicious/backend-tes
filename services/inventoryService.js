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
    const { lokasiId, kategori, search } = query;

    // 1. Cek Cache (Hanya untuk view "All" tanpa filter)
    const isFiltered = lokasiId || kategori || search;
    if (!isFiltered) {
      const cache = await redis.get(this.#KEY_LIST(tenantID));
      if (cache) return JSON.parse(cache);
    }

    // 2. Membangun Filter Query (Akses dibuka untuk Owner/Testing)
    let filter = { tenantID };

    // Jika ada lokasiId dari query, gunakan. Jika tidak, ambil semua lokasi (Owner View)
    if (lokasiId) {
      filter.locationID = lokasiId;
    }

    // 3. Eksekusi Query dengan Populate dan Match Kategori
    let data = await Inventory.find(filter)
      .populate({
        path: "bahanBakuID",
        select: "namaBahan satuan kategori",
        // Filter kategori dilakukan di level database melalui match
        match: kategori ? { kategori: kategori } : {},
      })
      .populate("locationID", "nama tipe")
      .sort({ createdAt: -1 })
      .lean(); // Menggunakan lean agar performa filtering manual lebih cepat

    // 4. Post-Filtering: Membersihkan data yang tidak match kategori
    // Mongoose tetap mengembalikan parent (Inventory) meski child (BahanBaku) null jika tidak match
    data = data.filter((item) => item.bahanBakuID !== null);

    // 5. Post-Filtering: Pencarian Nama Bahan
    if (search) {
      const searchRegex = new RegExp(search, "i");
      data = data.filter((item) =>
        searchRegex.test(item.bahanBakuID.namaBahan),
      );
    }

    // 6. Simpan Cache hanya untuk data "mentah"
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
    // 'user' di sini adalah req.pengguna dari controller
    const { tenantID, _id: userID } = user;

    const inventory = await Inventory.findOne({ _id: id, tenantID });
    if (!inventory) throw new Error("Data stok tidak ditemukan");

    const stokLama = inventory.stok;
    const delta = fisikAktual - stokLama;

    // 1. Update stok di Inventory
    inventory.stok = fisikAktual;
    await inventory.save();

    // 2. Buat JurnalStok sesuai skema kamu
    await JurnalStok.create({
      bahanBakuID: inventory.bahanBakuID,
      tanggal: new Date(),
      tipeKoreksi: delta > 0 ? "Masuk" : "Keluar",
      jumlah: Math.abs(delta), // Sesuai aturan min: 1 di skema kamu
      alasan: "Stok Opname", // Sesuaikan dengan ENUM: "Stok Opname", "Rusak/Hilang", dll
      keterangan: catatan || "Koreksi stok fisik",
      dicatatOleh: userID, // Gunakan userID dari parameter user
      locationID: inventory.locationID,
      tenantID: tenantID,
    });

    // 3. Clear Cache
    await redis.del(`inventory:list:${tenantID}`);

    return inventory;
  }

  async updateMinimumStok(id, payload, user) {
    const { stokMinimum } = payload;
    const { tenantID } = user;

    // Pastikan angka tidak negatif sesuai aturan bisnis
    if (stokMinimum < 0) throw new Error("Stok minimum tidak boleh negatif");

    const inventory = await Inventory.findOneAndUpdate(
      { _id: id, tenantID },
      { stokMinimum },
      { new: true },
    );

    if (!inventory) throw new Error("Data stok tidak ditemukan");

    // Hapus cache agar UI Frontend langsung melihat perubahan warna indikator
    await redis.del(`inventory:list:${tenantID}`);

    return inventory;
  }

  async decreaseStok(id, qty, user) {
    const { tenantID } = user;

    // Mencari inventory yang stoknya CUKUP ($gte: qty)
    const inventory = await Inventory.findOneAndUpdate(
      {
        _id: id,
        tenantID,
        stok: { $gte: qty }, // Guard: Stok di DB harus >= qty yang diminta
      },
      { $inc: { stok: -qty } }, // Kurangi stok
      { new: true },
    );

    if (!inventory) {
      // Jika tidak ditemukan, berarti stok tidak cukup
      throw new Error("Stok tidak mencukupi untuk melakukan transaksi ini");
    }

    // Hapus cache agar UI Dashboard sinkron
    await redis.del(`inventory:list:${tenantID}`);

    return inventory;
  }

  async processSaleStock(produkID, qtyJual, lokasiID, tenantID, userID) {
    // 1. Ambil data produk & resep (Lean agar cepat)
    const produk = await Produk.findOne({ _id: produkID, tenantID }).lean();
    if (!produk) throw new Error("Produk tidak ditemukan");

    // Proteksi Input
    if (!produkID || !lokasiID || !tenantID || !userID) {
      throw new Error(
        "Data transaksi tidak lengkap (ID Produk/Lokasi/Tenant/User wajib ada)",
      );
    }

    if (qtyJual <= 0) {
      throw new Error("Jumlah penjualan harus lebih dari 0");
    }

    // 2. Update Stok Produk (Field stok di tabel Produk)
    // Gunakan $gte: qtyJual agar stok produk tidak jadi minus
    const updatedProduk = await Produk.findOneAndUpdate(
      { _id: produkID, tenantID, stok: { $gte: qtyJual } },
      { $inc: { stok: -qtyJual } },
      { new: true },
    );

    if (!updatedProduk) {
      throw new Error("Stok porsi produk tidak mencukupi");
    }

    // 3. Update Bahan Baku di Inventory (Jika ada resep)
    if (produk.resep && produk.resep.length > 0) {
      try {
        for (const item of produk.resep) {
          const totalButuh = item.jumlah * qtyJual;

          // Update Inventory Outlet secara Atomic
          const inv = await Inventory.findOneAndUpdate(
            {
              bahanBakuID: item.bahanBakuID,
              locationID: lokasiID,
              tenantID: tenantID, // Pastikan tenantID ikut terkunci
              stok: { $gte: totalButuh },
            },
            { $inc: { stok: -totalButuh } },
            { new: true },
          );

          // JIKA BAHAN BAKU TIDAK CUKUP
          if (!inv) {
            throw new Error(`Bahan baku tidak mencukupi untuk lokasi ini`);
          }

          // 4. Catat ke JurnalStok untuk Laporan Owner
          await JurnalStok.create({
            bahanBakuID: item.bahanBakuID,
            locationID: lokasiID,
            jumlah: totalButuh,
            tipeKoreksi: "Keluar",
            // Pastikan string ini ada di ENUM model JurnalStok kamu
            alasan: "Lainnya",
            keterangan: `Penjualan ${produk.namaProduk} x${qtyJual}`,
            dicatatOleh: userID,
            tenantID: tenantID,
            tanggal: new Date(),
          });
        }
      } catch (error) {
        // --- MANUAL ROLLBACK ---
        // Jika salah satu bahan gagal di tengah jalan, kembalikan stok Produk yang tadi dipotong
        await Produk.findOneAndUpdate(
          { _id: produkID, tenantID },
          { $inc: { stok: qtyJual } },
        );

        // Lempar kembali error-nya agar ditangkap oleh Controller atau Jest
        throw error;
      }
    }

    // Bersihkan cache agar Dashboard Owner terupdate
    if (redis.del) {
      await redis.del(`inventory:list:${tenantID}`);
    }

    return updatedProduk;
  }
}

module.exports = new InventoryService();
