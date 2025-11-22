const IzinCuti = require("../models/izinCutiModel");

exports.createIzinCuti = async (req, res) => {
  try {
    const {
      penggunaID,
      tanggalMulai,
      tanggalSelesai,
      tipe,
      status,
      keterangan,
      dicatatOleh,
      tenantID,
    } = req.body;

    if (
      !penggunaID ||
      !tanggalMulai ||
      !tanggalSelesai ||
      !tipe ||
      !keterangan ||
      !tenantID
    ) {
      return res.status(400).json({
        message:
          "Mohon lengkapi data wajib (penggunaID, tanggal, tipe, keterangan, tenantID)",
      });
    }

    const izinCuti = new IzinCuti({
      penggunaID,
      tanggalMulai,
      tanggalSelesai,
      tipe,
      status,
      keterangan,
      dicatatOleh,
      tenantID,
    });

    await izinCuti.save();
    res.status(201).json(izinCuti);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllIzinCuti = async (req, res) => {
  try {
    const data = await IzinCuti.find()
      .populate("tenantID", "namaToko")
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama");
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getIzinCutiById = async (req, res) => {
  try {
    const izinCuti = await IzinCuti.findById(req.params.id)
      .populate("tenantID", "namaToko")
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama");

    if (!izinCuti)
      return res.status(404).json({ message: "Data izin/cuti tidak ditemukan" });

    res.json(izinCuti);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateIzinCuti = async (req, res) => {
  try {
    const updates = req.body;

    const izinCuti = await IzinCuti.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    })
      .populate("penggunaID", "nama")
      .populate("dicatatOleh", "nama");

    if (!izinCuti)
      return res.status(404).json({ message: "Data izin/cuti tidak ditemukan" });

    res.json(izinCuti);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteIzinCuti = async (req, res) => {
  try {
    const izinCuti = await IzinCuti.findByIdAndDelete(req.params.id);
    if (!izinCuti)
      return res.status(404).json({ message: "Data izin/cuti tidak ditemukan" });

    res.json({ message: "Data izin/cuti berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};