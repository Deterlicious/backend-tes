const BahanBaku = require("../models/bahanBakuModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  } // Menangani error duplikasi (Unique Index Error pada {tenantID, namaBahan})
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar (dalam tenant yang sama).`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Bahan Baku (REVISI VALIDASI)
// ===============================================
exports.tambahBahanBaku = async (req, res) => {
  try {
    // Pre-check: Pastikan tenantID ada di body sebelum membuat objek Mongoose
    if (
      !req.body.tenantID ||
      !mongoose.Types.ObjectId.isValid(req.body.tenantID)
    ) {
      return res.status(400).json({
        message:
          "Input tidak valid. tenantID wajib diisi dan harus berupa ObjectId yang benar.",
      });
    }

    // Catatan: Validasi namaBahan dan satuan sudah ditangani oleh Mongoose (skema)
    const bahanBaru = new BahanBaku(req.body);
    await bahanBaru.save();

    res
      .status(201)
      .json({ message: "Bahan baku berhasil ditambahkan", data: bahanBaru });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL: Filter by tenantID (REVISI VALIDASI)
// ===============================================
exports.getAllBahanBaku = async (req, res) => {
  try {
    const { tenantID } = req.query; // Validasi ID format yang ketat

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const bahanBaku = await BahanBaku.find({ tenantID }).sort({
      createdAt: -1,
    });

    if (bahanBaku.length === 0) {
      return res
        .status(404)
        .json({ message: "Tidak ada data bahan baku untuk tenant ini." });
    }

    res.status(200).json(bahanBaku);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data bahan baku",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (REVISI VALIDASI)
// ===============================================
exports.getBahanBakuById = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const bahan = await BahanBaku.findById(id);

    if (!bahan)
      return res.status(404).json({ message: "Bahan baku tidak ditemukan" });

    res.status(200).json(bahan);
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ message: "Format ID tidak valid (CastError)." });
    }
    res
      .status(500)
      .json({ message: "Gagal mengambil bahan baku", error: error.message });
  }
};

// ===============================================
// ✅ UPDATE (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updateBahanBaku = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // 1. Pengamanan: Hapus field yang tidak boleh diubah

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID; // Mencegah pemindahan bahan baku antar tenant

    // 2. KEAMANAN: Cek Field Asing/Tidak Dikenal
    const allowedFields = Object.keys(BahanBaku.schema.paths);

    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema BahanBaku.`,
          },
        });
      }
    } // 3. Jalankan Update

    const bahan = await BahanBaku.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
      context: "query", // Diperlukan untuk validasi unique index
    });

    if (!bahan)
      return res.status(404).json({ message: "Bahan baku tidak ditemukan" });

    res
      .status(200)
      .json({ message: "Bahan baku berhasil diperbarui", data: bahan });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE (REVISI VALIDASI)
// ===============================================
exports.hapusBahanBaku = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const bahan = await BahanBaku.findByIdAndDelete(id);

    if (!bahan)
      return res.status(404).json({ message: "Bahan baku tidak ditemukan" });

    res.status(200).json({ message: "Bahan baku berhasil dihapus" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal menghapus bahan baku", error: error.message });
  }
};
