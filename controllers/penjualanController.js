const Penjualan = require('../models/penjualanModel');

// Create penjualan
exports.createPenjualan = async (req, res) => {
  try {
    const penjualan = await Penjualan.create(req.body);
    res.status(201).json({ message: 'Penjualan berhasil ditambahkan', data: penjualan });
  } catch (error) {
    res.status(400).json({ message: 'Gagal menambahkan penjualan', error: error.message });
  }
};

// Read semua penjualan
exports.getAllPenjualan = async (req, res) => {
  try {
    const penjualan = await Penjualan.find().populate('tenantID');
    res.status(200).json({ message: 'Data penjualan berhasil diambil', data: penjualan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data penjualan', error: error.message });
  }
};

// Read penjualan by ID
exports.getPenjualanById = async (req, res) => {
  try {
    const penjualan = await Penjualan.findById(req.params.id).populate('tenantID');
    if (!penjualan) return res.status(404).json({ message: 'Penjualan tidak ditemukan' });
    res.status(200).json({ message: 'Detail penjualan berhasil diambil', data: penjualan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail penjualan', error: error.message });
  }
};

// Update penjualan
exports.updatePenjualan = async (req, res) => {
  try {
    const penjualan = await Penjualan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!penjualan) return res.status(404).json({ message: 'Penjualan tidak ditemukan' });
    res.status(200).json({ message: 'Penjualan berhasil diperbarui', data: penjualan });
  } catch (error) {
    res.status(400).json({ message: 'Gagal memperbarui penjualan', error: error.message });
  }
};

// Delete penjualan
exports.deletePenjualan = async (req, res) => {
  try {
    const penjualan = await Penjualan.findByIdAndDelete(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Penjualan tidak ditemukan' });
    res.status(200).json({ message: 'Penjualan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus penjualan', error: error.message });
  }
};
