const Absensi = require("../models/absensiModel");

exports.createAbsensi = async (req, res) => {
  try {
    const {
      tanggal,
      waktuMasuk,
      fotoMasuk,
      waktuPulang,
      fotoPulang,
      keterangan,
      tenantID,
      penggunaID,
    } = req.body;

    if (
      !tanggal ||
      !waktuMasuk ||
      !fotoMasuk ||
      !waktuPulang ||
      !fotoPulang
    ) {
      return res
        .status(400)
        .json({ message: "Semua field wajib diisi kecuali keterangan" });
    }

    const newAbsensi = new Absensi({
      tanggal,
      waktuMasuk,
      fotoMasuk,
      waktuPulang,
      fotoPulang,
      keterangan,
      tenantID,
      penggunaID,
    });

    await newAbsensi.save();
    res
      .status(201)
      .json({ message: "Absensi berhasil dibuat", data: newAbsensi });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllAbsensi = async (req, res) => {
  try {
    const absensi = await Absensi.find()
      .populate("tenantID", "namaToko status")
      .populate("penggunaID", "nama role");
    res.json(absensi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAbsensiById = async (req, res) => {
  try {
    const absensi = await Absensi.findById(req.params.id)
      .populate("tenantID")
      .populate("penggunaID");
    if (!absensi)
      return res.status(404).json({ message: "Data absensi tidak ditemukan" });
    res.json(absensi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAbsensi = async (req, res) => {
  try {
    const updates = req.body;
    const absensi = await Absensi.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!absensi)
      return res.status(404).json({ message: "Data absensi tidak ditemukan" });
    res.json(absensi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAbsensi = async (req, res) => {
  try {
    const absensi = await Absensi.findByIdAndDelete(req.params.id);
    if (!absensi)
      return res.status(404).json({ message: "Data absensi tidak ditemukan" });
    res.json({ message: "Data absensi berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};