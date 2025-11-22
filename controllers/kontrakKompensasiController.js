const KontrakKompensasi = require("../models/kontrakKompensasiModel");

exports.createKontrak = async (req, res) => {
  try {
    const {
      tenantID,
      penggunaID,
      tipeGaji,
      tarifGaji,
      tanggalMulai,
      tanggalSelesai,
      status,
    } = req.body;

    if (!tenantID || !penggunaID || !tipeGaji || !tarifGaji || !tanggalMulai) {
      return res.status(400).json({ message: "Data wajib belum lengkap" });
    }

    const newKontrak = new KontrakKompensasi({
      tenantID,
      penggunaID,
      tipeGaji,
      tarifGaji,
      tanggalMulai,
      tanggalSelesai,
      status,
    });

    await newKontrak.save();
    res.status(201).json(newKontrak);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllKontrak = async (req, res) => {
  try {
    const kontrak = await KontrakKompensasi.find()
      .populate("tenantID", "namaToko")
      .populate("penggunaID", "nama email");
    res.json(kontrak);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getKontrakById = async (req, res) => {
  try {
    const kontrak = await KontrakKompensasi.findById(req.params.id)
      .populate("tenantID", "namaToko")
      .populate("penggunaID", "nama email");

    if (!kontrak)
      return res.status(404).json({ message: "Kontrak tidak ditemukan" });
    res.json(kontrak);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateKontrak = async (req, res) => {
  try {
    const updates = req.body;
    const kontrak = await KontrakKompensasi.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
      }
    );

    if (!kontrak)
      return res.status(404).json({ message: "Kontrak tidak ditemukan" });
    res.json(kontrak);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteKontrak = async (req, res) => {
  try {
    const kontrak = await KontrakKompensasi.findByIdAndDelete(req.params.id);
    if (!kontrak)
      return res.status(404).json({ message: "Kontrak tidak ditemukan" });
    res.json({ message: "Kontrak berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};