const JurnalStok = require("../models/jurnalStokModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  } // JurnalStok tidak memiliki unique index selain _id, jadi hanya tangani CastError/ValidationError
  if (err.name === "CastError") {
    return { message: "Format ID tidak valid.", errors: { id: err.message } };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Jurnal Stok (REVISI VALIDASI)
// ===============================================
exports.createJurnalStok = async (req, res) => {
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
    } // Note: Logika bisnis pengurangan stok bahan baku harus ditambahkan di sini.

    const jurnalStok = await JurnalStok.create(req.body);
    res.status(201).json({
      message: "Jurnal Stok berhasil ditambahkan",
      data: jurnalStok,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL (WAJIB FILTER berdasarkan tenantID) (REVISI VALIDASI)
// ===============================================
exports.getAllJurnalStok = async (req, res) => {
  try {
    const { tenantID } = req.query; //Validasi ID format yang ketat

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const jurnalStok = await JurnalStok.find({ tenantID })
      .populate("bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama")
      .sort({ tanggal: -1, createdAt: -1 });

    if (jurnalStok.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Jurnal Stok untuk tenant ini.",
      });
    }

    res.status(200).json(jurnalStok);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Jurnal Stok",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.getJurnalStokById = async (req, res) => {
  try {
    const { id } = req.params; // Pre-check: Validasi ID format

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const jurnalStok = await JurnalStok.findById(id)
      .populate("bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama");

    if (!jurnalStok) {
      return res.status(404).json({
        message: "Jurnal Stok tidak ditemukan.",
      });
    }
    res.status(200).json(jurnalStok);
  } catch (error) {
    // Tangani error Mongoose lainnya
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ UPDATE (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updateJurnalStok = async (req, res) => {
  try {
    const { id } = req.params; // Pre-check: Validasi ID format

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // 1. Pengamanan: Hapus field yang tidak boleh diubah

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID; // Mencegah pemindahan dokumen antar tenant // 2. KEAMANAN: Cek Field Asing/Tidak Dikenal
    const allowedFields = Object.keys(JurnalStok.schema.paths);
    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema JurnalStok.`,
          },
        });
      }
    } // 3. Jalankan Update

    const jurnalStok = await JurnalStok.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
      context: "query",
    });

    if (!jurnalStok) {
      return res.status(404).json({ message: "Jurnal Stok tidak ditemukan" });
    }

    res.status(200).json({
      message: "Jurnal Stok berhasil diperbarui",
      data: jurnalStok,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.deleteJurnalStok = async (req, res) => {
  try {
    const { id } = req.params; // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const jurnalStok = await JurnalStok.findByIdAndDelete(id);

    if (!jurnalStok) {
      return res.status(404).json({ message: "Jurnal Stok tidak ditemukan" });
    }

    res.status(200).json({ message: "Jurnal Stok berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus Jurnal Stok",
      error: error.message,
    });
  }
};
