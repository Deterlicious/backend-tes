const BebanOperasional = require('../models/bebanOperasionalModel'); // Sesuaikan path

// CREATE: Tambah Beban Operasional
exports.createBebanOperasional = async (req, res) => {
  try {
    // Note: Logika bisnis untuk mengurangi saldo akunKasID harus ditambahkan di sini.
    const bebanOperasional = await BebanOperasional.create(req.body);
    res.status(201).json({
      message: 'Beban Operasional berhasil ditambahkan',
      data: bebanOperasional
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal menambahkan Beban Operasional',
      error: error.message
    });
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllBebanOperasional = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ 
        message: 'Parameter tenantID wajib disertakan di query.' 
      });
    }

    const bebanOperasional = await BebanOperasional.find({ tenantID }) // FILTER UTAMA
      .populate('akunKasID', 'namaAkun nomorAkun')
      .populate('kategoriBebanID', 'namaKategori')
      .populate('dicatatOleh', 'nama')
      .sort({ tanggal: -1, createdAt: -1 });

    if (bebanOperasional.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada data Beban Operasional untuk tenant ini.' 
      });
    }

    res.status(200).json(bebanOperasional);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data Beban Operasional',
      error: error.message
    });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getBebanOperasionalById = async (req, res) => {
  try {
    const { id } = req.params;

    const bebanOperasional = await BebanOperasional.findById(id)
      .populate('akunKasID', 'namaAkun nomorAkun')
      .populate('kategoriBebanID', 'namaKategori')
      .populate('dicatatOleh', 'nama');

    if (!bebanOperasional) {
      return res.status(404).json({ 
        message: 'Beban Operasional tidak ditemukan.' 
      });
    }
    res.status(200).json(bebanOperasional);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({
      message: 'Gagal mengambil data Beban Operasional',
      error: error.message
    });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updateBebanOperasional = async (req, res) => {
  try {
    const { id } = req.params;
    // Catatan: Logika pembaruan saldo Kas Sumber harus dipertimbangkan.

    const bebanOperasional = await BebanOperasional.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!bebanOperasional) {
      return res.status(404).json({ message: 'Beban Operasional tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Beban Operasional berhasil diperbarui',
      data: bebanOperasional
    });
  } catch (error) {
    res.status(400).json({
      message: 'Gagal memperbarui Beban Operasional',
      error: error.message
    });
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deleteBebanOperasional = async (req, res) => {
  try {
    const { id } = req.params;
    // Catatan: Logika pengembalian saldo Akun Kas harus ditambahkan.
    
    const bebanOperasional = await BebanOperasional.findByIdAndDelete(id);

    if (!bebanOperasional) {
      return res.status(404).json({ message: 'Beban Operasional tidak ditemukan' });
    }

    res.status(200).json({ message: 'Beban Operasional berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus Beban Operasional',
      error: error.message
    });
  }
};