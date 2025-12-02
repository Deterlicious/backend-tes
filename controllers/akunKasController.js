const AkunKas = require("../models/akunKasModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
// PASTIKAN FUNGSI INI DISEDIAKAN DI FILE CONTROLLER ANDA
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  } // Menangani error duplikasi (Unique Index Error pada {tenantID, nomorAkun})
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar (dalam tenant yang sama).`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Akun Kas (REVISI VALIDASI)
// ===============================================
exports.createAkunKas = async (req, res) => {
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

    const akunKas = await AkunKas.create(req.body);
    res.status(201).json({
      message: "Akun Kas berhasil ditambahkan",
      data: akunKas,
    });
  } catch (error) {
    // Menggunakan helper untuk menampilkan error validasi dan duplikasi
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL: Filter berdasarkan tenantID (REVISI VALIDASI)
// ===============================================
exports.getAllAkunKas = async (req, res) => {
  try {
    const { tenantID } = req.query; // Validasi ID format yang ketat

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const akunKas = await AkunKas.find({ tenantID }).sort({ createdAt: -1 });

    if (akunKas.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Akun Kas untuk tenant ini.",
      });
    }

    res.status(200).json(akunKas);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Akun Kas",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (REVISI VALIDASI)
// ===============================================
exports.getAkunKasById = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const akunKas = await AkunKas.findById(id);

    if (!akunKas) {
      return res.status(404).json({ message: "Akun Kas tidak ditemukan." });
    }

    res.status(200).json(akunKas);
  } catch (error) {
    // Tangani error jika ID tidak valid yang lolos pre-check
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Format ID tidak valid.",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Gagal mengambil data Akun Kas",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ UPDATE Akun Kas (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updateAkunKas = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params; // Validasi ID format yang ketat

    if (
      !tenantID ||
      !mongoose.Types.ObjectId.isValid(tenantID) ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        message: "Parameter tenantID dan ID wajib disertakan dan harus valid.",
      });
    } // 1. Pengamanan: Hapus field yang tidak boleh diubah

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID; // Mencegah pemindahan akun antar tenant

    // 2. KEAMANAN: Cek Field Asing/Tidak Dikenal (Konsisten dengan controller lain)
    const allowedFields = Object.keys(AkunKas.schema.paths);

    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema AkunKas.`,
          },
        });
      }
    } // 3. Jalankan Update (Difilter berdasarkan _id dan tenantID untuk keamanan)

    const akunKas = await AkunKas.findOneAndUpdate(
      { _id: id, tenantID },
      updateData, // Gunakan data yang sudah dibersihkan
      {
        new: true,
        runValidators: true,
        context: "query", // Diperlukan untuk validasi unique index
      }
    );

    if (!akunKas) {
      return res.status(404).json({
        message: "Akun Kas tidak ditemukan atau Anda tidak memiliki akses.",
      });
    }

    res.status(200).json({
      message: "Akun Kas berhasil diperbarui",
      data: akunKas,
    });
  } catch (error) {
    // Menggunakan helper untuk menampilkan error validasi dan duplikasi
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE Akun Kas (REVISI VALIDASI)
// ===============================================
exports.deleteAkunKas = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params; // Validasi ID format yang ketat

    if (
      !tenantID ||
      !mongoose.Types.ObjectId.isValid(tenantID) ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        message: "Parameter tenantID dan ID wajib disertakan dan harus valid.",
      });
    } // Hapus (Difilter berdasarkan _id dan tenantID untuk keamanan)

    const akunKas = await AkunKas.findOneAndDelete({ _id: id, tenantID });

    if (!akunKas) {
      return res.status(404).json({
        message: "Akun Kas tidak ditemukan atau Anda tidak memiliki akses.",
      });
    }

    res.status(200).json({ message: "Akun Kas berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus Akun Kas",
      error: error.message,
    });
  }
};
