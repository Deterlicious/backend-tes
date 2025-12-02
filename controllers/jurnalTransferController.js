const JurnalTransfer = require("../models/jurnalTransferModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar.`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Jurnal Transfer (REVISI VALIDASI)
// ===============================================
exports.createJurnalTransfer = async (req, res) => {
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
    } // Note: Logika bisnis untuk mengurangi saldo kasSumberID dan menambah saldo kasTujuanID harus ditambahkan di sini.

    const jurnalTransfer = await JurnalTransfer.create(req.body);
    res.status(201).json({
      message: "Jurnal Transfer berhasil ditambahkan",
      data: jurnalTransfer,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL (WAJIB FILTER berdasarkan tenantID) (REVISI VALIDASI)
// ===============================================
exports.getAllJurnalTransfer = async (req, res) => {
  try {
    const { tenantID } = req.query; // Validasi ID format yang ketat

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const jurnalTransfer = await JurnalTransfer.find({ tenantID }) // FILTER UTAMA
      .populate("kasSumberID", "namaAkun nomorAkun")
      .populate("kasTujuanID", "namaAkun nomorAkun")
      .populate("dicatatOleh", "nama")
      .sort({ tanggal: -1, createdAt: -1 });

    if (jurnalTransfer.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Jurnal Transfer untuk tenant ini.",
      });
    }

    res.status(200).json(jurnalTransfer);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Jurnal Transfer",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.getJurnalTransferById = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const jurnalTransfer = await JurnalTransfer.findById(id)
      .populate("kasSumberID", "namaAkun nomorAkun")
      .populate("kasTujuanID", "namaAkun nomorAkun")
      .populate("dicatatOleh", "nama");

    if (!jurnalTransfer) {
      return res.status(404).json({
        message: "Jurnal Transfer tidak ditemukan.",
      });
    }
    res.status(200).json(jurnalTransfer);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Format ID tidak valid (CastError).",
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Gagal mengambil data Jurnal Transfer",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ UPDATE (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updateJurnalTransfer = async (req, res) => {
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
    const allowedFields = Object.keys(JurnalTransfer.schema.paths);

    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema JurnalTransfer.`,
          },
        });
      }
    } // 3. Jalankan Update

    const jurnalTransfer = await JurnalTransfer.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );

    if (!jurnalTransfer) {
      return res
        .status(404)
        .json({ message: "Jurnal Transfer tidak ditemukan" });
    }

    res.status(200).json({
      message: "Jurnal Transfer berhasil diperbarui",
      data: jurnalTransfer,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.deleteJurnalTransfer = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // Catatan: Logika pengembalian saldo Kas Sumber/Tujuan harus ditambahkan.

    const jurnalTransfer = await JurnalTransfer.findByIdAndDelete(id);

    if (!jurnalTransfer) {
      return res
        .status(404)
        .json({ message: "Jurnal Transfer tidak ditemukan" });
    }

    res.status(200).json({ message: "Jurnal Transfer berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus Jurnal Transfer",
      error: error.message,
    });
  }
};
