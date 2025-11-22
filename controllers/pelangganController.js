const Pelanggan = require('../models/pelangganModel');

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
    let errors = {};
    if (err.name === 'ValidationError') {
        Object.keys(err.errors).forEach((key) => {
            errors[key] = err.errors[key].message;
        });
        return { message: 'Validasi data gagal.', errors };
    }
    return { message: 'Terjadi kesalahan pada server.' };
};

// CREATE: Tambah Pelanggan
exports.createPelanggan = async (req, res) => {
  try {
    const pelanggan = await Pelanggan.create(req.body);
    res.status(201).json({
      message: 'Pelanggan berhasil ditambahkan',
      data: pelanggan
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
        const errorResponse = handleValidationError(error);
        return res.status(400).json(errorResponse);
    }
    res.status(500).json({
      message: 'Gagal menambahkan Pelanggan',
      error: error.message
    });
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllPelanggan = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ 
        message: 'Parameter tenantID wajib disertakan di query.' 
      });
    }

    const pelanggan = await Pelanggan.find({ tenantID }) // FILTER UTAMA
      .sort({ namaPelanggan: 1 });

    if (pelanggan.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada data Pelanggan untuk tenant ini.' 
      });
    }

    res.status(200).json(pelanggan);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data Pelanggan',
      error: error.message
    });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getPelangganById = async (req, res) => {
  try {
    const { id } = req.params;

    const pelanggan = await Pelanggan.findById(id);

    if (!pelanggan) {
      return res.status(404).json({ 
        message: 'Pelanggan tidak ditemukan.' 
      });
    }
    res.status(200).json(pelanggan);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({
      message: 'Gagal mengambil data Pelanggan',
      error: error.message
    });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updatePelanggan = async (req, res) => {
  try {
    const { id } = req.params;

    const pelanggan = await Pelanggan.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true // Penting agar validasi kustom Mongoose berjalan saat update
    });

    if (!pelanggan) {
      return res.status(404).json({ message: 'Pelanggan tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Pelanggan berhasil diperbarui',
      data: pelanggan
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
        const errorResponse = handleValidationError(error);
        return res.status(400).json(errorResponse);
    }
    res.status(400).json({
      message: 'Gagal memperbarui Pelanggan',
      error: error.message
    });
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deletePelanggan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pelanggan = await Pelanggan.findByIdAndDelete(id);

    if (!pelanggan) {
      return res.status(404).json({ message: 'Pelanggan tidak ditemukan' });
    }

    res.status(200).json({ message: 'Pelanggan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus Pelanggan',
      error: error.message
    });
  }
};