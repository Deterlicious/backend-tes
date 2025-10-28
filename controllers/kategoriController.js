const Kategori = require("../models/kategoriModel");

// CREATE
exports.tambahKategori = async (req, res) => {
  try {
    const { kategoriID, namaKategori, kodeKategori, keterangan } = req.body;

    if (!kategoriID || !namaKategori || !kodeKategori) {
      return res
        .status(400)
        .json({
          message:
            "Field kategoriID, namaKategori, dan kodeKategori wajib diisi.",
        });
    }

    // Pastikan kategoriID unik
    const existing = await Kategori.findById(kategoriID);
    if (existing) {
      return res
        .status(400)
        .json({ message: `Kategori dengan ID ${kategoriID} sudah ada.` });
    }

    const kategoriBaru = new Kategori({
      _id: kategoriID, // gunakan kategoriID sebagai _id
      namaKategori,
      kodeKategori,
      keterangan,
    });

    await kategoriBaru.save();
    res
      .status(201)
      .json({ message: "Kategori berhasil ditambahkan", data: kategoriBaru });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Gagal menambah kategori", error: error.message });
  }
};

// READ ALL
exports.getAllKategori = async (req, res) => {
  try {
    const kategori = await Kategori.find().sort({ createdAt: -1 });
    res.status(200).json(kategori);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil data kategori", error: error.message });
  }
};

// READ BY kategoriID
exports.getKategoriById = async (req, res) => {
  try {
    const kategori = await Kategori.findOne({
      kategoriID: req.params.id,
    });
    if (!kategori)
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    res.status(200).json(kategori);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil kategori", error: error.message });
  }
};

// UPDATE BY kategoriID
exports.updateKategori = async (req, res) => {
  try {
    const kategori = await Kategori.findOneAndUpdate(
      { kategoriID: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!kategori) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    res.status(200).json({ message: 'Kategori berhasil diperbarui', data: kategori });
  } catch (error) {
    res.status(400).json({ message: 'Gagal memperbarui kategori', error: error.message });
  }
};

// DELETE BY kategoriID
exports.hapusKategori = async (req, res) => {
  try {
    const kategori = await Kategori.findOneAndDelete({
      kategoriID: req.params.kategoriID,
    });

    if (!kategori) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }

    res.status(200).json({
      message: `Kategori dengan ID ${req.params.kategoriID} berhasil dihapus.`,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus kategori",
      error: error.message,
    });
  }
};
