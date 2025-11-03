const Produk = require('../models/ProdukModel');

// CREATE
exports.createProduk = async (req, res) => {
  try {
    const produk = await Produk.create(req.body);
    res.status(201).json({ message: 'Produk berhasil ditambahkan', data: produk });
  } catch (error) {
    res.status(400).json({ message: 'Gagal menambahkan produk', error: error.message });
  }
};

// READ (semua produk)
exports.getAllProduk = async (req, res) => {
  try {
    const produk = await Produk.find()
      .populate('kategoriID')
      .populate('tenantID');
    res.status(200).json({ message: 'Data produk berhasil diambil', data: produk });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data produk', error: error.message });
  }
};

// READ (produk berdasarkan ID)
exports.getProdukById = async (req, res) => {
  try {
    const produk = await Produk.findById(req.params.id)
      .populate('kategoriID')
      .populate('tenantID');
    if (!produk) return res.status(404).json({ message: 'Produk tidak ditemukan' });
    res.status(200).json({ message: 'Detail produk berhasil diambil', data: produk });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail produk', error: error.message });
  }
};

// UPDATE
exports.updateProduk = async (req, res) => {
  try {
    const produk = await Produk.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!produk) return res.status(404).json({ message: 'Produk tidak ditemukan' });
    res.status(200).json({ message: 'Produk berhasil diperbarui', data: produk });
  } catch (error) {
    res.status(400).json({ message: 'Gagal memperbarui produk', error: error.message });
  }
};

// DELETE
exports.deleteProduk = async (req, res) => {
  try {
    const produk = await Produk.findByIdAndDelete(req.params.id);
    if (!produk) return res.status(404).json({ message: 'Produk tidak ditemukan' });
    res.status(200).json({ message: 'Produk berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus produk', error: error.message });
  }
};
