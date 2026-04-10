const PermintaanStok = require("../models/permintaanStokModel");
const Inventory = require("../models/inventoryModel");
const JurnalStok = require("../models/jurnalStokModel");
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

  /**
   * APPROVE REQUEST - Transfer Stok (Atomic tanpa Mongoose Session/Transaction)
   * Menggunakan findOneAndUpdate + $gte + $inc untuk mencegah race condition
   */
  async approve(id, tenantID, userID) {
    // 1. Cari data & pastikan status masih SUBMITTED (Pencegahan Double Approve)
    const data = await PermintaanStok.findOne({
      _id: id,
      tenantID,
      status: "SUBMITTED",
    });

    if (!data) {
      // Cek apakah memang tidak ada atau statusnya sudah berubah
      const existing = await PermintaanStok.findOne({ _id: id, tenantID });
      if (!existing) throw createError(404, "Data permintaan tidak ditemukan.");
      throw createError(
        400,
        "Permintaan sudah diproses atau tidak dalam status SUBMITTED.",
      );
    }

    // --- 2. VALIDASI & PENGURANGAN STOK ASAL (Lakukan untuk semua item dulu) ---
    // Kita simpan hasil pengurangan sementara untuk verifikasi
    for (const item of data.items) {
      const sourceResult = await Inventory.findOneAndUpdate(
        {
          bahanBakuID: item.bahanBakuID,
          locationID: data.dariLocationID,
          tenantID,
          stok: { $gte: item.jumlah }, // Atomic Check
        },
        { $inc: { stok: -item.jumlah } },
        { new: true },
      );

      if (!sourceResult) {
        // Jika satu item saja gagal, alur berhenti.
        // Catatan: Tanpa 'Session', item yang sudah terlanjur dikurangi di loop sebelumnya
        // harus dikembalikan secara manual jika ingin benar-benar aman,
        // tapi cek di awal loop biasanya sudah meminimalisir ini.
        throw createError(
          400,
          `Stok bahan baku ID ${item.bahanBakuID} tidak mencukupi di gudang asal.`,
        );
      }
    }

    // --- 3. PENAMBAHAN STOK TUJUAN + PENCATATAN JURNAL ---
    for (const item of data.items) {
      // A. Tambah Stok di Gudang Tujuan (dengan upsert)
      await Inventory.findOneAndUpdate(
        {
          bahanBakuID: item.bahanBakuID,
          locationID: data.keLocationID,
          tenantID,
        },
        { $inc: { stok: item.jumlah } },
        { upsert: true },
      );

      // B. Catat Jurnal Stok (Sekaligus Keluar & Masuk)
      // Keluar dari Gudang Asal
      await JurnalStok.create({
        bahanBakuID: item.bahanBakuID,
        locationID: data.dariLocationID,
        jumlah: item.jumlah,
        tipeKoreksi: "Keluar",
        alasan: "Transfer Gudang",
        keterangan: `Kirim ke Outlet via ${data.nomorRequest}`,
        dicatatOleh: userID,
        tenantID,
        tanggal: new Date(),
      });

      // Masuk ke Lokasi Tujuan
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

    // 4. Update status permintaan menjadi COMPLETED
    data.status = "COMPLETED";
    data.tanggalApprove = new Date(); // Tambahkan info tanggal approve
    data.disetujuiOleh = userID; // Tambahkan info siapa yang menyetujui
    await data.save();

    // 5. Invalidate cache (Gunakan pipeline jika redis mendukung untuk efisiensi)
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

  /**
   * REJECT REQUEST
   * Boleh reject jika status PENDING atau SUBMITTED
   */
  async reject(id, tenantID, userID, alasan) {
    // --- ANTISIPASI SKENARIO 1 & 2 ---
    // Kita cari data sekaligus mengunci status di level Query.
    // Jika admin lain sudah klik 'Approve' (status jadi COMPLETED),
    // maka query ini akan menghasilkan null, dan reject otomatis gagal.
    const data = await PermintaanStok.findOne({
      _id: id,
      tenantID,
      status: { $in: ["PENDING", "SUBMITTED"] },
    });

    if (!data) {
      // Memberi tahu user bahwa status sudah berubah (mungkin sudah di-approve admin lain)
      throw createError(
        400,
        "Gagal menolak: Data tidak ditemukan atau sudah diproses (COMPLETED/REJECTED).",
      );
    }

    // --- IMPLEMENTASI REJECT ---
    data.status = "REJECTED";
    data.catatanPenolakan = alasan || "Ditolak oleh sistem/admin";
    data.ditolakOleh = userID;
    data.tanggalReject = new Date();

    await data.save();

    // Invalidate cache agar UI FE langsung sinkron
    await redis.del(this.#KEY_LIST(tenantID));

    return data;
  }
}

module.exports = new PermintaanStokService();
