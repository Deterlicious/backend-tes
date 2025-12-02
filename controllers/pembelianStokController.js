const PembelianStok = require("../models/pembelianStokModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  } // Menangani error duplikasi (misalnya pada nomorFaktur jika di-index)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar.`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Pembelian Stok (REVISI VALIDASI)
// ===============================================
exports.createPembelianStok = async (req, res) => {
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
    } // Note: Logika bisnis untuk mengurangi saldo akunKasID dan menambah stok bahanBakuID harus ditambahkan di sini.

    const pembelianStok = await PembelianStok.create(req.body);
    res.status(201).json({
      message: "Pembelian Stok berhasil ditambahkan",
      data: pembelianStok,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL (WAJIB FILTER berdasarkan tenantID) (REVISI VALIDASI)
// ===============================================
exports.getAllPembelianStok = async (req, res) => {
  try {
    const { tenantID } = req.query; // 🛑 Validasi ID format yang ketat

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const pembelianStok = await PembelianStok.find({ tenantID }) // FILTER UTAMA
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("items.bahanBakuID", "namaBahan satuan") // Populate di subdocuments
      .populate("dicatatOleh", "nama")
      .sort({ tanggal: -1, createdAt: -1 });

    if (pembelianStok.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Pembelian Stok untuk tenant ini.",
      });
    }

    res.status(200).json(pembelianStok);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Pembelian Stok",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.getPembelianStokById = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const pembelianStok = await PembelianStok.findById(id)
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("items.bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama");

    if (!pembelianStok) {
      return res.status(404).json({
        message: "Pembelian Stok tidak ditemukan.",
      });
    }
    res.status(200).json(pembelianStok);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Format ID tidak valid (CastError).",
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Gagal mengambil data Pembelian Stok",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ UPDATE (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updatePembelianStok = async (req, res) => {
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
    const allowedFields = Object.keys(PembelianStok.schema.paths);

    for (const key of Object.keys(updateData)) {
      // Pengecualian: Biarkan subdocuments seperti 'items' lolos cek kunci utama,
      // validasi detail item akan dilakukan oleh runValidators: true
      if (key !== "items" && !allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema PembelianStok.`,
          },
        });
      }
    } // 3. Jalankan Update

    const pembelianStok = await PembelianStok.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );

    if (!pembelianStok) {
      return res
        .status(404)
        .json({ message: "Pembelian Stok tidak ditemukan" });
    }

    res.status(200).json({
      message: "Pembelian Stok berhasil diperbarui",
      data: pembelianStok,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE (REVISI VALIDASI)
// ===============================================
exports.deletePembelianStok = async (req, res) => {
  try {
    const { id } = req.params;
    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // Catatan: Logika pengembalian saldo dan pengurangan stok harus ditambahkan.

    const pembelianStok = await PembelianStok.findByIdAndDelete(id);

    if (!pembelianStok) {
      return res
        .status(404)
        .json({ message: "Pembelian Stok tidak ditemukan" });
    }

    res.status(200).json({ message: "Pembelian Stok berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus Pembelian Stok",
      error: error.message,
    });
  }
};
