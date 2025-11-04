const Pembelian = require('../models/pembelianModel');

// CREATE
exports.tambahPembelian = async (req, res) => {
  try {
    const { tanggal, akunKasID, totalBiaya, supplier, keterangan, items, tenantID } = req.body;

    if (!tanggal || !akunKasID || !totalBiaya || !supplier || !tenantID) {
      return res.status(400).json({
        message: 'Field tanggal, akunKasID, totalBiaya, supplier, dan tenantID wajib diisi.'
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

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllPembelian = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({
        message: 'Parameter tenantID wajib disertakan di query.'
      });
    }

    const pembelian = await Pembelian.find({ tenantID }) // FILTER UTAMA
      .populate('akunKasID', 'namaAkun nomorAkun')
      .populate('items.BahanBakuID', 'namaBahan stok satuan')
      .sort({ createdAt: -1 });

    if (pembelian.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data pembelian untuk tenant ini.' });
    }

    res.status(200).json(pembelian);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data pembelian', error: error.message });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getPembelianById = async (req, res) => {
  try {
    // Hapus pengambilan tenantID dari query
    const pembelian = await Pembelian.findById(req.params.id) // Cari hanya berdasarkan ID
      .populate('akunKasID', 'namaAkun nomorAkun')
      .populate('items.BahanBakuID', 'namaBahan stok satuan');

    if (!pembelian)
      return res.status(404).json({ message: 'Pembelian tidak ditemukan' }); // Pesan error generik

    res.status(200).json(pembelian);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({ message: 'Gagal mengambil pembelian', error: error.message });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updatePembelian = async (req, res) => {
  try {
  
    const pembelian = await Pembelian.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!pembelian)
      return res.status(404).json({ message: 'Pembelian tidak ditemukan' }); // Pesan error generik

    res.status(200).json({ message: 'Pembelian berhasil diperbarui', data: pembelian });
  } catch (error) {
    res.status(400).json({ message: 'Gagal memperbarui pembelian', error: error.message });
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.hapusPembelian = async (req, res) => {
  try {
  
    const pembelian = await Pembelian.findByIdAndDelete(req.params.id);

    if (!pembelian)
      return res.status(404).json({ message: 'Pembelian tidak ditemukan' }); // Pesan error generik

    res.status(200).json({ message: 'Pembelian berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus pembelian', error: error.message });
  }
};