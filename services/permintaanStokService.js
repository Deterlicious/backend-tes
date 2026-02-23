const PermintaanStok = require("../models/permintaanStokModel");
const Inventory = require("../models/inventoryModel");
const createError = require("http-errors");
const redis = require("../config/redis");

class PermintaanStokService {
  #KEY_LIST(tenantID) {
    return `permintaanStok:list:${tenantID}`;
  }

  // FUNGSI INTI: Semua perubahan status lewat sini
  async #changeStatus(id, tenantID, nextStatus, requestedBy) {
    const data = await PermintaanStok.findOne({ _id: id, tenantID });
    if (!data) throw createError(404, "Data tidak ditemukan");

    // Validasi sederhana: Jangan pindahkan stok jika sudah COMPLETED
    if (data.status === "COMPLETED")
      throw createError(400, "Transaksi sudah selesai.");

    // LOGIKA MUTASI STOK: Hanya jalan jika status menjadi COMPLETED
    if (nextStatus === "COMPLETED") {
      for (const item of data.items) {
        // Kurangi asal, Tambah tujuan
        await Inventory.findOneAndUpdate(
          {
            bahanBakuID: item.bahanBakuID,
            locationID: data.dariLocationID,
            tenantID,
          },
          { $inc: { stok: -item.jumlah } },
        );
        await Inventory.findOneAndUpdate(
          {
            bahanBakuID: item.bahanBakuID,
            locationID: data.keLocationID,
            tenantID,
          },
          { $inc: { stok: item.jumlah } },
          { upsert: true },
        );
      }
      await redis.del(`inventory:list:${tenantID}`);
    }

    data.status = nextStatus;
    await data.save();
    await redis.del(this.#KEY_LIST(tenantID));
    return data;
  }

  // Wrapper fungsi agar Controller tetap terlihat rapi dan spesifik
  async create(payload) {
    // Logika Penomoran Otomatis: REQ/YYYYMM/Counter
    if (!payload.nomorRequest) {
      const date = new Date();
      const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}`;

      // Mencari dokumen terakhir di bulan yang sama untuk menentukan urutan (counter)
      const lastDoc = await PermintaanStok.findOne({
        nomorRequest: new RegExp(`REQ/${yearMonth}/`),
      }).sort({ createdAt: -1 });

      let counter = 1;
      if (lastDoc) {
        const lastCounter = parseInt(lastDoc.nomorRequest.split("/")[2]);
        counter = lastCounter + 1;
      }

      payload.nomorRequest = `REQ/${yearMonth}/${counter.toString().padStart(4, "0")}`;
    }

    const data = await PermintaanStok.create(payload);
    await redis.del(this.#KEY_LIST(payload.tenantID));
    return data;
  }
  async getAll(tenantID) {
    /* Logic GET seperti biasa dengan Redis */
  }

  // Fungsi yang dipanggil oleh berbagai endpoint action
  async submit(id, tenantID) {
    return this.#changeStatus(id, tenantID, "SUBMITTED");
  }
  async approve(id, tenantID) {
    const data = await PermintaanStok.findOne({ _id: id, tenantID });
    if (!data) throw createError(404, "Data permintaan tidak ditemukan.");
    if (data.status === "COMPLETED")
      throw createError(400, "Permintaan sudah selesai diproses.");

    // --- STEP BY STEP VALIDASI STOK ---
    for (const item of data.items) {
      // 1. Cari data stok di lokasi asal (Gudang)
      const invAsal = await Inventory.findOne({
        bahanBakuID: item.bahanBakuID,
        locationID: data.dariLocationID,
        tenantID,
      });

      // 2. Cek apakah record inventory ada ATAU stoknya kurang dari yang diminta
      if (!invAsal || invAsal.stok < item.jumlah) {
        // Ambil nama bahan baku untuk pesan error yang lebih informatif (opsional tapi matang)
        throw createError(
          400,
          `Stok tidak mencukupi. Sisa stok di lokasi asal hanya ${invAsal ? invAsal.stok : 0}`,
        );
      }
    }
    // --- AKHIR VALIDASI STOK ---

    // Jika semua item lolos validasi, baru jalankan mutasi
    for (const item of data.items) {
      // Kurangi stok asal
      await Inventory.findOneAndUpdate(
        {
          bahanBakuID: item.bahanBakuID,
          locationID: data.dariLocationID,
          tenantID,
        },
        { $inc: { stok: -item.jumlah } },
      );
      // Tambah/Update stok tujuan
      await Inventory.findOneAndUpdate(
        {
          bahanBakuID: item.bahanBakuID,
          locationID: data.keLocationID,
          tenantID,
        },
        { $inc: { stok: item.jumlah } },
        { upsert: true },
      );
    }

    data.status = "COMPLETED";
    await data.save();

    // Invalidate Redis agar data inventory di dashboard langsung terupdate
    await redis.del(`inventory:list:${tenantID}`);
    await redis.del(this.#KEY_LIST(tenantID));

    return data;
  } // Langsung mutasi di MVP
  async reject(id, tenantID) {
    return this.#changeStatus(id, tenantID, "REJECTED");
  }
}

module.exports = new PermintaanStokService();
