const Penjualan = require("../models/penjualanModel");
const Diskon = require("../models/diskonModel"); // <-- Pastikan Anda memiliki model Diskon
const mongoose = require("mongoose");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail error.", errors };
  } // Tangani error duplikasi (nomorFaktur)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return {
      message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar.`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// CREATE: Tambah Penjualan (REVISI)
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

        const diskon = await Diskon.findById(item.diskonID); // Periksa jika diskon tidak ada atau statusnya Non-Aktif

        if (!diskon || diskon.status === "Non-Aktif") {
          return res.status(400).json({
            message: `Validasi gagal. Item ${index + 1}: Diskon dengan ID ${
              item.diskonID
            } berstatus Non-Aktif dan tidak dapat digunakan dalam penjualan ini.`,
          });
        }
      }
    } // 3. Proses Pembuatan Penjualan // Note: Logika bisnis pengurangan stok produk harus ditambahkan di sini.

    const penjualan = await Penjualan.create(req.body);
    res.status(201).json({
      message: "Penjualan berhasil ditambahkan",
      data: penjualan,
    });
  } catch (error) {
    // Penanganan error Mongoose (ValidationError, Duplicate Key Error)
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllPenjualan = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({
        message: "Parameter tenantID wajib disertakan di query.",
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

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getPenjualanById = async (req, res) => {
  try {
    const { id } = req.params;

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
// UPDATE (REVISI)
// ===============================================
exports.updatePenjualan = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemPenjualan } = req.body; // Hapus field yang tidak boleh diupdate

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID;

    // 1. Validasi Logika Bisnis (Status Diskon) pada saat update
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

    const penjualan = await Penjualan.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
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

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deletePenjualan = async (req, res) => {
  try {
    const { id } = req.params;

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
