const Produk = require('../models/produkModel'); // pastikan huruf besar kecil sesuai

// CREATE
exports.tambahProduk = async (req, res) => {
  try {
    const {
      kodeProduk,
      namaProduk,
      tipeBarang,
      stok,
      hargaDasar,
      hargaJual,
      kategoriID,
      keterangan
    } = req.body;

    // Validasi field wajib
    if (!kodeProduk || !namaProduk) {
      return res.status(400).json({ message: 'Kode Produk dan Nama Produk wajib diisi.' });
    }

    const produkBaru = new Produk({
      kodeProduk,
      namaProduk,
      tipeBarang,
      stok,
      hargaDasar,
      hargaJual,
      kategoriID,
      keterangan
    });

    await produkBaru.save();
    res.status(201).json({ message: 'Produk berhasil ditambahkan', data: produkBaru });
  } catch (error) {
    res.status(400).json({ message: 'Gagal menambah produk', error: error.message });
  }
};

// READ (ALL)
exports.getAllProduk = async (req, res) => {
  try {
    const produk = await Produk.find().sort({ createdAt: -1 }); // urutkan terbaru di atas
    res.status(200).json(produk);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data produk', error: error.message });
  }
};

// READ (BY ID)
exports.getProdukById = async (req, res) => {
  try {
    const produk = await Produk.findOne({
      kodeProduk: req.params.id,
    });
    if (!produk) return res.status(404).json({ message: 'Produk tidak ditemukan' });
    res.status(200).json(produk);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil produk', error: error.message });
  }
};

// UPDATE
exports.updateProduk = async (req, res) => {
  try {
    const updateData = {
      kodeProduk: req.body.kodeProduk,
      namaProduk: req.body.namaProduk,
      tipeBarang: req.body.tipeBarang,
      stok: req.body.stok,
      hargaDasar: req.body.hargaDasar,
      hargaJual: req.body.hargaJual,
      kategoriID: req.body.kategoriID,
      keterangan: req.body.keterangan
    };

    const produk = await Produk.findOneAndUpdate({kodeProduk: req.params.id}, updateData, { new: true, runValidators: true });
    if (!produk) return res.status(404).json({ message: 'Produk tidak ditemukan' });

    res.status(200).json({ message: 'Produk berhasil diperbarui', data: produk });
  } catch (error) {
    res.status(400).json({ message: 'Gagal memperbarui produk', error: error.message });
  }
};

// DELETE berdasarkan ID
exports.hapusProduk = async (req, res) => {
  try {
    const produk = await Produk.findOneAndDelete({kodeProduk: req.params.id});
    if (!produk) return res.status(404).json({ message: 'Produk tidak ditemukan' });
    res.status(200).json({ message: 'Produk berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus produk', error: error.message });
  }
};
