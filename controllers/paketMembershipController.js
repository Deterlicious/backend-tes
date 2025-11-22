const PaketMembership = require('../models/paketMembershipModel');
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
    // Tangani error duplikasi (Unique Index Error)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue);
        return { message: `Gagal menambahkan/memperbarui. ${field} '${err.keyValue[field]}' sudah terdaftar.` };
    }
    return { message: 'Terjadi kesalahan pada server.' };
};

// CREATE: Tambah Paket Membership
exports.createPaketMembership = async (req, res) => {
  try {
    const paketMembership = await PaketMembership.create(req.body);
    res.status(201).json({
      message: 'Paket Membership berhasil ditambahkan',
      data: paketMembership
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllPaketMembership = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ 
        message: 'Parameter tenantID wajib disertakan di query.' 
      });
    }

    const paketMembership = await PaketMembership.find({ tenantID })
      .sort({ harga: 1 });

    if (paketMembership.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada data Paket Membership untuk tenant ini.' 
      });
    }

    res.status(200).json(paketMembership);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data Paket Membership',
      error: error.message
    });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getPaketMembershipById = async (req, res) => {
  try {
    const { id } = req.params;

    const paketMembership = await PaketMembership.findById(id);

    if (!paketMembership) {
      return res.status(404).json({ 
        message: 'Paket Membership tidak ditemukan.' 
      });
    }
    res.status(200).json(paketMembership);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({
      message: 'Gagal mengambil data Paket Membership',
      error: error.message
    });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updatePaketMembership = async (req, res) => {
  try {
    const { id } = req.params;

    const paketMembership = await PaketMembership.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true // Penting agar validasi kustom Mongoose berjalan saat update
    });

    if (!paketMembership) {
      return res.status(404).json({ message: 'Paket Membership tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Paket Membership berhasil diperbarui',
      data: paketMembership
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deletePaketMembership = async (req, res) => {
  try {
    const { id } = req.params;
    
    const paketMembership = await PaketMembership.findByIdAndDelete(id);

    if (!paketMembership) {
      return res.status(404).json({ message: 'Paket Membership tidak ditemukan' });
    }

    res.status(200).json({ message: 'Paket Membership berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus Paket Membership',
      error: error.message
    });
  }
};