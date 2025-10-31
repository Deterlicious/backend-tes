const Pembelian = require('../models/pembelianModel');

// CREATE
exports.tambahPembelian = async (req, res) => {
  try {
    const { tanggal, akunKasID, totalBiaya, supplier, keterangan, items, tenantID } = req.body;

    if (!tanggal || !akunKasID || !totalBiaya || !supplier || !keterangan) {
      return res.status(400).json({
        message: 'Field tanggal, akunKasID, totalBiaya, supplier, dan keterangan wajib diisi.'
      });
    }

    const pembelianBaru = new Pembelian({
      tanggal,
      akunKasID,
      totalBiaya,
      supplier,
      keterangan,
      items,
      tenantID
    });

    await pembelianBaru.save();
    res.status(201).json({ message: 'Pembelian berhasil ditambahkan', data: pembelianBaru });
  } catch (error) {
    res.status(400).json({ message: 'Gagal menambah pembelian', error: error.message });
  }
};

// READ ALL
exports.getAllPembelian = async (req, res) => {
  try {
    const pembelian = await Pembelian.find()
      .populate('akunKasID', 'namaAkun nomorAkun')
      .populate('items.BahanBakuID', 'namaBahan stok satuan')
      .sort({ createdAt: -1 });

    res.status(200).json(pembelian);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pembelian', error: error.message });
  }
};

// READ BY ID
exports.getPembelianById = async (req, res) => {
  try {
    const pembelian = await Pembelian.findById(req.params.id)
      .populate('akunKasID', 'namaAkun nomorAkun')
      .populate('items.BahanBakuID', 'namaBahan stok satuan');

    if (!pembelian)
      return res.status(404).json({ message: 'Pembelian tidak ditemukan' });

    res.status(200).json(pembelian);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil pembelian', error: error.message });
  }
};

// UPDATE
exports.updatePembelian = async (req, res) => {
  try {
    const pembelian = await Pembelian.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!pembelian)
      return res.status(404).json({ message: 'Pembelian tidak ditemukan' });

    res.status(200).json({ message: 'Pembelian berhasil diperbarui', data: pembelian });
  } catch (error) {
    res.status(400).json({ message: 'Gagal memperbarui pembelian', error: error.message });
  }
};

// DELETE
exports.hapusPembelian = async (req, res) => {
  try {
    const pembelian = await Pembelian.findByIdAndDelete(req.params.id);

    if (!pembelian)
      return res.status(404).json({ message: 'Pembelian tidak ditemukan' });

    res.status(200).json({ message: 'Pembelian berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus pembelian', error: error.message });
  }
};
