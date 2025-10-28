const BahanBaku = require('../models/bahanBakuModel');

// CREATE
exports.tambahBahanBaku = async (req, res) => {
  try {
    const bahanBaru = new BahanBaku(req.body);
    await bahanBaru.save();
    res.status(201).json({ message: 'Bahan baku berhasil ditambahkan', data: bahanBaru });
  } catch (error) {
    res.status(400).json({ message: 'Gagal menambah bahan baku', error: error.message });
  }
};

// READ (ALL)
exports.getAllBahanBaku = async (req, res) => {
  try {
    const bahan = await BahanBaku.find();
    res.status(200).json(bahan);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data bahan baku', error: error.message });
  }
};

// READ (BY ID)
exports.getBahanBakuById = async (req, res) => {
  try {
    const bahan = await BahanBaku.findOne({ BahanBakuID: req.params.id });
    if (!bahan) return res.status(404).json({ message: 'Bahan baku tidak ditemukan' });
    res.status(200).json(bahan);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil bahan baku', error: error.message });
  }
};

// UPDATE
exports.updateBahanBaku = async (req, res) => {
  try {
    const bahan = await BahanBaku.findOneAndUpdate(
      { BahanBakuID: req.params.id },
      req.body,
      { new: true }
    );
    if (!bahan) return res.status(404).json({ message: 'Bahan baku tidak ditemukan' });
    res.status(200).json({ message: 'Bahan baku berhasil diperbarui', data: bahan });
  } catch (error) {
    res.status(400).json({ message: 'Gagal memperbarui bahan baku', error: error.message });
  }
};

// DELETE
exports.hapusBahanBaku = async (req, res) => {
  try {
    const bahan = await BahanBaku.findOneAndDelete({ BahanBakuID: req.params.id });
    if (!bahan) return res.status(404).json({ message: 'Bahan baku tidak ditemukan' });
    res.status(200).json({ message: 'Bahan baku berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus bahan baku', error: error.message });
  }
};
