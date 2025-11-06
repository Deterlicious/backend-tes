const KategoriBeban = require('../models/kategoriBebanModel'); // Sesuaikan path

// CREATE: Tambah Kategori Beban
exports.createKategoriBeban = async (req, res) => {
  try {
    const kategoriBeban = await KategoriBeban.create(req.body);
    res.status(201).json({
      message: 'Kategori Beban berhasil ditambahkan',
      data: kategoriBeban
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal menambahkan Kategori Beban',
      error: error.message
    });
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllKategoriBeban = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ 
        message: 'Parameter tenantID wajib disertakan di query.' 
      });
    }

    const kategoriBeban = await KategoriBeban.find({ tenantID }) // FILTER UTAMA
      .sort({ namaKategori: 1 });

    if (kategoriBeban.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada data Kategori Beban untuk tenant ini.' 
      });
    }

    res.status(200).json(kategoriBeban);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data Kategori Beban',
      error: error.message
    });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getKategoriBebanById = async (req, res) => {
  try {
    const { id } = req.params;

    const kategoriBeban = await KategoriBeban.findById(id);

    if (!kategoriBeban) {
      return res.status(404).json({ 
        message: 'Kategori Beban tidak ditemukan.' 
      });
    }
    res.status(200).json(kategoriBeban);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({
      message: 'Gagal mengambil data Kategori Beban',
      error: error.message
    });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updateKategoriBeban = async (req, res) => {
  try {
    const { id } = req.params;

    const kategoriBeban = await KategoriBeban.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!kategoriBeban) {
      return res.status(404).json({ message: 'Kategori Beban tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Kategori Beban berhasil diperbarui',
      data: kategoriBeban
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal memperbarui Kategori Beban',
      error: error.message
    });
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deleteKategoriBeban = async (req, res) => {
  try {
    const { id } = req.params;
    
    const kategoriBeban = await KategoriBeban.findByIdAndDelete(id);

    if (!kategoriBeban) {
      return res.status(404).json({ message: 'Kategori Beban tidak ditemukan' });
    }

    res.status(200).json({ message: 'Kategori Beban berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus Kategori Beban',
      error: error.message
    });
  }
};