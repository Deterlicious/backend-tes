// transferStokService.js
const TransferStok = require("../models/transferStokModel");
const Inventory = require("../models/inventoryModel"); // Menggunakan model Inventory/Stok per Lokasi
const PengajuanStok = require("../models/pengajuanStokModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const {
  validateTransferPayload,
  VALID_STATUS,
} = require("../validators/transferStokValidator");
const { convertToBaseUnit } = require("../utils/unitConverter");

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
  }

  // --- CREATE (Membuat Draft Transfer - Status PENDING) ---
  async create(payload) {
    if (
      !payload.pengajuanStokID ||
      !isValidObjectId(payload.pengajuanStokID)
    ) {
      throw createError(
        400,
        "Surat jalan wajib dibuat dari Pengajuan Stok yang sudah disetujui.",
      );
    }

    // TAMBAHAN: Kita mempopulate bahanBakuID agar tahu satuan dasar dari master data Gudang
    const pengajuan = await PengajuanStok.findOne({
      _id: payload.pengajuanStokID,
      tenantID: payload.tenantID,
      status: { $in: ["APPROVED", "PENDING"] }, // 🎯 Izinkan pembuatan SJ dari APPROVED & PENDING
    }).populate("items.bahanBakuID");

    if (!pengajuan) {
      throw createError(
        400,
        "Pengajuan Stok tidak ditemukan atau belum berstatus APPROVED / PENDING.",
      );
    }

    if (pengajuan.transferStokID) {
      throw createError(
        400,
        "Pengajuan Stok ini sudah memiliki Surat Jalan.",
      );
    }

    if (
      payload.dariLocationID &&
      String(payload.dariLocationID) !== String(pengajuan.dariLocationID)
    ) {
      throw createError(
        400,
        "Lokasi asal Surat Jalan harus sama dengan Pengajuan Stok.",
      );
    }

    if (
      payload.keLocationID &&
      String(payload.keLocationID) !== String(pengajuan.keLocationID)
    ) {
      throw createError(
        400,
        "Lokasi tujuan Surat Jalan harus sama dengan Pengajuan Stok.",
      );
    }

    const requestedItems = new Map(
      pengajuan.items.map((item) => [String(item.bahanBakuID._id), item]),
    );

    const items =
      Array.isArray(payload.items) && payload.items.length > 0
        ? payload.items
        : pengajuan.items.map((item) => ({
            bahanBakuID: String(item.bahanBakuID._id),
            qtyKirim: item.jumlah,
          }));

    const processedItems = [];
    for (const item of items) {
      const requestedItem = requestedItems.get(String(item.bahanBakuID));
      if (!requestedItem) {
        throw createError(
          400,
          "Item Surat Jalan harus berasal dari item Pengajuan Stok.",
        );
      }

      // AMBIL SATUAN
      const requestedUnit = requestedItem.satuan;
      const baseUnit = requestedItem.bahanBakuID.satuan;

      // LAKUKAN KONVERSI (SMART CONVERTER)
      const qtyKirimBase = convertToBaseUnit(item.qtyKirim, requestedUnit, baseUnit);
      const requestedQtyBase = convertToBaseUnit(requestedItem.jumlah, requestedUnit, baseUnit);

      if (qtyKirimBase > requestedQtyBase) {
        throw createError(
          400,
          "Jumlah kirim tidak boleh melebihi jumlah yang diminta.",
        );
      }

      processedItems.push({
        bahanBakuID: item.bahanBakuID,
        qtyKirim: qtyKirimBase, // Disimpan ke DB sebagai satuan dasar Gudang
        qtyTerima: item.qtyTerima ? convertToBaseUnit(item.qtyTerima, requestedUnit, baseUnit) : 0,
        catatanItem: item.catatanItem || null,
      });
    }

    payload.dariLocationID = pengajuan.dariLocationID;
    payload.keLocationID = pengajuan.keLocationID;
    payload.items = processedItems;

    // 1. AUTO-GENERATE NOMOR TRANSFER dari nomor pengajuan yang sudah approved
    if (!payload.nomorTransfer) {
      const uniqueString = Date.now().toString().slice(-4);
      payload.nomorTransfer = `SJ-${pengajuan.nomorPengajuan}-${uniqueString}`;
    }

    const validation = validateTransferPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    // 2. EARLY STOCK VALIDATION (Cek stok di awal agar tidak membuat draft kosong)
    for (const item of payload.items) {
      const cekStok = await Inventory.findOne({
        bahanBakuID: item.bahanBakuID,
        locationID: payload.dariLocationID,
        tenantID: payload.tenantID,
      });

      // Jika stok fisik tidak ada atau kurang dari yang mau dikirim
      if (!cekStok || cekStok.stok < item.qtyKirim) {
        throw createError(
          400,
          `Pembuatan Draft Gagal: Stok untuk salah satu bahan baku tidak mencukupi di lokasi asal.`,
        );
      }
    }

    try {
      const transfer = await TransferStok.create(payload);
      // Gunakan updateOne agar .save() tidak menyebabkan error validasi 
      // dari objectId bahanBakuID yang sudah kita populate
      await PengajuanStok.updateOne(
        { _id: pengajuan._id }, 
        { $set: { transferStokID: transfer._id } }
      );

      return transfer;
    } catch (error) {
      throw this.handleDbError(error, "Gagal membuat Transfer Stok.");
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    try {
      const transfer = await TransferStok.find({ tenantID })
        .populate("dariLocationID", "nama tipe")
        .populate("keLocationID", "nama tipe")
        .populate("pengirimID", "nama")
        .populate("penerimaID", "nama")
        .populate("items.bahanBakuID", "namaBahan satuan") // Konsisten dengan getById()
        .sort({ tanggalKirim: -1, createdAt: -1 });

      return transfer;
    } catch (error) {
      throw this.handleDbError(error, "Gagal mengambil daftar Transfer Stok.");
    }
  }

  // --- READ BY ID ---
  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Transfer dan Tenant ID wajib disertakan dan harus valid.",
      );

    try {
      const transfer = await TransferStok.findOne({ _id: id, tenantID })
        .populate("dariLocationID", "nama tipe")
        .populate("keLocationID", "nama tipe")
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
  }

  // --- LOGIKA UTAMA: UPDATE STATUS (Tanpa Transaksi) ---
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

          // Jurnal Stok Masuk
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

        // 🎯 LOGIKA JEMBATAN (Hanya dieksekusi jika ini berasal dari Pengajuan Pusat)
        if (transfer.pengajuanStokID) {
          const PengajuanStok = require("../models/pengajuanStokModel");
          await PengajuanStok.findOneAndUpdate(
            { _id: transfer.pengajuanStokID, tenantID },
            { status: "COMPLETED" },
          );
        }
      } else if (newStatus === "BATAL") {
        // C. TRANSAKSI DIBATALKAN
        if (oldStatus === "DIKIRIM") {
          for (const item of transfer.items) {
            // Kembalikan stok ke lokasi asal
            await Inventory.updateOne(
              {
                bahanBakuID: item.bahanBakuID,
                locationID: transfer.dariLocationID,
                tenantID,
              },
              { $inc: { stok: item.qtyKirim } },
            );

            // Jurnal Stok Pembatalan (Masuk Kembali)
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

        // 🎯 LOGIKA JEMBATAN: Set status pengajuan ke PENDING (pengiriman tertunda)
        // dan hapus referensi transferStokID agar pengajuan bisa dibuatkan Surat Jalan baru
        if (transfer.pengajuanStokID) {
          const PengajuanStok = require("../models/pengajuanStokModel");
          await PengajuanStok.findOneAndUpdate(
            { _id: transfer.pengajuanStokID, tenantID },
            {
              status: "PENDING",
              $unset: { transferStokID: "" }, // ✅ FIX: Hapus referensi agar bisa buat SJ baru
            },
          );
        }
      }

      await transfer.save();

      // FIX: Populate setelah save agar response mengandung nama pengirim/penerima,
      // bukan hanya raw ObjectID. Konsisten dengan response di GET endpoint.
      await transfer.populate('pengirimID', 'nama');
      await transfer.populate('penerimaID', 'nama');

      // --- TAMBAHAN: Invalidate Redis Cache ---
      const redis = require("../config/redis");
      if (redis.del) {
        await redis.del(`inventory:list:${tenantID}`);
        await redis.del(`jurnalstok:list:${tenantID}`); // FIX: Clear jurnal cache
      }

      return transfer;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(
        error,
        "Gagal memperbarui status Transfer Stok.",
      );
    }
  }

  // --- UPDATE DRAFT (Hanya Boleh Saat Status PENDING) ---
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
  }

  // --- DELETE DRAFT (Hanya Boleh Saat Status PENDING) ---
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
