const Kategori = require("../models/kategoriModel");

// ✅ Tambah Kategori
exports.createKategori = async (req, res) => {
  try {
    const kategori = await Kategori.create(req.body);
    res.status(201).json({
      message: "Kategori berhasil ditambahkan",
      data: kategori
    });
  } catch (error) {
    res.status(400).json({
      message: "Gagal menambahkan kategori",
      error: error.message
    });
  }
};

// ✅ Tampilkan semua kategori
exports.getAllKategori = async (req, res) => {
  try {
    const kategori = await Kategori.find().populate("tenantID");
    res.status(200).json(kategori);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data kategori",
      error: error.message
    });
  }
};

// ✅ Tampilkan kategori berdasarkan ID
exports.getKategoriById = async (req, res) => {
  try {
    const kategori = await Kategori.findById(req.params.id).populate("tenantID");
    if (!kategori) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    res.status(200).json(kategori);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data kategori",
      error: error.message
    });
  }
};

// ✅ Update kategori
exports.updateKategori = async (req, res) => {
  try {
    const kategori = await Kategori.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!kategori) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    res.status(200).json({
      message: "Kategori berhasil diperbarui",
      data: kategori
    });
  } catch (error) {
    res.status(400).json({
      message: "Gagal memperbarui kategori",
      error: error.message
    });
  }
};

// ✅ Hapus kategori
exports.deleteKategori = async (req, res) => {
  try {
    const kategori = await Kategori.findByIdAndDelete(req.params.id);
    if (!kategori) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    res.status(200).json({ message: "Kategori berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus kategori",
      error: error.message
    });
  }
};
