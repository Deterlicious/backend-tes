// transferStokService.js
const TransferStok = require("../models/transferStokModel");
const Inventory = require("../models/inventoryModel"); // Menggunakan model Inventory/Stok per Lokasi
const mongoose = require("mongoose");
const createError = require("http-errors");
const {
  validateTransferPayload,
  VALID_STATUS,
} = require("../validators/transferStokValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

class TransferStokService {
  // Helper: Menangani Error Mongoose (Termasuk Unique Index)
  handleDbError(error, defaultMessage = "Gagal memproses data Transfer Stok") {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue);
      return createError(400, {
        message: `Nomor Transfer '${error.keyValue[field]}' sudah terdaftar.`,
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
  } // --- CREATE (Hanya Membuat Draft Transfer - Status PENDING) ---

  async create(payload) {
    const validation = validateTransferPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const transfer = await TransferStok.create(payload);
      return transfer;
    } catch (error) {
      throw this.handleDbError(error, "Gagal membuat Transfer Stok.");
    }
  } // --- READ ALL ---

  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    try {
      const transfer = await TransferStok.find({ tenantID })
        .populate("dariLocationID", "namaLokasi")
        .populate("keLocationID", "namaLokasi")
        .populate("pengirimID", "nama")
        .populate("penerimaID", "nama")
        .sort({ tanggalKirim: -1, createdAt: -1 });

      if (transfer.length === 0)
        throw createError(
          404,
          "Tidak ada data Transfer Stok untuk tenant ini."
        );

      return transfer;
    } catch (error) {
      throw this.handleDbError(error, "Gagal mengambil daftar Transfer Stok.");
    }
  } // --- READ BY ID ---

  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Transfer dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      const transfer = await TransferStok.findOne({ _id: id, tenantID })
        .populate("dariLocationID", "namaLokasi")
        .populate("keLocationID", "namaLokasi")
        .populate("pengirimID", "nama")
        .populate("penerimaID", "nama")
        .populate("items.bahanBakuID", "namaBahan satuan");

      if (!transfer)
        throw createError(
          404,
          "Transfer Stok tidak ditemukan atau Anda tidak memiliki akses."
        );

      return transfer;
    } catch (error) {
      throw this.handleDbError(error, "Gagal mengambil detail Transfer Stok.");
    }
  } // --- LOGIKA UTAMA: UPDATE STATUS (Tanpa Transaksi) ---

  async updateStatus(tenantID, id, newStatus, updates = {}) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Transfer dan Tenant ID wajib disertakan dan harus valid."
      );
    if (!VALID_STATUS.includes(newStatus))
      throw createError(400, `Status baru '${newStatus}' tidak valid.`);

    try {
      // 1. Ambil data lama dan pastikan kepemilikan
      let transfer = await TransferStok.findOne({ _id: id, tenantID });
      if (!transfer)
        throw createError(
          404,
          "Transfer Stok tidak ditemukan atau Anda tidak memiliki akses."
        );

      const oldStatus = transfer.status; // Logika Bisnis Kritis: Cek Transisi Status

      if (oldStatus === "DITERIMA" || oldStatus === "BATAL") {
        throw createError(
          400,
          `Tidak dapat mengubah status dari '${oldStatus}'.`
        );
      }
      if (newStatus === "DIKIRIM" && oldStatus !== "PENDING") {
        throw createError(
          400,
          "Hanya Transfer PENDING yang bisa diubah menjadi DIKIRIM."
        );
      }
      if (newStatus === "DITERIMA" && oldStatus !== "DIKIRIM") {
        throw createError(
          400,
          "Hanya Transfer DIKIRIM yang bisa diubah menjadi DITERIMA."
        );
      } // --- Implementasi Logika Stok Berdasarkan Transisi ---
      if (newStatus === "DIKIRIM") {
        // A. BARANG KELUAR DARI GUDANG (STOK ASAL BERKURANG)
        // Peringatan: Tidak ada cek stok minimum di sini, harusnya ada di Validasi/Middleware

        for (const item of transfer.items) {
          // Mengurangi stok di Lokasi Asal (dariLocationID)
          await Inventory.updateOne(
            {
              bahanBakuID: item.bahanBakuID,
              locationID: transfer.dariLocationID,
              tenantID,
            },
            { $inc: { stok: -item.qtyKirim } }
          );
        }
        transfer.status = "DIKIRIM";
        transfer.tanggalKirim = updates.tanggalKirim || Date.now();
        transfer.pengirimID = updates.pengirimID || transfer.pengirimID;
      } else if (newStatus === "DITERIMA") {
        // B. BARANG MASUK KE TOKO (STOK TUJUAN BERTAMBAH)

        // Perbarui items dengan qtyTerima jika dikirim di payload
        if (updates.items) {
          transfer.items = updates.items;
        }

        for (const item of transfer.items) {
          // Jika tidak ada qtyTerima dari payload, asumsikan diterima penuh (qtyKirim)
          const receivedQty = item.qtyTerima || item.qtyKirim; // Menambah stok di Lokasi Tujuan (keLocationID)

          // Menggunakan upsert: true untuk membuat entri stok jika belum ada di lokasi tujuan
          await Inventory.updateOne(
            {
              bahanBakuID: item.bahanBakuID,
              locationID: transfer.keLocationID,
              tenantID,
            },
            {
              $inc: { stok: receivedQty },
              $set: {
                bahanBakuID: item.bahanBakuID, // Ensure ID is set if creating
                locationID: transfer.keLocationID,
                tenantID: tenantID,
              },
            },
            { upsert: true } // Penting: Buat dokumen jika belum ada
          );
        }
        transfer.status = "DITERIMA";
        transfer.tanggalTerima = updates.tanggalTerima || Date.now();
        transfer.penerimaID = updates.penerimaID || transfer.penerimaID; // transfer.items sudah diperbarui di atas jika ada updates.items
      } else if (newStatus === "BATAL") {
        // C. TRANSAKSI DIBATALKAN

        // Jika status lama adalah DIKIRIM, stok harus dikembalikan ke Gudang Asal
        if (oldStatus === "DIKIRIM") {
          for (const item of transfer.items) {
            // Kembalikan stok di Lokasi Asal (dariLocationID)
            await Inventory.updateOne(
              {
                bahanBakuID: item.bahanBakuID,
                locationID: transfer.dariLocationID,
                tenantID,
              },
              { $inc: { stok: item.qtyKirim } } // Kembalikan stok yang sebelumnya keluar (+)
            );
          }
        }
        transfer.status = "BATAL";
      } // 3. Simpan perubahan status TransferStok

      await transfer.save();

      return transfer;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(
        error,
        "Gagal memperbarui status Transfer Stok."
      );
    }
  } // --- UPDATE DRAFT (Hanya Boleh Saat Status PENDING) ---

  async updateDraft(tenantID, id, payload) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Transfer dan Tenant ID wajib disertakan dan harus valid."
      );

    const validation = validateTransferPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      // KEAMANAN KRITIS: Filter ID & tenantID & Status PENDING
      const transfer = await TransferStok.findOneAndUpdate(
        { _id: id, tenantID: tenantID, status: "PENDING" },
        validation.updates,
        { new: true, runValidators: true }
      );

      if (!transfer)
        throw createError(
          404,
          "Transfer Stok tidak ditemukan, Anda tidak memiliki akses, atau statusnya sudah bukan PENDING."
        );

      return transfer;
    } catch (error) {
      throw this.handleDbError(error, "Gagal memperbarui draft Transfer Stok.");
    }
  } // --- DELETE DRAFT (Hanya Boleh Saat Status PENDING) ---

  async deleteDraft(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Transfer dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      // KEAMANAN KRITIS: Delete hanya jika _id dan tenantID cocok & Status PENDING
      const deletedTransfer = await TransferStok.findOneAndDelete({
        _id: id,
        tenantID: tenantID,
        status: "PENDING",
      });

      if (!deletedTransfer)
        throw createError(
          404,
          "Transfer Stok tidak ditemukan, Anda tidak memiliki akses, atau statusnya sudah bukan PENDING."
        );

      return { message: "Draft Transfer Stok berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus draft Transfer Stok.");
    }
  }
}

module.exports = new TransferStokService();
