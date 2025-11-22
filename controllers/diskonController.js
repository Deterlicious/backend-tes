const Diskon = require('../models/diskonModel'); 
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


// CREATE: Tambah Diskon
exports.createDiskon = async (req, res) => {
  try {
    const diskon = await Diskon.create(req.body);
    res.status(201).json({
      message: 'Diskon berhasil ditambahkan',
      data: diskon
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllDiskon = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ 
        message: 'Parameter tenantID wajib disertakan di query.' 
      });
    }

    const diskon = await Diskon.find({ tenantID })
      .sort({ status: -1, nilai: -1 });

    if (diskon.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada data Diskon untuk tenant ini.' 
      });
    }

    res.status(200).json(diskon);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data Diskon',
      error: error.message
    });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getDiskonById = async (req, res) => {
  try {
    const { id } = req.params;

    const diskon = await Diskon.findById(id);

    if (!diskon) {
      return res.status(404).json({ 
        message: 'Diskon tidak ditemukan.' 
      });
    }
    res.status(200).json(diskon);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({
      message: 'Gagal mengambil data Diskon',
      error: error.message
    });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updateDiskon = async (req, res) => {
  try {
    const { id } = req.params;
    
    // --- Solusi Error "_id": Hapus field yang tidak boleh diupdate dari body ---
    const updateData = { ...req.body };
    delete updateData._id; 
    delete updateData.tenantID; 
    // -----------------------------------------------------------------

    const diskon = await Diskon.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true 
    });

    if (!diskon) {
      return res.status(404).json({ message: 'Diskon tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Diskon berhasil diperbarui',
      data: diskon
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deleteDiskon = async (req, res) => {
  try {
    const { id } = req.params;
    
    const diskon = await Diskon.findByIdAndDelete(id);

    if (!diskon) {
      return res.status(404).json({ message: 'Diskon tidak ditemukan' });
    }

    res.status(200).json({ message: 'Diskon berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus Diskon',
      error: error.message
    });
  }
};