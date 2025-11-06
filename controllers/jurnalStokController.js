const JurnalStok = require('../models/jurnalStokModel'); 

// CREATE: Tambah Jurnal Stok
exports.createJurnalStok = async (req, res) => {
  try {
    const jurnalStok = await JurnalStok.create(req.body);
    res.status(201).json({
      message: 'Jurnal Stok berhasil ditambahkan',
      data: jurnalStok
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal menambahkan Jurnal Stok',
      error: error.message
    });
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllJurnalStok = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ 
        message: 'Parameter tenantID wajib disertakan di query.' 
      });
    }

    const jurnalStok = await JurnalStok.find({ tenantID })
      .populate('bahanBakuID', 'namaBahan satuan')
      .populate('dicatatOleh', 'nama')
      .sort({ tanggal: -1, createdAt: -1 });

    if (jurnalStok.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada data Jurnal Stok untuk tenant ini.' 
      });
    }

    res.status(200).json(jurnalStok);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data Jurnal Stok',
      error: error.message
    });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getJurnalStokById = async (req, res) => {
  try {
    const { id } = req.params;

    // Cari hanya berdasarkan _id
    const jurnalStok = await JurnalStok.findById(id)
      .populate('bahanBakuID', 'namaBahan satuan')
      .populate('dicatatOleh', 'nama');

    if (!jurnalStok) {
      return res.status(404).json({ 
        message: 'Jurnal Stok tidak ditemukan.' 
      });
    }
    res.status(200).json(jurnalStok);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({
      message: 'Gagal mengambil data Jurnal Stok',
      error: error.message
    });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updateJurnalStok = async (req, res) => {
  try {
    const { id } = req.params;

    const jurnalStok = await JurnalStok.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!jurnalStok) {
      return res.status(404).json({ message: 'Jurnal Stok tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Jurnal Stok berhasil diperbarui',
      data: jurnalStok
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal memperbarui Jurnal Stok',
      error: error.message
    });
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deleteJurnalStok = async (req, res) => {
  try {
    const { id } = req.params;
    
    const jurnalStok = await JurnalStok.findByIdAndDelete(id);

    if (!jurnalStok) {
      return res.status(404).json({ message: 'Jurnal Stok tidak ditemukan' });
    }

    res.status(200).json({ message: 'Jurnal Stok berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus Jurnal Stok',
      error: error.message
    });
  }
};