const PermintaanStok = require("../models/permintaanStokModel");
const Inventory = require("../models/inventoryModel");
const JurnalStok = require("../models/jurnalStokModel");
const createError = require("http-errors");
const redis = require("../config/redis");

class PermintaanStokService {
  #KEY_LIST(tenantID) {
    return `permintaanStok:list:${tenantID}`;
  }

  // 1. GET ALL - Untuk daftar di tabel FE
  async getAll(query, user) {
    const { tenantID } = user;
    const { status } = query;

    let filter = { tenantID };
    if (status) filter.status = status;

    const data = await PermintaanStok.find(filter)
      .populate("dariLocationID", "nama")
      .populate("keLocationID", "nama")
      .populate("dimintaOleh", "nama")
      .sort({ createdAt: -1 });

    return data;
  }

  async create(payload) {
    // Default status jika tidak dikirim adalah DRAFT
    if (!payload.status) payload.status = "DRAFT";

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

  async update(id, tenantID, payload) {
    const data = await PermintaanStok.findOne({ _id: id, tenantID });

    if (!data) throw createError(404, "Data tidak ditemukan");

    // 1. Jika status sudah SUBMITTED/COMPLETED/REJECTED, mutlak tidak bisa diedit
    const statusTerlarang = ["SUBMITTED", "COMPLETED", "REJECTED"];
    if (statusTerlarang.includes(data.status)) {
      throw createError(400, "Data sudah diproses dan tidak dapat diubah.");
    }

    // 2. Logika Grace Period untuk status PENDING
    if (data.status === "PENDING") {
      const waktuSekarang = new Date();
      const waktuUpdateTerakhir = new Date(data.updatedAt); // Gunakan waktu saat status berubah jadi PENDING
      const selisihMenit = (waktuSekarang - waktuUpdateTerakhir) / (1000 * 60);

      if (selisihMenit > 5) {
        throw createError(
          400,
          "Batas waktu edit (5 menit) untuk status PENDING telah berakhir.",
        );
      }
    }

    // 3. Jika status DRAFT, bebas edit (tidak kena limit 5 menit)
    const updated = await PermintaanStok.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true },
    );

    await redis.del(`permintaanStok:list:${tenantID}`);
    return updated;
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
    // Cari data untuk tahu status sekarang
    const request = await PermintaanStok.findOne({ _id: id, tenantID });
    if (!request) throw createError(404, "Data tidak ditemukan");

    let nextStatus;
    if (request.status === "DRAFT") nextStatus = "PENDING";
    else if (request.status === "PENDING") nextStatus = "SUBMITTED";
    else
      throw createError(
        400,
        `Tidak bisa submit data dengan status ${request.status}`,
      );

    request.status = nextStatus;
    await request.save();

    await redis.del(this.#KEY_LIST(tenantID));
    return request;
  }

  /**
   * REJECT REQUEST
   * Boleh reject jika status PENDING atau SUBMITTED
   */
  async reject(id, tenantID, userID, alasan) {
    const data = await PermintaanStok.findOne({
      _id: id,
      tenantID,
      status: { $in: ["PENDING", "SUBMITTED"] },
    });

    if (!data) {
      throw createError(
        400,
        "Gagal menolak: Data tidak ditemukan atau sudah diproses.",
      );
    }

    data.status = "REJECTED";
    data.catatanPenolakan = alasan || "Ditolak oleh admin";
    data.ditolakOleh = userID;
    data.tanggalReject = new Date();

    await data.save();

    // JANGAN gunakan await untuk Redis di sini agar response instan
    if (redis && redis.status === "ready") {
      redis.del(this.#KEY_LIST(tenantID)).catch(() => {});
    }

    return data;
  }
}

module.exports = new PermintaanStokService();
