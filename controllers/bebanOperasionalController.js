const BebanOperasional = require("../models/bebanOperasionalModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  } // BebanOperasional tidak memiliki unique index selain _id, jadi hanya tangani CastError/ValidationError
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar.`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Beban Operasional (REVISI VALIDASI)
// ===============================================
exports.createBebanOperasional = async (req, res) => {
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
    } // Note: Logika bisnis untuk mengurangi saldo akunKasID harus ditambahkan di sini.

    const bebanOperasional = await BebanOperasional.create(req.body);
    res.status(201).json({
      message: "Beban Operasional berhasil ditambahkan",
      data: bebanOperasional,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL (WAJIB FILTER berdasarkan tenantID) (REVISI VALIDASI)
// ===============================================
exports.getAllBebanOperasional = async (req, res) => {
  try {
    const { tenantID } = req.query; // Validasi ID format yang ketat

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const bebanOperasional = await BebanOperasional.find({ tenantID }) // FILTER UTAMA
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("kategoriBebanID", "namaKategori")
      .populate("dicatatOleh", "nama")
      .sort({ tanggal: -1, createdAt: -1 });

    if (bebanOperasional.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Beban Operasional untuk tenant ini.",
      });
    }

    res.status(200).json(bebanOperasional);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Beban Operasional",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.getBebanOperasionalById = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const bebanOperasional = await BebanOperasional.findById(id)
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("kategoriBebanID", "namaKategori")
      .populate("dicatatOleh", "nama");

    if (!bebanOperasional) {
      return res.status(404).json({
        message: "Beban Operasional tidak ditemukan.",
      });
    }
    res.status(200).json(bebanOperasional);
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ UPDATE (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updateBebanOperasional = async (req, res) => {
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
    const allowedFields = Object.keys(BebanOperasional.schema.paths);

    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema BebanOperasional.`,
          },
        });
      }
    } // Catatan: Logika pembaruan saldo Kas Sumber harus dipertimbangkan.

    const bebanOperasional = await BebanOperasional.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );

    if (!bebanOperasional) {
      return res
        .status(404)
        .json({ message: "Beban Operasional tidak ditemukan" });
    }

    res.status(200).json({
      message: "Beban Operasional berhasil diperbarui",
      data: bebanOperasional,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.deleteBebanOperasional = async (req, res) => {
  try {
    const { id } = req.params;
    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // Catatan: Logika pengembalian saldo Akun Kas harus ditambahkan.

    const bebanOperasional = await BebanOperasional.findByIdAndDelete(id);

    if (!bebanOperasional) {
      return res
        .status(404)
        .json({ message: "Beban Operasional tidak ditemukan" });
    }

    res.status(200).json({ message: "Beban Operasional berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus Beban Operasional",
      error: error.message,
    });
  }
};
