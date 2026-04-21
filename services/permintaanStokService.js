const PermintaanStok = require("../models/permintaanStokModel");
const createError = require("http-errors");
const redis = require("../config/redis");

class PermintaanStokService {
  #KEY_LIST(tenantID) {
    return `permintaanStok:list:${tenantID}`;
  }

  // 1. GET ALL - Untuk daftar di tabel FE
  async getAll(query, user) {
    const { tenantID, permissions = [] } = user;
    const { status } = query;

    // 1. Tentukan Filter Dasar
    let filter = { tenantID };

    // 2. LOGIKA WORKFLOW (The "Security Guard")
    const canApprove = permissions.includes("approve-permintaan-stok");
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
    const data = await PermintaanStok.find(filter)
      .populate("dariLocationID", "nama tipe")
      .populate("keLocationID", "nama tipe")
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

    // 2. Jika status DRAFT, bebas edit
    const updated = await PermintaanStok.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true },
    );

    await redis.del(`permintaanStok:list:${tenantID}`);
    return updated;
  }

  async updateStatus(id, tenantID, userID, newStatus, catatanPenolakan = "") {
    // 1. Cari data permintaan
    const permintaan = await PermintaanStok.findOne({ _id: id, tenantID });
    if (!permintaan) throw createError(404, "Permintaan tidak ditemukan.");

    // 2. Validasi Transisi Status (State Machine)
    // Hanya status SUBMITTED yang bisa di-Approve atau Reject
    if (permintaan.status !== "SUBMITTED") {
      throw createError(
        400,
        "Hanya permintaan dengan status 'SUBMITTED' yang bisa diproses.",
      );
    }

    // 3. Update Data
    permintaan.status = newStatus; // "APPROVED" atau "REJECTED"
    permintaan.disetujuiOleh = userID; // Catat ID Manajer yang eksekusi

    if (newStatus === "REJECTED") {
      permintaan.catatanPenolakan = catatanPenolakan;
    }

    await permintaan.save();
    return permintaan;
  }

  async approve(id, tenantID, userID) {
    // 1. Cari data Permintaan
    const data = await PermintaanStok.findOne({
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
    const request = await PermintaanStok.findOne({ _id: id, tenantID });
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
    const data = await PermintaanStok.findOne({
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

module.exports = new PermintaanStokService();
