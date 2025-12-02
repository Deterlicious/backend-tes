const Penjualan = require("../models/penjualanModel");
const Diskon = require("../models/diskonModel");
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif (Harus tersedia/diimpor)
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail error.", errors };
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
// ✅ CREATE: Tambah Penjualan (REVISI FINAL)
// ===============================================
exports.createPenjualan = async (req, res) => {
  try {
    const { tenantID, itemPenjualan } = req.body; // 1. Validasi Input Awal (Pre-check)

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res
        .status(400)
        .json({
          message:
            "Input tidak valid. tenantID wajib diisi dan harus berupa ObjectId yang benar.",
        });
    }
    if (!itemPenjualan || itemPenjualan.length === 0) {
      return res
        .status(400)
        .json({
          message:
            "Input tidak valid. itemPenjualan wajib diisi dan tidak boleh kosong.",
        });
    } // 2. Validasi Logika Bisnis (Status Diskon)

    for (const [index, item] of itemPenjualan.entries()) {
      if (item.diskonID) {
        if (!mongoose.Types.ObjectId.isValid(item.diskonID)) {
          return res
            .status(400)
            .json({
              message: `Input itemPenjualan[${index}]: diskonID tidak valid.`,
            });
        }

        const diskon = await Diskon.findById(item.diskonID);

        if (!diskon || diskon.status === "Non-Aktif") {
          return res.status(400).json({
            message: `Validasi gagal. Item ${index + 1}: Diskon dengan ID ${
              item.diskonID
            } berstatus Non-Aktif dan tidak dapat digunakan dalam penjualan ini.`,
          });
        }
      }
    } // 3. Proses Pembuatan Penjualan

    const penjualan = await Penjualan.create(req.body);
    res.status(201).json({
      message: "Penjualan berhasil ditambahkan",
      data: penjualan,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL (WAJIB FILTER berdasarkan tenantID) (REVISI ID CHECK)
// ===============================================
exports.getAllPenjualan = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const penjualan = await Penjualan.find({ tenantID })
      .populate("namaPelanggan", "namaPelanggan")
      .populate("itemPenjualan.produkID", "namaProduk")
      .populate("itemPenjualan.diskonID", "namaDiskon tipe nilai")
      .sort({ tanggalPenjualan: -1 });

    if (penjualan.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Penjualan untuk tenant ini.",
      });
    }

    res.status(200).json(penjualan);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Penjualan",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI ID CHECK)
// ===============================================
exports.getPenjualanById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const penjualan = await Penjualan.findById(id)
      .populate("namaPelanggan", "namaPelanggan")
      .populate("itemPenjualan.produkID", "namaProduk")
      .populate("itemPenjualan.diskonID", "namaDiskon tipe nilai");

    if (!penjualan) {
      return res.status(404).json({ message: "Penjualan tidak ditemukan." });
    }
    res.status(200).json(penjualan);
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ message: "Format ID tidak valid.", error: error.message });
    }
    res.status(500).json({
      message: "Gagal mengambil data Penjualan",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ UPDATE (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updatePenjualan = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemPenjualan } = req.body;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // Hapus field yang tidak boleh diupdate

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID; // 1. Validasi Logika Bisnis (Status Diskon) pada saat update

    if (itemPenjualan && itemPenjualan.length > 0) {
      for (const [index, item] of itemPenjualan.entries()) {
        if (item.diskonID) {
          if (!mongoose.Types.ObjectId.isValid(item.diskonID)) {
            return res
              .status(400)
              .json({
                message: `Input itemPenjualan[${index}]: diskonID tidak valid.`,
              });
          }
          const diskon = await Diskon.findById(item.diskonID);
          if (!diskon || diskon.status === "Non-Aktif") {
            return res.status(400).json({
              message: `Validasi gagal. Item ${index + 1}: Diskon dengan ID ${
                item.diskonID
              } berstatus Non-Aktif dan tidak dapat digunakan dalam penjualan ini.`,
            });
          }
        }
      }
    }

    // 2. KEAMANAN: Cek Field Asing/Tidak Dikenal (Konsisten dengan controller lain)
    const allowedFields = Object.keys(Penjualan.schema.paths);

    for (const key of Object.keys(updateData)) {
      // Pengecualian: Biarkan subdocuments seperti 'itemPenjualan' lolos cek kunci utama,
      // validasi detail item akan dilakukan oleh runValidators: true
      if (key !== "itemPenjualan" && !allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema Penjualan.`,
          },
        });
      }
    }

    const penjualan = await Penjualan.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
      context: "query", // Diperlukan untuk validasi unique index pada update
    });

    if (!penjualan) {
      return res.status(404).json({ message: "Penjualan tidak ditemukan" });
    }

    res.status(200).json({
      message: "Penjualan berhasil diperbarui",
      data: penjualan,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI ID CHECK)
// ===============================================
exports.deletePenjualan = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const penjualan = await Penjualan.findByIdAndDelete(id);

    if (!penjualan) {
      return res.status(404).json({ message: "Penjualan tidak ditemukan" });
    }

    res.status(200).json({ message: "Penjualan berhasil dihapus" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal menghapus Penjualan", error: error.message });
  }
};
