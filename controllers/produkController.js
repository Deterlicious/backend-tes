const Produk = require('../models/produkModel');

// ✅ Tambah produk baru
exports.createProduk = async (req, res) => {
  try {
    const produkBaru = new Produk(req.body);
    const simpan = await produkBaru.save();
    res.status(201).json({
      message: 'Produk berhasil ditambahkan',
      data: simpan
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal menambahkan produk',
      error: error.message
    });
  }
};

// ✅ Ambil semua produk (Dimodifikasi: Wajib menyertakan tenantID)
exports.getAllProduk = async (req, res) => {
  try {
    // 1. Ambil tenantID dari query parameters
    const { tenantID } = req.query;

    // 2. Validasi: Pastikan tenantID ada di query parameter
    if (!tenantID) {
      return res.status(400).json({ 
        message: "Parameter tenantID wajib disertakan di query." 
      });
    }

    // 3. Cari produk berdasarkan tenantID
    // Gunakan { tenantID } sebagai filter utama
    const produk = await Produk.find({ tenantID })
      .populate('kategoriID', 'namaKategori')
      .populate('tenantID', 'namaTenant')
      .sort({ createdAt: -1 }); // Opsional: Menambahkan sorting agar konsisten dengan pola sebelumnya

    // 4. Periksa jika tidak ada data ditemukan
    if (produk.length === 0) {
      return res.status(404).json({ 
        message: "Tidak ada data produk untuk tenant ini.",
        data: []
      });
    }

    // 5. Kirim data yang ditemukan
    res.status(200).json(produk);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data produk',
      error: error.message
    });
  }
};

// ✅ Ambil produk berdasarkan _id
exports.getProdukById = async (req, res) => {
  try {
    const produk = await Produk.findById(req.params.id)
      .populate('kategoriID', 'namaKategori')
      .populate('tenantID', 'namaTenant');
    if (!produk) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }
    res.status(200).json(produk);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil produk',
      error: error.message
    });
  }
};

// ✅ Update produk berdasarkan _id
exports.updateProduk = async (req, res) => {
  try {
    const update = await Produk.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!update) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }
    res.status(200).json({
      message: 'Produk berhasil diperbarui',
      data: update
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal memperbarui produk',
      error: error.message
    });
  }
};

// ✅ Hapus produk berdasarkan _id
exports.deleteProduk = async (req, res) => {
  try {
    const hapus = await Produk.findByIdAndDelete(req.params.id);
    if (!hapus) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }
    res.status(200).json({ message: 'Produk berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus produk',
      error: error.message
    });
  }
};
