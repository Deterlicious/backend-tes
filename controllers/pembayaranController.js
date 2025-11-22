const Pembayaran = require('../models/pembayaranModel'); 
const mongoose = require('mongoose');

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
    let errors = {};
    if (err.name === 'ValidationError') {
        Object.keys(err.errors).forEach((key) => {
            errors[key] = err.errors[key].message;
        });
        return { message: 'Validasi data gagal.', errors };
    }
    // Tangani error duplikasi (walaupun tidak ada index unique di Pembayaran, ini baik untuk kasus umum)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue);
        return { message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar.` };
    }
    return { message: 'Terjadi kesalahan pada server.' };
};


// CREATE: Tambah Pembayaran
exports.createPembayaran = async (req, res) => {
  try {
    // Note: Logika bisnis untuk memperbarui status penjualan dan saldo akun kas harus di sini.
    const pembayaran = await Pembayaran.create(req.body);
    res.status(201).json({
      message: 'Pembayaran berhasil ditambahkan',
      data: pembayaran
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllPembayaran = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ 
        message: 'Parameter tenantID wajib disertakan di query.' 
      });
    }

    const pembayaran = await Pembayaran.find({ tenantID })
      .populate('penjualanID', 'nomorFaktur totalBayar')
      .populate('akunKasID', 'namaAkun nomorAkun')
      .sort({ paymentTimestamp: -1, createdAt: -1 });

    if (pembayaran.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada data Pembayaran untuk tenant ini.' 
      });
    }

    res.status(200).json(pembayaran);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data Pembayaran',
      error: error.message
    });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getPembayaranById = async (req, res) => {
  try {
    const { id } = req.params;

    const pembayaran = await Pembayaran.findById(id)
      .populate('penjualanID', 'nomorFaktur totalBayar')
      .populate('akunKasID', 'namaAkun nomorAkun');

    if (!pembayaran) {
      return res.status(404).json({ 
        message: 'Pembayaran tidak ditemukan.' 
      });
    }
    res.status(200).json(pembayaran);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({
      message: 'Gagal mengambil data Pembayaran',
      error: error.message
    });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updatePembayaran = async (req, res) => {
  try {
    const { id } = req.params;
    
    // --- Solusi Error "_id": Hapus field yang tidak boleh diupdate dari body ---
    const updateData = { ...req.body };
    delete updateData._id; 
    delete updateData.tenantID; 
    // -----------------------------------------------------------------

    const pembayaran = await Pembayaran.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true // Penting agar validasi kustom Mongoose berjalan saat update
    });

    if (!pembayaran) {
      return res.status(404).json({ message: 'Pembayaran tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Pembayaran berhasil diperbarui',
      data: pembayaran
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deletePembayaran = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pembayaran = await Pembayaran.findByIdAndDelete(id);

    if (!pembayaran) {
      return res.status(404).json({ message: 'Pembayaran tidak ditemukan' });
    }

    res.status(200).json({ message: 'Pembayaran berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus Pembayaran',
      error: error.message
    });
  }
};