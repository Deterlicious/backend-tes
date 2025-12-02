const KategoriBeban = require("../models/kategoriBebanModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
// (ASUMSI fungsi ini sudah didefinisikan atau diimpor)
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  } // Menangani error duplikasi (Unique Index Error pada {tenantID, namaKategori})
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar (dalam tenant yang sama).`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Kategori Beban (REVISI VALIDASI)
// ===============================================
exports.createKategoriBeban = async (req, res) => {
  try {
    // Pre-check: Pastikan tenantID ada di body dan valid
    if (
      !req.body.tenantID ||
      !mongoose.Types.ObjectId.isValid(req.body.tenantID)
    ) {
      return res.status(400).json({
        message:
          "Input tidak valid. tenantID wajib diisi dan harus berupa ObjectId yang benar.",
      });
    }

    const kategoriBeban = await KategoriBeban.create(req.body);
    res.status(201).json({
      message: "Kategori Beban berhasil ditambahkan",
      data: kategoriBeban,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL (WAJIB FILTER berdasarkan tenantID) (REVISI VALIDASI)
// ===============================================
exports.getAllKategoriBeban = async (req, res) => {
  try {
    const { tenantID } = req.query; //  Validasi ID format yang ketat

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const kategoriBeban = await KategoriBeban.find({ tenantID }) // FILTER UTAMA
      .sort({ namaKategori: 1 });

    if (kategoriBeban.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Kategori Beban untuk tenant ini.",
      });
    }

    res.status(200).json(kategoriBeban);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Kategori Beban",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.getKategoriBebanById = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const kategoriBeban = await KategoriBeban.findById(id);

    if (!kategoriBeban) {
      return res.status(404).json({
        message: "Kategori Beban tidak ditemukan.",
      });
    }
    res.status(200).json(kategoriBeban);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Format ID tidak valid (CastError).",
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Gagal mengambil data Kategori Beban",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ UPDATE (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updateKategoriBeban = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // 1. Pengamanan: Hapus field yang tidak boleh diubah

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID; // Mencegah pemindahan dokumen antar tenant

    // 2. KEAMANAN: Cek Field Asing/Tidak Dikenal
    const allowedFields = Object.keys(KategoriBeban.schema.paths);

    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema KategoriBeban.`,
          },
        });
      }
    } // 3. Jalankan Update

    const kategoriBeban = await KategoriBeban.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
        context: "query", // Diperlukan untuk validasi unique index
      }
    );

    if (!kategoriBeban) {
      return res
        .status(404)
        .json({ message: "Kategori Beban tidak ditemukan" });
    }

    res.status(200).json({
      message: "Kategori Beban berhasil diperbarui",
      data: kategoriBeban,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.deleteKategoriBeban = async (req, res) => {
  try {
    const { id } = req.params;
    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const kategoriBeban = await KategoriBeban.findByIdAndDelete(id);

    if (!kategoriBeban) {
      return res
        .status(404)
        .json({ message: "Kategori Beban tidak ditemukan" });
    }

    res.status(200).json({ message: "Kategori Beban berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus Kategori Beban",
      error: error.message,
    });
  }
};
