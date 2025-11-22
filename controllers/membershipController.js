const Membership = require('../models/membershipModel');
const mongoose = require('mongoose');

// Asumsi model PaketMembership dan utilitas error ada di scope ini
const PaketMembership = mongoose.models.PaketMembership || require('../models/paketMembershipModel'); // Sesuaikan path
// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
    let errors = {};
    if (err.name === 'ValidationError') {
        Object.keys(err.errors).forEach((key) => {
            errors[key] = err.errors[key].message;
        });
        return { message: 'Validasi data gagal.', errors };
    }
    return { message: 'Terjadi kesalahan pada server.' };
};

// CREATE: Tambah Membership
exports.createMembership = async (req, res) => {
  try {
    const { paketMembershipID, tanggalMulai, tanggalKadaluarsa } = req.body;

    // --- Validasi Kustom Tanggal (Logika Bisnis) ---
    // 1. Cek paket membership
    const paket = await PaketMembership.findById(paketMembershipID);
    if (!paket) {
        return res.status(400).json({ message: 'Paket Membership tidak ditemukan.' });
    }
    
    // 2. Hitung tanggal kadaluarsa yang seharusnya (Asumsi PaketMembership memiliki field durasiHari)
    const tglMulai = new Date(tanggalMulai);
    tglMulai.setHours(0, 0, 0, 0); // Atur waktu ke awal hari untuk perhitungan yang akurat
    
    const tglKadaluarsaSeharusnya = new Date(tglMulai);
    tglKadaluarsaSeharusnya.setDate(tglMulai.getDate() + paket.durasiHari);
    tglKadaluarsaSeharusnya.setHours(0, 0, 0, 0); 
    
    // Validasi apakah tanggalKadaluarsa yang dikirim sesuai dengan perhitungan
    const tglKadaluarsaInput = new Date(tanggalKadaluarsa);
    tglKadaluarsaInput.setHours(0, 0, 0, 0);

    if (tglKadaluarsaInput.getTime() !== tglKadaluarsaSeharusnya.getTime()) {
        return res.status(400).json({
            message: 'Tanggal Kadaluarsa tidak valid.',
            error: `Tanggal Kadaluarsa seharusnya: ${tglKadaluarsaSeharusnya.toISOString().split('T')[0]}`
        });
    }
    // --- Akhir Validasi Kustom ---

    const membership = await Membership.create(req.body);
    res.status(201).json({
      message: 'Membership berhasil ditambahkan',
      data: membership
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
        const errorResponse = handleValidationError(error);
        return res.status(400).json(errorResponse);
    }
    res.status(500).json({
      message: 'Gagal menambahkan Membership',
      error: error.message
    });
  }
};

// READ ALL (WAJIB FILTER berdasarkan tenantID)
exports.getAllMembership = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ 
        message: 'Parameter tenantID wajib disertakan di query.' 
      });
    }

    const membership = await Membership.find({ tenantID })
      .populate('PelangganID', 'namaPelanggan nomorHp')
      .populate('paketMembershipID', 'namaPaket durasiHari')
      .populate('penjualanID', 'nomorFaktur')
      .sort({ tanggalMulai: -1 });

    if (membership.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada data Membership untuk tenant ini.' 
      });
    }

    res.status(200).json(membership);
  } catch (error) {
    res.status(500).json({
      message: 'Gagal mengambil data Membership',
      error: error.message
    });
  }
};

// READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.getMembershipById = async (req, res) => {
  try {
    const { id } = req.params;

    const membership = await Membership.findById(id)
      .populate('PelangganID', 'namaPelanggan nomorHp')
      .populate('paketMembershipID', 'namaPaket durasiHari')
      .populate('penjualanID', 'nomorFaktur');

    if (!membership) {
      return res.status(404).json({ 
        message: 'Membership tidak ditemukan.' 
      });
    }
    res.status(200).json(membership);
  } catch (error) {
    if (error.name === 'CastError') {
       return res.status(400).json({ 
           message: 'Format ID tidak valid.', 
           error: error.message 
       });
    }
    res.status(500).json({
      message: 'Gagal mengambil data Membership',
      error: error.message
    });
  }
};

// UPDATE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.updateMembership = async (req, res) => {
  try {
    const { id } = req.params;

    const membership = await Membership.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true 
    });

    if (!membership) {
      return res.status(404).json({ message: 'Membership tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Membership berhasil diperbarui',
      data: membership
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
        const errorResponse = handleValidationError(error);
        return res.status(400).json(errorResponse);
    }
    res.status(400).json({
      message: 'Gagal memperbarui Membership',
      error: error.message
    });
  }
};

// DELETE (HANYA MENGGUNAKAN ID DARI PARAMS)
exports.deleteMembership = async (req, res) => {
  try {
    const { id } = req.params;
    
    const membership = await Membership.findByIdAndDelete(id);

    if (!membership) {
      return res.status(404).json({ message: 'Membership tidak ditemukan' });
    }

    res.status(200).json({ message: 'Membership berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: 'Gagal menghapus Membership',
      error: error.message
    });
  }
};