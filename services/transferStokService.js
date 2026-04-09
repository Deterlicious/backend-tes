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
          "Tidak ada data Transfer Stok untuk tenant ini.",
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
        "ID Transfer dan Tenant ID wajib disertakan dan harus valid.",
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
          "Transfer Stok tidak ditemukan atau Anda tidak memiliki akses.",
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
        "ID Transfer dan Tenant ID wajib disertakan dan harus valid.",
      );
    if (!VALID_STATUS.includes(newStatus))
      throw createError(400, `Status baru '${newStatus}' tidak valid.`);

    try {
      // 1. Ambil data lama dan pastikan kepemilikan
      let transfer = await TransferStok.findOne({ _id: id, tenantID });
      if (!transfer)
        throw createError(
          404,
          "Transfer Stok tidak ditemukan atau Anda tidak memiliki akses.",
        );

      const oldStatus = transfer.status;

      if (oldStatus === "DITERIMA" || oldStatus === "BATAL") {
        throw createError(
          400,
          `Tidak dapat mengubah status dari '${oldStatus}'.`,
        );
      }
      if (newStatus === "DIKIRIM" && oldStatus !== "PENDING") {
        throw createError(
          400,
          "Hanya Transfer PENDING yang bisa diubah menjadi DIKIRIM.",
        );
      }
      if (newStatus === "DITERIMA" && oldStatus !== "DIKIRIM") {
        throw createError(
          400,
          "Hanya Transfer DIKIRIM yang bisa diubah menjadi DITERIMA.",
        );
      }

      // --- Implementasi Logika Stok Berdasarkan Transisi ---
      if (newStatus === "DIKIRIM") {
        // A. BARANG KELUAR DARI GUDANG (STOK ASAL BERKURANG)
        for (const item of transfer.items) {
          // --- TAMBAHAN: Atomic Guard & FindOneAndUpdate ---
          const invAsal = await Inventory.findOneAndUpdate(
            {
              bahanBakuID: item.bahanBakuID,
              locationID: transfer.dariLocationID,
              tenantID,
              stok: { $gte: item.qtyKirim }, // Memastikan stok cukup
            },
            { $inc: { stok: -item.qtyKirim } },
            { new: true },
          );

          if (!invAsal) {
            throw createError(
              400,
              `Stok bahan baku ID ${item.bahanBakuID} tidak mencukupi di lokasi asal.`,
            );
          }

          // --- TAMBAHAN: Jurnal Stok Keluar ---
          const JurnalStok = require("../models/jurnalStokModel"); // Pastikan path benar
          await JurnalStok.create({
            bahanBakuID: item.bahanBakuID,
            locationID: transfer.dariLocationID,
            jumlah: item.qtyKirim,
            tipeKoreksi: "Keluar",
            alasan: "Transfer Gudang",
            keterangan: `Kirim Transfer: ${transfer.nomorTransfer}`,
            dicatatOleh: updates.pengirimID || transfer.pengirimID,
            tenantID,
            tanggal: new Date(),
          });
        }
        transfer.status = "DIKIRIM";
        transfer.tanggalKirim = updates.tanggalKirim || Date.now();
        transfer.pengirimID = updates.pengirimID || transfer.pengirimID;
      } else if (newStatus === "DITERIMA") {
        // B. BARANG MASUK KE TOKO (STOK TUJUAN BERTAMBAH)
        if (updates.items) {
          transfer.items = updates.items;
        }

        for (const item of transfer.items) {
          const receivedQty = item.qtyTerima || item.qtyKirim;

          await Inventory.updateOne(
            {
              bahanBakuID: item.bahanBakuID,
              locationID: transfer.keLocationID,
              tenantID,
            },
            {
              $inc: { stok: receivedQty },
              $set: {
                bahanBakuID: item.bahanBakuID,
                locationID: transfer.keLocationID,
                tenantID: tenantID,
              },
            },
            { upsert: true },
          );

          // --- TAMBAHAN: Jurnal Stok Masuk ---
          const JurnalStok = require("../models/jurnalStokModel");
          await JurnalStok.create({
            bahanBakuID: item.bahanBakuID,
            locationID: transfer.keLocationID,
            jumlah: receivedQty,
            tipeKoreksi: "Masuk",
            alasan: "Transfer Gudang",
            keterangan: `Terima Transfer: ${transfer.nomorTransfer}`,
            dicatatOleh: updates.penerimaID || transfer.penerimaID,
            tenantID,
            tanggal: new Date(),
          });
        }
        transfer.status = "DITERIMA";
        transfer.tanggalTerima = updates.tanggalTerima || Date.now();
        transfer.penerimaID = updates.penerimaID || transfer.penerimaID;
      } else if (newStatus === "BATAL") {
        // C. TRANSAKSI DIBATALKAN
        if (oldStatus === "DIKIRIM") {
          for (const item of transfer.items) {
            await Inventory.updateOne(
              {
                bahanBakuID: item.bahanBakuID,
                locationID: transfer.dariLocationID,
                tenantID,
              },
              { $inc: { stok: item.qtyKirim } },
            );

            // --- TAMBAHAN: Jurnal Stok Pembatalan (Masuk Kembali) ---
            const JurnalStok = require("../models/jurnalStokModel");
            await JurnalStok.create({
              bahanBakuID: item.bahanBakuID,
              locationID: transfer.dariLocationID,
              jumlah: item.qtyKirim,
              tipeKoreksi: "Masuk",
              alasan: "Lainnya",
              keterangan: `Pembatalan Transfer: ${transfer.nomorTransfer}`,
              dicatatOleh: updates.pengirimID || transfer.pengirimID,
              tenantID,
              tanggal: new Date(),
            });
          }
        }
        transfer.status = "BATAL";
      }

      await transfer.save();

      // --- TAMBAHAN: Invalidate Redis Cache ---
      const redis = require("../config/redis");
      if (redis.del) {
        await redis.del(`inventory:list:${tenantID}`);
      }

      return transfer;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(
        error,
        "Gagal memperbarui status Transfer Stok.",
      );
    }
  } // --- UPDATE DRAFT (Hanya Boleh Saat Status PENDING) ---

  async updateDraft(tenantID, id, payload) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Transfer dan Tenant ID wajib disertakan dan harus valid.",
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
        { new: true, runValidators: true },
      );

      if (!transfer)
        throw createError(
          404,
          "Transfer Stok tidak ditemukan, Anda tidak memiliki akses, atau statusnya sudah bukan PENDING.",
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
        "ID Transfer dan Tenant ID wajib disertakan dan harus valid.",
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
          "Transfer Stok tidak ditemukan, Anda tidak memiliki akses, atau statusnya sudah bukan PENDING.",
        );

      return { message: "Draft Transfer Stok berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus draft Transfer Stok.");
    }
  }
}

module.exports = new TransferStokService();
