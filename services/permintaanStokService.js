const PermintaanStok = require("../models/permintaanStokModel");
const Inventory = require("../models/inventoryModel");
const JurnalStok = require("../models/jurnalStokModel"); // Tambahkan ini
const createError = require("http-errors");
const redis = require("../config/redis");

class PermintaanStokService {
  #KEY_LIST(tenantID) {
    return `permintaanStok:list:${tenantID}`;
  }

  async create(payload) {
    // Logika Penomoran Otomatis tetap di sini
    if (!payload.nomorRequest) {
      const date = new Date();
      const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}`;
      const lastDoc = await PermintaanStok.findOne({
        nomorRequest: new RegExp(`REQ/${yearMonth}/`),
      })
        .sort({ createdAt: -1 })
        .lean();

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

  async approve(id, tenantID, userID) {
    const data = await PermintaanStok.findOne({ _id: id, tenantID });
    if (!data) throw createError(404, "Data permintaan tidak ditemukan.");
    if (data.status !== "SUBMITTED")
      throw createError(
        400,
        "Hanya permintaan dengan status SUBMITTED yang bisa disetujui.",
      );

    // --- 1. VALIDASI STOK ASAL (GUDANG) ---
    for (const item of data.items) {
      const invAsal = await Inventory.findOne({
        bahanBakuID: item.bahanBakuID,
        locationID: data.dariLocationID,
        tenantID,
      });

      if (!invAsal || invAsal.stok < item.jumlah) {
        throw createError(
          400,
          `Stok bahan baku ID ${item.bahanBakuID} tidak mencukupi di lokasi asal.`,
        );
      }
    }

    // --- 2. EKSEKUSI MUTASI & PENCATATAN JURNAL ---
    for (const item of data.items) {
      // A. Kurangi Stok Asal (Gudang)
      await Inventory.findOneAndUpdate(
        {
          bahanBakuID: item.bahanBakuID,
          locationID: data.dariLocationID,
          tenantID,
        },
        { $inc: { stok: -item.jumlah } },
      );

      // B. Tambah Stok Tujuan (Outlet)
      await Inventory.findOneAndUpdate(
        {
          bahanBakuID: item.bahanBakuID,
          locationID: data.keLocationID,
          tenantID,
        },
        { $inc: { stok: item.jumlah } },
        { upsert: true },
      );

      // C. Catat Jurnal Stok (Keluar dari Gudang)
      await JurnalStok.create({
        bahanBakuID: item.bahanBakuID,
        locationID: data.dariLocationID,
        jumlah: item.jumlah,
        tipeKoreksi: "Keluar",
        alasan: "Transfer Gudang", // Enum dari model kamu
        keterangan: `Kirim ke Outlet via ${data.nomorRequest}`,
        dicatatOleh: userID,
        tenantID,
        tanggal: new Date(), // Pastikan tanggal tercatat dengan benar
      });

      // D. Catat Jurnal Stok (Masuk ke Outlet)
      await JurnalStok.create({
        bahanBakuID: item.bahanBakuID,
        locationID: data.keLocationID,
        jumlah: item.jumlah,
        tipeKoreksi: "Masuk",
        alasan: "Transfer Gudang",
        keterangan: `Terima dari Gudang via ${data.nomorRequest}`,
        dicatatOleh: userID,
        tenantID,
        tanggal: new Date(),
      });
    }

    data.status = "COMPLETED";
    await data.save();

    await redis.del(`inventory:list:${tenantID}`);
    await redis.del(this.#KEY_LIST(tenantID));

    return data;
  }

  async submit(id, tenantID) {
    const data = await PermintaanStok.findOneAndUpdate(
      { _id: id, tenantID, status: "PENDING" },
      { status: "SUBMITTED" },
      { new: true },
    );
    if (!data)
      throw createError(404, "Data tidak ditemukan atau status bukan PENDING");
    return data;
  }

  async reject(id, tenantID) {
    const data = await PermintaanStok.findOneAndUpdate(
      { _id: id, tenantID, status: "SUBMITTED" },
      { status: "REJECTED" },
      { new: true },
    );
    if (!data)
      throw createError(404, "Data tidak ditemukan atau status tidak valid.");
    await redis.del(this.#KEY_LIST(tenantID));
    return data;
  }
}

module.exports = new PermintaanStokService();
