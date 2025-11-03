const Penjualan = require('../models/penjualanModel');

// ✅ CREATE PENJUALAN
exports.createPenjualan = async (req, res) => {
  try {
    const { tanggalPenjualan, nomorFaktur, namaPelanggan, itemPenjualan, tenantID, statusPembayaran } = req.body;

    if (!tanggalPenjualan || !nomorFaktur || !itemPenjualan || !tenantID) {
      return res.status(400).json({ message: 'Field wajib belum lengkap!' });
    }

    const penjualanBaru = new Penjualan({
      tanggalPenjualan,
      nomorFaktur,
      namaPelanggan,
      itemPenjualan,
      tenantID,
      statusPembayaran
    });

    await penjualanBaru.save();
    res.status(201).json({ message: 'Penjualan berhasil dibuat', data: penjualanBaru });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat penjualan', error: error.message });
  }
};

// ✅ GET ALL PENJUALAN
exports.getAllPenjualan = async (req, res) => {
  try {
    const penjualan = await Penjualan.find()
      .populate('itemPenjualan.produkID', 'namaProduk kodeProduk')
      .populate('itemPenjualan.sesiBookingID', 'kodeSesi tanggalMulai')
      .populate('tenantID', 'namaTenant');

    res.status(200).json(penjualan);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data penjualan', error: error.message });
  }
};

// ✅ GET PENJUALAN BY ID
exports.getPenjualanById = async (req, res) => {
  try {
    const penjualan = await Penjualan.findById(req.params.id)
      .populate('itemPenjualan.produkID', 'namaProduk kodeProduk')
      .populate('itemPenjualan.sesiBookingID', 'kodeSesi tanggalMulai')
      .populate('tenantID', 'namaTenant');

    if (!penjualan) return res.status(404).json({ message: 'Penjualan tidak ditemukan' });
    res.status(200).json(penjualan);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil penjualan', error: error.message });
  }
};

// ✅ UPDATE PENJUALAN
exports.updatePenjualan = async (req, res) => {
  try {
    const { tanggalPenjualan, namaPelanggan, itemPenjualan, statusPembayaran, sisaTagihan } = req.body;

    const updateData = {
      tanggalPenjualan,
      namaPelanggan,
      itemPenjualan,
      statusPembayaran,
      sisaTagihan
    };

    const penjualan = await Penjualan.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    if (!penjualan) return res.status(404).json({ message: 'Penjualan tidak ditemukan' });

    res.status(200).json({ message: 'Penjualan berhasil diperbarui', data: penjualan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui penjualan', error: error.message });
  }
};

// ✅ DELETE PENJUALAN
exports.deletePenjualan = async (req, res) => {
  try {
    const penjualan = await Penjualan.findByIdAndDelete(req.params.id);
    if (!penjualan) return res.status(404).json({ message: 'Penjualan tidak ditemukan' });

    res.status(200).json({ message: 'Penjualan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus penjualan', error: error.message });
  }
};
