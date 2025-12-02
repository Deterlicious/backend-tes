const Pelanggan = require("../models/pelangganModel");
const mongoose = require("mongoose"); // Diperlukan untuk validasi ObjectId

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  }
  // Tangani error duplikasi (Unique Index Error pada {tenantID, namaPelanggan/nomorHp})
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar (dalam tenant yang sama).`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Pelanggan (REVISI VALIDASI)
// ===============================================
exports.createPelanggan = async (req, res) => {
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
    }

    const pelanggan = await Pelanggan.create(req.body);
    res.status(201).json({
      message: "Pelanggan berhasil ditambahkan",
      data: pelanggan,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL (WAJIB FILTER berdasarkan tenantID) (REVISI VALIDASI)
// ===============================================
exports.getAllPelanggan = async (req, res) => {
  try {
    const { tenantID } = req.query;

    // 🛑 Validasi ID format yang ketat
    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const pelanggan = await Pelanggan.find({ tenantID }) // FILTER UTAMA
      .sort({ namaPelanggan: 1 });

    if (pelanggan.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Pelanggan untuk tenant ini.",
      });
    }

    res.status(200).json(pelanggan);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Pelanggan",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.getPelangganById = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const pelanggan = await Pelanggan.findById(id);

    if (!pelanggan) {
      return res.status(404).json({
        message: "Pelanggan tidak ditemukan.",
      });
    }
    res.status(200).json(pelanggan);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Format ID tidak valid (CastError).",
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Gagal mengambil data Pelanggan",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ UPDATE (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updatePelanggan = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    // 1. Pengamanan: Hapus field yang tidak boleh diubah
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID; // Mencegah pemindahan dokumen antar tenant

    // 2. KEAMANAN: Cek Field Asing/Tidak Dikenal
    const allowedFields = Object.keys(Pelanggan.schema.paths);

    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema Pelanggan.`,
          },
        });
      }
    }

    const pelanggan = await Pelanggan.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true, // Penting agar validasi kustom Mongoose berjalan saat update
      context: "query", // Diperlukan untuk validasi unique index
    });

    if (!pelanggan) {
      return res.status(404).json({ message: "Pelanggan tidak ditemukan" });
    }

    res.status(200).json({
      message: "Pelanggan berhasil diperbarui",
      data: pelanggan,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.deletePelanggan = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const pelanggan = await Pelanggan.findByIdAndDelete(id);

    if (!pelanggan) {
      return res.status(404).json({ message: "Pelanggan tidak ditemukan" });
    }

    res.status(200).json({ message: "Pelanggan berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus Pelanggan",
      error: error.message,
    });
  }
};
