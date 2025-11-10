const PembelianStok = require('../models/pembelianStokModel'); // Sesuaikan path

// CREATE: Tambah Pembelian Stok
exports.createPembelianStok = async (req, res) => {
  try {
    // Note: Logika bisnis untuk mengurangi saldo akunKasID dan menambah stok bahanBakuID harus ditambahkan di sini.
    const pembelianStok = await PembelianStok.create(req.body);
    res.status(201).json({
      message: 'Pembelian Stok berhasil ditambahkan',
      data: pembelianStok
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal menambahkan Pembelian Stok',
      error: error.message
    });
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllPembelianStok = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ 
        message: 'Parameter tenantID wajib disertakan di query.' 
      });
    }

    const pembelianStok = await PembelianStok.find({ tenantID }) // FILTER UTAMA
      .populate('akunKasID', 'namaAkun nomorAkun')
      .populate('items.bahanBakuID', 'namaBahan satuan') // Populate di subdocuments
      .populate('dicatatOleh', 'nama')
      .sort({ tanggal: -1, createdAt: -1 });

    if (pembelianStok.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada data Pembelian Stok untuk tenant ini.' 
      });
    }

    res.status(200).json(pembelianStok);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data Pembelian Stok',
      error: error.message
    });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getPembelianStokById = async (req, res) => {
  try {
    const { id } = req.params;

    const pembelianStok = await PembelianStok.findById(id)
      .populate('akunKasID', 'namaAkun nomorAkun')
      .populate('items.bahanBakuID', 'namaBahan satuan')
      .populate('dicatatOleh', 'nama');

    if (!pembelianStok) {
      return res.status(404).json({ 
        message: 'Pembelian Stok tidak ditemukan.' 
      });
    }
    res.status(200).json(pembelianStok);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({
      message: 'Gagal mengambil data Pembelian Stok',
      error: error.message
    });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updatePembelianStok = async (req, res) => {
  try {
    const { id } = req.params;
    // Catatan: Logika pembaruan saldo dan stok harus dipertimbangkan.

    const pembelianStok = await PembelianStok.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!pembelianStok) {
      return res.status(404).json({ message: 'Pembelian Stok tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Pembelian Stok berhasil diperbarui',
      data: pembelianStok
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal memperbarui Pembelian Stok',
      error: error.message
    });
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deletePembelianStok = async (req, res) => {
  try {
    const { id } = req.params;
    // Catatan: Logika pengembalian saldo dan pengurangan stok harus ditambahkan.
    
    const pembelianStok = await PembelianStok.findByIdAndDelete(id);

    if (!pembelianStok) {
      return res.status(404).json({ message: 'Pembelian Stok tidak ditemukan' });
    }

    res.status(200).json({ message: 'Pembelian Stok berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus Pembelian Stok',
      error: error.message
    });
  }
};