const Produk = require('../models/produkModel'); // pastikan huruf besar kecil sesuai

// CREATE
exports.tambahProduk = async (req, res) => {
  try {
    const {
      produkID,
      namaProduk,
      stok,
      hargaDasar,
      hargaJual,
      kategoriID,
      keterangan,
      gambar // ← tambahkan ini dari req.body
    } = req.body;

    // Validasi field wajib
    if (!produkID || !namaProduk) {
      return res.status(400).json({ message: 'produkID dan namaProduk wajib diisi.' });
    }

    // Membuat instance produk baru
    const produkBaru = new Produk({
      produkID,
      namaProduk,
      stok,
      hargaDasar,
      hargaJual,
      kategoriID,
      keterangan,
      gambar: gambar || null // jika tidak ada, otomatis null
    });

    await produkBaru.save();
    res.status(201).json({
      message: 'Produk berhasil ditambahkan',
      data: produkBaru
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal menambah produk',
      error: error.message
    });
  }
};

// READ (ALL)
exports.getAllProduk = async (req, res) => {
  try {
    const produk = await Produk.find().sort({ createdAt: -1 });
    res.status(200).json(produk);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data produk',
      error: error.message
    });
  }
};

// READ (BY ID)
exports.getProdukById = async (req, res) => {
  try {
    const produk = await Produk.findOne({ produkID: req.params.produkID });
    if (!produk)
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    res.status(200).json(produk);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil produk',
      error: error.message
    });
  }
};

// UPDATE
exports.updateProduk = async (req, res) => {
  try {
    const {
      produkID,
      namaProduk,
      stok,
      hargaDasar,
      hargaJual,
      kategoriID,
      keterangan,
      gambar
    } = req.body;

    const updateData = {
      namaProduk,
      stok,
      hargaDasar,
      hargaJual,
      kategoriID,
      keterangan
    };

    // hanya tambahkan `gambar` kalau dikirim dari request
    if (gambar !== undefined) updateData.gambar = gambar;

    const produk = await Produk.findOneAndUpdate(
      { produkID: req.params.produkID },
      updateData,
      { new: true, runValidators: true }
    );

    if (!produk)
      return res.status(404).json({ message: 'Produk tidak ditemukan' });

    res.status(200).json({
      message: 'Produk berhasil diperbarui',
      data: produk
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal memperbarui produk',
      error: error.message
    });
  }
};

// DELETE berdasarkan ID
exports.hapusProduk = async (req, res) => {
  try {
    const produk = await Produk.findOneAndDelete({
      produkID: req.params.produkID
    });
    if (!produk)
      return res.status(404).json({ message: 'Produk tidak ditemukan' });

    res.status(200).json({
      message: `Produk dengan ID ${req.params.produkID} berhasil dihapus`
    });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus produk',
      error: error.message
    });
  }
};
