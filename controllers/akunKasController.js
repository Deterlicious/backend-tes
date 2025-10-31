const AkunKas = require('../models/akunKasModel');

// CREATE
exports.tambahAkunKas = async (req, res) => {
  try {
    const {
      akunKasID,
      namaAkun,
      saldo,
      tipeAkun,
      status,
      nomorAkun,
      keterangan,
      tenantID
    } = req.body;

    // Validasi field wajib
    if (!akunKasID || !namaAkun || saldo == null || !nomorAkun) {
      return res.status(400).json({
        message: "Field akunKasID, namaAkun, saldo, dan nomorAkun wajib diisi.",
      });
    }

    // Cek akunKasID agar unik
    const existing = await AkunKas.findOne({ akunKasID });
    if (existing) {
      return res.status(400).json({
        message: `Akun Kas dengan ID ${akunKasID} sudah ada.`,
      });
    }

    const akunKasBaru = new AkunKas({
      akunKasID,
      namaAkun,
      saldo,
      tipeAkun,
      status: status || "aktif",
      nomorAkun,
      keterangan,
      tenantID,
    });

    await akunKasBaru.save();
    res.status(201).json({
      message: "Akun Kas berhasil ditambahkan",
      data: akunKasBaru,
    });
  } catch (error) {
    res.status(400).json({
      message: "Gagal menambah akun kas",
      error: error.message,
    });
  }
};

// READ ALL
exports.getAllAkunKas = async (req, res) => {
  try {
    const akunKas = await AkunKas.find().sort({ createdAt: -1 });
    res.status(200).json(akunKas);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data akun kas",
      error: error.message,
    });
  }
};

// READ BY ID
exports.getAkunKasById = async (req, res) => {
  try {
    const akunKas = await AkunKas.findOne({
      akunKasID: req.params.akunKasID,
    });
    if (!akunKas)
      return res.status(404).json({ message: "Akun Kas tidak ditemukan" });
    res.status(200).json(akunKas);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data akun kas",
      error: error.message,
    });
  }
};

// UPDATE BY akunKasID
exports.updateAkunKas = async (req, res) => {
  try {
    const akunKas = await AkunKas.findOneAndUpdate(
      { akunKasID: req.params.akunKasID },
      req.body,
      { new: true, runValidators: true }
    );

    if (!akunKas)
      return res.status(404).json({ message: "Akun Kas tidak ditemukan" });

    res.status(200).json({
      message: "Akun Kas berhasil diperbarui",
      data: akunKas,
    });
  } catch (error) {
    res.status(400).json({
      message: "Gagal memperbarui akun kas",
      error: error.message,
    });
  }
};

// DELETE BY akunKasID
exports.hapusAkunKas = async (req, res) => {
  try {
    const akunKas = await AkunKas.findOneAndDelete({
      akunKasID: req.params.akunKasID,
    });

    if (!akunKas)
      return res.status(404).json({ message: "Akun Kas tidak ditemukan" });

    res.status(200).json({
      message: `Akun Kas dengan ID ${req.params.akunKasID} berhasil dihapus.`,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus akun kas",
      error: error.message,
    });
  }
};
