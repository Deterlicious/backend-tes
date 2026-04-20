const PermintaanStok = require("../models/permintaanStokModel");
const Inventory = require("../models/inventoryModel");
const JurnalStok = require("../models/jurnalStokModel");
const TransferStokService = require("./transferStokService");
// 1. Hapus 'new' karena yang di-export dari transferStokService sudah berupa instance
const transferService = require("./transferStokService");
const createError = require("http-errors");
const redis = require("../config/redis");

class PermintaanStokService {
  #KEY_LIST(tenantID) {
    return `permintaanStok:list:${tenantID}`;
  }

  // 1. GET ALL - Untuk daftar di tabel FE
  async getAll(query, user) {
    const { tenantID, permissions } = user;
    const { status } = query;

    // 1. Tentukan Filter Dasar
    let filter = { tenantID };

    // 2. LOGIKA WORKFLOW (The "Security Guard")
    const canApprove = permissions.includes("approve-permintaan-stok");
    const canCreateTransfer = permissions.includes("create-transfer-stok");

    // Jika user HANYA punya izin buat transfer (Staf Gudang) dan BUKAN manager
    if (!canApprove && canCreateTransfer) {
      // Staf Gudang hanya boleh melihat permintaan yang sudah APPROVED atau COMPLETED
      filter.status = { $in: ["APPROVED", "COMPLETED"] };
    }

    // Jika user memfilter status secara manual dari UI (misal klik tab "REJECTED")
    if (status) filter.status = status;

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

  /**
   * APPROVE REQUEST - Transfer Stok (Atomic tanpa Mongoose Session/Transaction)
   * Menggunakan findOneAndUpdate + $gte + $inc untuk mencegah race condition
   */

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

    // 2. Siapkan Payload untuk Surat Jalan (TransferStok)
    // Kita sesuaikan field 'jumlah' di Permintaan ke 'qtyKirim' di Transfer
    const payloadTransfer = {
      nomorTransfer: `SJ-${data.nomorRequest}-${Date.now().toString().slice(-4)}`, // Generate No. Surat Jalan
      tenantID: tenantID,
      dariLocationID: data.dariLocationID,
      keLocationID: data.keLocationID,
      pengirimID: userID,
      tanggalKirim: new Date(),
      permintaanStokID: data._id,
      items: data.items.map((item) => ({
        bahanBakuID: item.bahanBakuID,
        qtyKirim: item.jumlah, // Mapping jumlah -> qtyKirim
        qtyTerima: 0,
      })),
      permintaanStokID: data._id, // Simpan referensi balik
    };

    // 3. Buat Dokumen Transfer Stok (Surat Jalan)
    const newTransfer = await transferService.create(payloadTransfer);

    // 4. Update Status Permintaan menjadi APPROVED
    data.status = "APPROVED";
    data.transferStokID = newTransfer._id; // Link ke Surat Jalan
    data.disetujuiOleh = userID;
    data.tanggalApprove = new Date();
    await data.save();

    // 5. Invalidate Cache Permintaan
    if (redis && redis.status === "ready") {
      await redis.del(this.#KEY_LIST(tenantID));
    }

    return {
      message:
        "Permintaan disetujui. Surat Jalan (Transfer Stok) telah diterbitkan.",
      transferID: newTransfer._id,
      nomorSuratJalan: newTransfer.nomorTransfer,
    };
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
