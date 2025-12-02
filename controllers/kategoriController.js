const Kategori = require("../models/kategoriModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
// (Pastikan fungsi ini ada di file controller Anda atau diimpor)
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  } // Menangani error duplikasi (Unique Index Error pada {tenantID, namaKategori} atau {tenantID, kodeKategori})
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar (dalam tenant yang sama).`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Kategori (REVISI VALIDASI)
// ===============================================
exports.createKategori = async (req, res) => {
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

    const kategori = await Kategori.create(req.body);
    res.status(201).json({
      message: "Kategori berhasil ditambahkan",
      data: kategori,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ Tampilkan semua kategori (REVISI VALIDASI)
// ===============================================
exports.getAllKategori = async (req, res) => {
  try {
    const { tenantID } = req.query; //  Validasi ID format yang ketat

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    } // Cari kategori

    const kategori = await Kategori.find({ tenantID })
      .populate("tenantID", "namaTenant") // Populating hanya field yang relevan
      .sort({ createdAt: -1 }); // Periksa jika tidak ada data ditemukan

    if (kategori.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data kategori untuk tenant ini.",
        data: [],
      });
    } // ✅ Kirim data yang ditemukan

    res.status(200).json(kategori);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data kategori",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ Tampilkan kategori berdasarkan ID (REVISI VALIDASI)
// ===============================================
exports.getKategoriById = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const kategori = await Kategori.findById(id).populate(
      "tenantID",
      "namaTenant"
    );

    if (!kategori) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    res.status(200).json(kategori);
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ message: "Format ID tidak valid (CastError)." });
    }
    res.status(500).json({
      message: "Gagal mengambil data kategori",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ Update kategori (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updateKategori = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // 1. Pengamanan: Hapus field yang tidak boleh diubah

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID; // Mencegah pemindahan kategori antar tenant

    // 2. KEAMANAN: Cek Field Asing/Tidak Dikenal
    const allowedFields = Object.keys(Kategori.schema.paths);

    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema Kategori.`,
          },
        });
      }
    } // 3. Jalankan Update

    const kategori = await Kategori.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
      context: "query", // Diperlukan untuk validasi unique index
    });

    if (!kategori) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }

    res.status(200).json({
      message: "Kategori berhasil diperbarui",
      data: kategori,
    });
  } catch (error) {
    // Menangkap Mongoose validation errors (required, unique index)
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ Hapus kategori (REVISI VALIDASI)
// ===============================================
exports.deleteKategori = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const kategori = await Kategori.findByIdAndDelete(id);

    if (!kategori) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }

    res.status(200).json({ message: "Kategori berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus kategori",
      error: error.message,
    });
  }
};
