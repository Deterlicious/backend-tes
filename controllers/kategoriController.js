const Kategori = require('../models/kategori');

// CREATE
exports.tambahKategori = async (req, res) => {
  try {
    const { kategoriID, namaKategori, kodeKategori, keterangan } = req.body;

    if (!kategoriID || !namaKategori || !kodeKategori) {
      return res.status(400).json({ message: 'Field kategoriID, namaKategori, dan kodeKategori wajib diisi.' });
    }

    const kategoriBaru = new Kategori({
      kategoriID,
      namaKategori,
      kodeKategori,
      keterangan
    });

    await kategoriBaru.save();
    res.status(201).json({ message: 'Kategori berhasil ditambahkan', data: kategoriBaru });
  } catch (error) {
    res.status(400).json({ message: 'Gagal menambah kategori', error: error.message });
  }
};

// READ ALL
exports.getAllKategori = async (req, res) => {
  try {
    const kategori = await Kategori.find().sort({ createdAt: -1 });
    res.status(200).json(kategori);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data kategori', error: error.message });
  }
};

// READ BY ID
exports.getKategoriById = async (req, res) => {
  try {
    const kategori = await Kategori.findById(req.params.id);
    if (!kategori) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    res.status(200).json(kategori);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil kategori', error: error.message });
  }
};

// UPDATE
exports.updateKategori = async (req, res) => {
  try {
    const { kategoriID, namaKategori, kodeKategori, keterangan } = req.body;
    const updateData = { kategoriID, namaKategori, kodeKategori, keterangan };

    const kategori = await Kategori.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    if (!kategori) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    res.status(200).json({ message: 'Kategori berhasil diperbarui', data: kategori });
  } catch (error) {
    res.status(400).json({ message: 'Gagal memperbarui kategori', error: error.message });
  }
};

// DELETE
exports.hapusKategori = async (req, res) => {
  try {
    const kategori = await Kategori.findByIdAndDelete(req.params.id);
    if (!kategori) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    res.status(200).json({ message: 'Kategori berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus kategori', error: error.message });
  }
};
