const PengajuanStok = require("../models/pengajuanStokModel");
const BahanBaku = require("../models/bahanBakuModel");
const createError = require("http-errors");
const redis = require("../config/redis");
const { convertToBaseUnit } = require("../utils/unitConverter");

class PengajuanStokService {
  #KEY_LIST(tenantID) {
    return `pengajuanStok:list:${tenantID}`;
  }

  // 1. GET ALL - Untuk daftar di tabel FE
  async getAll(query, user) {
    const { tenantID, permissions = [] } = user;
    const { status, jenisPengajuan } = query;

    // 1. Tentukan Filter Dasar
    let filter = { tenantID };
    if (jenisPengajuan) {
      filter.jenisPengajuan = jenisPengajuan;
    }

    // 2. LOGIKA WORKFLOW (The "Security Guard")
    const canApprove = permissions.includes("approve-pengajuan-stok");
    const canCreateTransfer = permissions.includes("create-transfer-stok");
    const allowedStatuses =
      !canApprove && canCreateTransfer
        ? ["SUBMITTED", "APPROVED", "COMPLETED"]
        : null;

    // Jika user HANYA punya izin buat transfer (Staf Gudang) dan BUKAN manager
    if (allowedStatuses) {
      // Staf gudang/outlet tujuan boleh melihat request masuk, tapi tidak semua status.
      filter.status = { $in: allowedStatuses };
    }

    // Jika user memfilter status secara manual dari UI (misal klik tab "REJECTED")
    if (status) {
      if (allowedStatuses && !allowedStatuses.includes(status)) return [];
      filter.status = status;
    }

    // 3. Eksekusi Kueri dengan Standarisasi Field ("nama tipe")
    const data = await PengajuanStok.find(filter)
      .populate("dariLocationID", "nama tipe")
      .populate("keLocationID", "nama tipe")
      .populate("dimintaOleh", "nama")
      .populate("items.bahanBakuID", "namaBahan satuan") // Menambahkan populate untuk bahanBakuID agar nama dan satuan terbaca Frontend
      .sort({ createdAt: -1 });

    return data;
  }

  async create(payload) {
    // Default status jika tidak dikirim adalah DRAFT
    if (!payload.status) payload.status = "DRAFT";

    if (!payload.nomorPengajuan) {
      const date = new Date();
      const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}`;
      const lastDoc = await PengajuanStok.findOne({
        nomorPengajuan: new RegExp(`PGJ/${yearMonth}/`),
      })
        .sort({ createdAt: -1 })
        .lean();

      let counter = 1;
      if (lastDoc) {
        const lastCounter = parseInt(lastDoc.nomorPengajuan.split("/")[2]);
        counter = lastCounter + 1;
      }
      payload.nomorPengajuan = `PGJ/${yearMonth}/${counter.toString().padStart(4, "0")}`;
    }

    // ── KONVERSI SATUAN ──────────────────────────────────────────────────────
    // Mengapa di sini? Frontend hanya mengirim jumlah + satuan yang user pilih
    // (misal: 500 gram). Backend wajib menyimpan dalam satuan base BahanBaku
    // (misal: kg) agar seluruh kalkulasi stok konsisten.
    if (payload.items && Array.isArray(payload.items)) {
      for (const item of payload.items) {
        const bahanBaku = await BahanBaku.findById(item.bahanBakuID);
        if (!bahanBaku)
          throw createError(400, `BahanBaku ID ${item.bahanBakuID} tidak ditemukan.`);

        const baseUnit = bahanBaku.satuan; // satuan base dari master data (kg, liter, dll)
        const userUnit = item.satuan;      // satuan yang user pilih (gram, ml, dll)

        // Convert ke base unit sebelum masuk database
        item.jumlah = convertToBaseUnit(item.jumlah, userUnit, baseUnit);
        item.satuan = baseUnit;
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const data = await PengajuanStok.create(payload);
    await redis.del(this.#KEY_LIST(payload.tenantID));
    return data;
  }

  async update(id, tenantID, payload) {
    const data = await PengajuanStok.findOne({ _id: id, tenantID });

    if (!data) throw createError(404, "Data tidak ditemukan");

    // 1. Jika status sudah SUBMITTED/COMPLETED/REJECTED, mutlak tidak bisa diedit
    const statusTerlarang = ["SUBMITTED", "COMPLETED", "REJECTED"];
    if (statusTerlarang.includes(data.status)) {
      throw createError(400, "Data sudah diproses dan tidak dapat diubah.");
    }

    // ── KONVERSI SATUAN (sama seperti create) ────────────────────────────────
    // Jika user mengedit items (misal: ganti jumlah atau satuan),
    // konversi harus dijalankan ulang agar data tetap konsisten.
    if (payload.items && Array.isArray(payload.items)) {
      for (const item of payload.items) {
        const bahanBaku = await BahanBaku.findById(item.bahanBakuID);
        if (!bahanBaku)
          throw createError(400, `BahanBaku ID ${item.bahanBakuID} tidak ditemukan.`);

        const baseUnit = bahanBaku.satuan;
        const userUnit = item.satuan;

        // Convert ke base unit sebelum masuk database
        item.jumlah = convertToBaseUnit(item.jumlah, userUnit, baseUnit);
        item.satuan = baseUnit;
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // 2. Jika status DRAFT, bebas edit
    const updated = await PengajuanStok.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true },
    );

    await redis.del(`pengajuanStok:list:${tenantID}`);
    return updated;
  }

  // updateStatus dinonaktifkan karena tidak relevan untuk flow saat ini.
  // Route aktif memakai approve() dan reject(), yang punya audit field lebih
  // lengkap seperti tanggalApprove, tanggalReject, disetujuiOleh, dan ditolakOleh.
  //
  // async updateStatus(id, tenantID, userID, newStatus, catatanPenolakan = "") {
  //   const permintaan = await PengajuanStok.findOne({ _id: id, tenantID });
  //   if (!permintaan) throw createError(404, "Permintaan tidak ditemukan.");
  //
  //   if (permintaan.status !== "SUBMITTED") {
  //     throw createError(
  //       400,
  //       "Hanya permintaan dengan status 'SUBMITTED' yang bisa diproses.",
  //     );
  //   }
  //
  //   permintaan.status = newStatus;
  //   permintaan.disetujuiOleh = userID;
  //
  //   if (newStatus === "REJECTED") {
  //     permintaan.catatanPenolakan = catatanPenolakan;
  //   }
  //
  //   await permintaan.save();
  //   return permintaan;
  // }

  async approve(id, tenantID, userID) {
    // 1. Cari data Permintaan
    const data = await PengajuanStok.findOne({
      _id: id,
      tenantID,
      status: "SUBMITTED",
    });

    if (!data) {
      throw createError(
        400,
        "Permintaan sudah diproses atau tidak dalam status SUBMITTED.",
      );
    }

    // 2. Approve hanya menyetujui permintaan. Surat jalan dibuat manual
    // dari permintaan APPROVED melalui endpoint TransferStok.
    data.status = "APPROVED";
    data.disetujuiOleh = userID;
    data.tanggalApprove = new Date();
    await data.save();

    // 3. Invalidate Cache Permintaan
    if (redis && redis.status === "ready") {
      await redis.del(this.#KEY_LIST(tenantID));
    }

    return {
      message: "Permintaan disetujui. Surat jalan siap dibuat.",
      data,
    };
  }

  async submit(id, tenantID) {
    // Cari data untuk tahu status sekarang
    const request = await PengajuanStok.findOne({ _id: id, tenantID });
    if (!request) throw createError(404, "Data tidak ditemukan");

    if (request.status !== "DRAFT") {
      throw createError(
        400,
        `Tidak bisa submit data dengan status ${request.status}`,
      );
    }

    request.status = "SUBMITTED";
    await request.save();

    await redis.del(this.#KEY_LIST(tenantID));
    return request;
  }

  /**
   * REJECT REQUEST
   * Boleh reject jika status SUBMITTED
   */
  async reject(id, tenantID, userID, alasan) {
    const data = await PengajuanStok.findOne({
      _id: id,
      tenantID,
      status: "SUBMITTED",
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

module.exports = new PengajuanStokService();
