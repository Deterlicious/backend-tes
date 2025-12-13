// jurnalStokService.js
const JurnalStok = require("../models/jurnalStokModel");
// Asumsi: Model Inventory / Stok per Lokasi
const Inventory = require("../models/inventoryModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const { validateJurnalPayload } = require("../validators/jurnalStokValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper: Tentukan operasi update stok (+/-)
const getStokOperation = (tipe) => {
  switch (tipe) {
    case "masuk":
      return 1; // +jumlah
    case "keluar":
      return -1; // -jumlah
    case "penyesuaian":
      return 1; // Untuk penyesuaian, kita asumsikan defaultnya menambah, atau ubah logika di controller/validator jika ada status penyesuaian 'minus'
    default:
      return 0;
  }
};

class JurnalStokService {
  // Helper: Menangani Error Mongoose
  handleDbError(error, defaultMessage = "Gagal memproses data Jurnal Stok") {
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
  } // --- CREATE ---

  async create(payload) {
    const validation = validateJurnalPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      }); // Tidak ada session lagi

    try {
      // Asumsi: payload mencakup locationID, bahanBakuID, tenantID
      const { bahanBakuID, locationID, tenantID, tipe, jumlah } = payload; // 1. BUAT DOKUMEN JURNAL STOK

      const jurnalStok = await JurnalStok.create(payload); // 2. LOGIKA BISNIS: UPDATE STOK BAHAN BAKU (Inventory/Stok per Lokasi)

      const operation = getStokOperation(tipe);
      const amount = operation * jumlah; // Menggunakan findOneAndUpdate dengan $inc (atomik pada satu dokumen)

      const updateResult = await Inventory.findOneAndUpdate(
        {
          bahanBakuID: bahanBakuID,
          locationID: locationID,
          tenantID: tenantID,
        },
        { $inc: { stok: amount } },
        { new: true } // Opsi { new: true } untuk mendapatkan dokumen stok yang baru
      );

      if (!updateResult) {
        // Jika stok tidak ditemukan, buat entri stok baru (asumsi: stok awal 0)
        await Inventory.create({
          bahanBakuID,
          locationID,
          tenantID,
          stok: amount, // Jumlah awal adalah jumlah yang masuk/keluar
        });
      } // Tidak ada commitTransaction

      return jurnalStok;
    } catch (error) {
      // Tidak ada abortTransaction
      throw this.handleDbError(error, "Gagal menambahkan Jurnal Stok.");
    }
  } // --- READ ALL ---

  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    try {
      const jurnalStok = await JurnalStok.find({ tenantID })
        .populate("bahanBakuID", "namaBahan satuan")
        .populate("dicatatOleh", "nama")
        .sort({ tanggal: -1, createdAt: -1 });

      if (jurnalStok.length === 0)
        throw createError(404, "Tidak ada data Jurnal Stok untuk tenant ini.");

      return jurnalStok;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal mengambil daftar Jurnal Stok.");
    }
  } // --- READ BY ID ---

  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Jurnal dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      const jurnalStok = await JurnalStok.findOne({ _id: id, tenantID })
        .populate("bahanBakuID", "namaBahan satuan")
        .populate("dicatatOleh", "nama");

      if (!jurnalStok)
        throw createError(
          404,
          "Jurnal Stok tidak ditemukan atau Anda tidak memiliki akses."
        );

      return jurnalStok;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal mengambil detail Jurnal Stok.");
    }
  } // --- UPDATE ---

  async update(tenantID, id, payload) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Jurnal dan Tenant ID wajib disertakan dan harus valid."
      );

    const validation = validateJurnalPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const updates = validation.updates; // 1. Ambil data lama dan pastikan kepemilikan

      const oldJurnal = await JurnalStok.findOne({ _id: id, tenantID });
      if (!oldJurnal)
        throw createError(
          404,
          "Jurnal Stok tidak ditemukan atau Anda tidak memiliki akses."
        );

      const oldAmount = getStokOperation(oldJurnal.tipe) * oldJurnal.jumlah; // Jumlah stok yang terpengaruh oleh transaksi lama // Karena tipe jurnal tidak boleh berubah saat update, kita hanya menghitung newAmount berdasarkan newJumlah
      const newAmount =
        getStokOperation(oldJurnal.tipe) * (updates.jumlah || oldJurnal.jumlah);

      // Hitung selisih perubahan stok (yang lama dikembalikan, yang baru diterapkan)
      const diffAmount = newAmount - oldAmount; // 2. UPDATE JURNAL (Dilakukan pertama agar segera mencatat perubahan)

      const updatedJurnal = await JurnalStok.findOneAndUpdate(
        { _id: id, tenantID: tenantID },
        updates,
        { new: true, runValidators: true }
      );

      if (!updatedJurnal)
        throw createError(404, "Gagal memperbarui Jurnal Stok."); // 3. LOGIKA BISNIS: TERAPKAN PERUBAHAN STOK (Menggunakan $inc diffAmount)

      await Inventory.updateOne(
        {
          bahanBakuID: updatedJurnal.bahanBakuID,
          locationID: updatedJurnal.locationID,
          tenantID,
        },
        { $inc: { stok: diffAmount } } // Terapkan selisih antara nilai lama dan baru
      );

      return updatedJurnal;
    } catch (error) {
      throw this.handleDbError(error, "Gagal memperbarui Jurnal Stok.");
    }
  } // --- DELETE ---

  async delete(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Jurnal dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      // 1. HAPUS DOKUMEN JURNAL (Ambil data sebelum dihapus)
      const deletedJurnal = await JurnalStok.findOneAndDelete({
        _id: id,
        tenantID: tenantID,
      });

      if (!deletedJurnal)
        throw createError(
          404,
          "Jurnal Stok tidak ditemukan atau Anda tidak memiliki akses."
        ); // 2. LOGIKA BISNIS: KEMBALIKAN STOK BAHAN BAKU (Reverse Transaction)

      const amountToReverse =
        getStokOperation(deletedJurnal.tipe) * deletedJurnal.jumlah;
      const reverseAmount = -amountToReverse; // Jika masuk (+), dikembalikan jadi (-)

      await Inventory.updateOne(
        {
          bahanBakuID: deletedJurnal.bahanBakuID,
          locationID: deletedJurnal.locationID,
          tenantID,
        },
        { $inc: { stok: reverseAmount } }
      );

      return { message: "Jurnal Stok berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus Jurnal Stok.");
    }
  }
}

module.exports = new JurnalStokService();
