// permintaanStokService.js
const PermintaanStok = require("../models/permintaanStok");
const TransferStok = require("../models/transferStokModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const {
  validatePermintaanStokPayload,
  VALID_STATUS,
} = require("../validators/permintaanStokValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

class PermintaanStokService {
  // Helper: Menangani Error Mongoose
  handleDbError(
    error,
    defaultMessage = "Gagal memproses data Permintaan Stok"
  ) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue);
      return createError(400, {
        message: `Nomor Request '${error.keyValue[field]}' sudah terdaftar.`,
      });
    }
    if (error.name === "ValidationError") {
      let errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return createError(400, {
        message: "Validasi data gagal. Cek detail errors.",
        errors: errors,
      });
    }
    if (error.name === "CastError") {
      return createError(400, { message: "Format ID tidak valid." });
    }
    return createError(500, error.message || defaultMessage);
  } // ------------------------------------------------------------------ // CRUD DASAR (Operation on DRAFT status only) // ------------------------------------------------------------------ // --- CREATE (Membuat Draft) ---
  async create(payload) {
    const validation = validatePermintaanStokPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const request = await PermintaanStok.create(payload);
      return request;
    } catch (error) {
      throw this.handleDbError(error, "Gagal membuat Permintaan Stok.");
    }
  } // --- READ ALL ---

  async getAll(tenantID, filters = {}) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    try {
      const query = { tenantID }; // Tambahkan filter opsional

      if (filters.status && VALID_STATUS.includes(filters.status)) {
        query.status = filters.status;
      }
      if (filters.dariLocationID && isValidObjectId(filters.dariLocationID)) {
        query.dariLocationID = filters.dariLocationID;
      }

      const requests = await PermintaanStok.find(query)
        .populate("dariLocationID", "nama tipe")
        .populate("keLocationID", "nama tipe")
        .populate("dimintaOleh", "nama")
        .sort({ tanggalRequest: -1 });

      if (requests.length === 0)
        throw createError(
          404,
          "Tidak ada data Permintaan Stok untuk tenant ini."
        );

      return requests;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(
        error,
        "Gagal mengambil daftar Permintaan Stok."
      );
    }
  } // --- READ BY ID ---

  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Request dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      const request = await PermintaanStok.findOne({ _id: id, tenantID })
        .populate("dariLocationID", "nama tipe")
        .populate("keLocationID", "nama tipe")
        .populate("dimintaOleh", "nama")
        .populate("diprosesOleh", "nama");

      if (!request)
        throw createError(
          404,
          "Permintaan Stok tidak ditemukan atau Anda tidak memiliki akses."
        );
      return request;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(
        error,
        "Gagal mengambil detail Permintaan Stok."
      );
    }
  } // --- UPDATE DRAFT (Hanya bisa update jika status DRAFT) ---

  async updateDraft(tenantID, id, payload) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Request dan Tenant ID wajib disertakan dan harus valid."
      );

    const validation = validatePermintaanStokPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      // Cek dulu statusnya harus DRAFT
      const currentRequest = await PermintaanStok.findOne({
        _id: id,
        tenantID,
      });
      if (!currentRequest)
        throw createError(404, "Permintaan Stok tidak ditemukan.");
      if (currentRequest.status !== "DRAFT")
        throw createError(
          400,
          "Hanya Permintaan dengan status DRAFT yang bisa diubah."
        ); // Update DB: Hanya jika _id, tenantID cocok, dan status masih DRAFT

      const updatedRequest = await PermintaanStok.findOneAndUpdate(
        { _id: id, tenantID: tenantID, status: "DRAFT" },
        validation.updates,
        { new: true, runValidators: true }
      );

      if (!updatedRequest)
        throw createError(
          404,
          "Permintaan Stok tidak ditemukan atau status sudah berubah."
        );

      return updatedRequest;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(
        error,
        "Gagal memperbarui Draft Permintaan Stok."
      );
    }
  } // --- DELETE DRAFT (Hanya bisa delete jika status DRAFT) ---

  async deleteDraft(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Request dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      // Delete hanya jika _id, tenantID cocok, dan status DRAFT
      const deletedRequest = await PermintaanStok.findOneAndDelete({
        _id: id,
        tenantID: tenantID,
        status: "DRAFT",
      });

      if (!deletedRequest)
        throw createError(
          404,
          "Permintaan Stok tidak ditemukan atau statusnya sudah disubmit/diproses."
        );

      return { message: "Draft Permintaan Stok berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus Draft Permintaan Stok.");
    }
  } // ------------------------------------------------------------------ // LOGIKA UTAMA: UPDATE STATUS (Tanpa Transaksi) // ------------------------------------------------------------------
  async updateStatus(tenantID, id, newStatus, updates = {}) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Request dan Tenant ID wajib disertakan dan harus valid."
      );
    if (!VALID_STATUS.includes(newStatus))
      throw createError(400, `Status baru '${newStatus}' tidak valid.`);

    try {
      // 1. Ambil data lama dan pastikan kepemilikan
      let request = await PermintaanStok.findOne({ _id: id, tenantID });

      if (!request)
        throw createError(
          404,
          "Permintaan Stok tidak ditemukan atau Anda tidak memiliki akses."
        );

      const oldStatus = request.status;
      let transferStokResult = null; // Logika Bisnis Kritis: Cek Transisi Status

      if (oldStatus === "COMPLETED" || oldStatus === "REJECTED") {
        throw createError(
          400,
          `Tidak dapat mengubah status dari '${oldStatus}'.`
        );
      } // Transisi SUBMIT: DRAFT -> SUBMITTED

      if (newStatus === "SUBMITTED" && oldStatus !== "DRAFT") {
        throw createError(400, "Hanya Permintaan DRAFT yang bisa di-SUBMIT.");
      } // Transisi APPROVE: SUBMITTED -> APPROVED

      if (newStatus === "APPROVED" && oldStatus !== "SUBMITTED") {
        throw createError(
          400,
          "Hanya Permintaan SUBMITTED yang bisa di-APPROVE."
        );
      } // Transisi REJECT: SUBMITTED -> REJECTED
      if (newStatus === "REJECTED" && oldStatus !== "SUBMITTED") {
        throw createError(
          400,
          "Hanya Permintaan SUBMITTED yang bisa di-REJECT."
        );
      }

      if (newStatus === "APPROVED") {
        // A. LOGIKA UTAMA: BUAT DOKUMEN TRANSFER STOK OTOMATIS

        // 1. Validasi: Pastikan semua item memiliki qtyApproved
        if (
          !updates.items ||
          updates.items.some(
            (item) =>
              typeof item.qtyApproved !== "number" || item.qtyApproved < 0
          )
        ) {
          throw createError(
            400,
            "Update status APPROVED memerlukan daftar item dengan qtyApproved yang valid."
          );
        } // 2. Siapkan data untuk TransferStok

        const transferItems = updates.items.map((item) => ({
          bahanBakuID: item.bahanBakuID,
          qtyKirim: item.qtyApproved, // qtyKirim Transfer = qtyApproved Permintaan
        }));

        const transferPayload = {
          nomorTransfer: `TRF/${request.nomorRequest}`, // Relasi penamaan
          dariLocationID: request.keLocationID, // Gudang -> Asal Transfer (Tujuan Permintaan)
          keLocationID: request.dariLocationID, // Outlet -> Tujuan Transfer (Asal Permintaan)
          tanggalKirim: updates.tanggalKirim || Date.now(),
          pengirimID: updates.diprosesOleh, // Pengirim adalah yang memproses (Admin Gudang)
          items: transferItems,
          tenantID: tenantID,
          status: "PENDING", // Transfer Stok dimulai sebagai PENDING
        }; // PENTING: Jika langkah ini gagal, PermintaanStok tetap akan di-APPROVED di langkah 4.

        // 3. Buat dokumen TransferStok
        transferStokResult = await TransferStok.create(transferPayload);

        request.status = "APPROVED";
        request.diprosesOleh = updates.diprosesOleh;
        request.items = updates.items; // Simpan qtyApproved yang baru
        request.transferStokID = transferStokResult._id; // Simpan ID TransferStok yang baru dibuat
      } else if (newStatus === "REJECTED") {
        // B. LOGIKA: REJECTED
        request.status = "REJECTED";
        request.diprosesOleh = updates.diprosesOleh;
      } else if (newStatus === "COMPLETED") {
        // C. LOGIKA: COMPLETED
        if (!request.transferStokID)
          throw createError(
            400,
            "Permintaan tidak dapat di-COMPLETED tanpa ID Transfer Stok terkait."
          );

        request.status = "COMPLETED";
      } else if (newStatus === "SUBMITTED") {
        // D. LOGIKA: SUBMITTED
        request.status = "SUBMITTED";
      } // 3. Simpan perubahan status Permintaan

      await request.save();

      return {
        request: request,
        transferStok: transferStokResult || null,
      };
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(
        error,
        "Gagal memperbarui status Permintaan Stok."
      );
    } finally {
    }
  }
}

module.exports = new PermintaanStokService();
