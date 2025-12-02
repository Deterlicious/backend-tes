const Pembayaran = require("../models/pembayaranModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif (disertakan untuk konteks)
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  } // Tangani error duplikasi (misalnya pada penjualanID)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar.`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Pembayaran (REVISI VALIDASI)
// ===============================================
exports.createPembayaran = async (req, res) => {
  try {
    // Pre-check: Pastikan tenantID ada di body dan valid
    if (
      !req.body.tenantID ||
      !mongoose.Types.ObjectId.isValid(req.body.tenantID)
    ) {
      return res
        .status(400)
        .json({
          message:
            "Input tidak valid. tenantID wajib diisi dan harus berupa ObjectId yang benar.",
        });
    } // Note: Logika bisnis untuk memperbarui status penjualan dan saldo akun kas harus di sini.

    const pembayaran = await Pembayaran.create(req.body);
    res.status(201).json({
      message: "Pembayaran berhasil ditambahkan",
      data: pembayaran,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL (WAJIB FILTER berdasarkan tenantID) (REVISI VALIDASI)
// ===============================================
exports.getAllPembayaran = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const pembayaran = await Pembayaran.find({ tenantID })
      .populate("penjualanID", "nomorFaktur totalBayar")
      .populate("akunKasID", "namaAkun nomorAkun")
      .sort({ paymentTimestamp: -1, createdAt: -1 });

    if (pembayaran.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Pembayaran untuk tenant ini.",
      });
    }

    res.status(200).json(pembayaran);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Pembayaran",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.getPembayaranById = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const pembayaran = await Pembayaran.findById(id)
      .populate("penjualanID", "nomorFaktur totalBayar")
      .populate("akunKasID", "namaAkun nomorAkun");

    if (!pembayaran) {
      return res.status(404).json({
        message: "Pembayaran tidak ditemukan.",
      });
    }
    res.status(200).json(pembayaran);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Format ID tidak valid (CastError).",
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Gagal mengambil data Pembayaran",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ UPDATE (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updatePembayaran = async (req, res) => {
  try {
    const { id } = req.params;
    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // 1. Pengamanan: Hapus field yang tidak boleh diubah

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID;
    delete updateData.penjualanID; // ID Penjualan tidak boleh diubah setelah dibuat

    // 2. KEAMANAN: Cek Field Asing/Tidak Dikenal
    const allowedFields = Object.keys(Pembayaran.schema.paths);

    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema Pembayaran.`,
          },
        });
      }
    } // 3. Jalankan Update

    const pembayaran = await Pembayaran.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true, // Penting agar validasi kustom Mongoose berjalan saat update
      context: "query",
    });

    if (!pembayaran) {
      return res.status(404).json({ message: "Pembayaran tidak ditemukan" });
    }

    res.status(200).json({
      message: "Pembayaran berhasil diperbarui",
      data: pembayaran,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.deletePembayaran = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // Catatan: Logika pengembalian saldo dan pembaruan status penjualan harus ditambahkan.

    const pembayaran = await Pembayaran.findByIdAndDelete(id);

    if (!pembayaran) {
      return res.status(404).json({ message: "Pembayaran tidak ditemukan" });
    }

    res.status(200).json({ message: "Pembayaran berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus Pembayaran",
      error: error.message,
    });
  }
};
