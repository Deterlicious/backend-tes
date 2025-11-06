const JurnalTransfer = require('../models/jurnalTransferModel'); // Sesuaikan path

// CREATE: Tambah Jurnal Transfer
exports.createJurnalTransfer = async (req, res) => {
  try {
    // Note: Logika bisnis untuk mengurangi saldo kasSumberID dan menambah saldo kasTujuanID harus ditambahkan di sini.
    const jurnalTransfer = await JurnalTransfer.create(req.body);
    res.status(201).json({
      message: 'Jurnal Transfer berhasil ditambahkan',
      data: jurnalTransfer
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal menambahkan Jurnal Transfer',
      error: error.message
    });
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllJurnalTransfer = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ 
        message: 'Parameter tenantID wajib disertakan di query.' 
      });
    }

    const jurnalTransfer = await JurnalTransfer.find({ tenantID }) // FILTER UTAMA
      .populate('kasSumberID', 'namaAkun nomorAkun')
      .populate('kasTujuanID', 'namaAkun nomorAkun')
      .populate('dicatatOleh', 'nama')
      .sort({ tanggal: -1, createdAt: -1 });

    if (jurnalTransfer.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada data Jurnal Transfer untuk tenant ini.' 
      });
    }

    res.status(200).json(jurnalTransfer);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data Jurnal Transfer',
      error: error.message
    });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getJurnalTransferById = async (req, res) => {
  try {
    const { id } = req.params;

    const jurnalTransfer = await JurnalTransfer.findById(id)
      .populate('kasSumberID', 'namaAkun nomorAkun')
      .populate('kasTujuanID', 'namaAkun nomorAkun')
      .populate('dicatatOleh', 'nama');

    if (!jurnalTransfer) {
      return res.status(404).json({ 
        message: 'Jurnal Transfer tidak ditemukan.' 
      });
    }
    res.status(200).json(jurnalTransfer);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({
      message: 'Gagal mengambil data Jurnal Transfer',
      error: error.message
    });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updateJurnalTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    // Catatan: Logika pembaruan saldo Kas Sumber/Tujuan jika ada perubahan pada jumlah harus ditambahkan.

    const jurnalTransfer = await JurnalTransfer.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!jurnalTransfer) {
      return res.status(404).json({ message: 'Jurnal Transfer tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Jurnal Transfer berhasil diperbarui',
      data: jurnalTransfer
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal memperbarui Jurnal Transfer',
      error: error.message
    });
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deleteJurnalTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    // Catatan: Logika pengembalian saldo Kas Sumber/Tujuan harus ditambahkan.
    
    const jurnalTransfer = await JurnalTransfer.findByIdAndDelete(id);

    if (!jurnalTransfer) {
      return res.status(404).json({ message: 'Jurnal Transfer tidak ditemukan' });
    }

    res.status(200).json({ message: 'Jurnal Transfer berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus Jurnal Transfer',
      error: error.message
    });
  }
};