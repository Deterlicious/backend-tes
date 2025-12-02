const Produk = require("../models/produkModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk validasi Mongoose yang informatif
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  } // Tangani error duplikasi (Unique Index Error pada {tenantID, namaProduk})
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar (dalam tenant yang sama).`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Produk Baru
// ===============================================
exports.createProduk = async (req, res) => {
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

    const produkBaru = new Produk(req.body);
    const simpan = await produkBaru.save();
    res.status(201).json({
      message: "Produk berhasil ditambahkan",
      data: simpan,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL (Wajib menyertakan tenantID)
// ===============================================
exports.getAllProduk = async (req, res) => {
  try {
    const { tenantID } = req.query; // 1. Validasi tenantID (Lebih ketat)

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    } // 2. Cari produk berdasarkan tenantID

    const produk = await Produk.find({ tenantID })
      .populate("kategoriID", "namaKategori")
      .populate("resep.bahanBakuID", "namaBahan satuan") // Populate resep
      .sort({ createdAt: -1 });

    if (produk.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data produk untuk tenant ini.",
        data: [],
      });
    }

    res.status(200).json(produk);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data produk",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (Hanya menggunakan _id)
// ===============================================
exports.getProdukById = async (req, res) => {
  try {
    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const produk = await Produk.findById(req.params.id)
      .populate("kategoriID", "namaKategori")
      .populate("resep.bahanBakuID", "namaBahan satuan"); // Populate resep

    if (!produk) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }
    res.status(200).json(produk);
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ message: "Format ID tidak valid (CastError)." });
    }
    res.status(500).json({
      message: "Gagal mengambil produk",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ UPDATE Produk berdasarkan _id (DISESUAIKAN UNTUK KEAMANAN)
// ===============================================
exports.updateProduk = async (req, res) => {
  try {
    const { id } = req.params; // Pre-check: Validasi ID format

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // 1. Buat salinan data dan hapus field yang tidak boleh diubah

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID; // Mencegah pemindahan produk ke tenant lain
    // Dapatkan semua path/field yang ada di skema Produk, termasuk sub-dokumen
    // Kami menggunakan Produk.schema.paths untuk mendapatkan semua field yang diizinkan.
    const allowedFields = Object.keys(Produk.schema.paths);

    // 2. KEAMANAN: Cek Field Asing/Tidak Dikenal
    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema Produk.`,
          },
        });
      }
    } // 3. Jalankan Update

    const update = await Produk.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
      context: "query", // Diperlukan untuk validasi unique index pada update
    });

    if (!update) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    res.status(200).json({
      message: "Produk berhasil diperbarui",
      data: update,
    });
  } catch (error) {
    // Menangkap Mongoose validation errors (required, min, unique index)
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE Produk berdasarkan _id (REVISI)
// ===============================================
exports.deleteProduk = async (req, res) => {
  try {
    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const hapus = await Produk.findByIdAndDelete(req.params.id);

    if (!hapus) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    res.status(200).json({ message: "Produk berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus produk",
      error: error.message,
    });
  }
};
