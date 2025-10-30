const IzinCuti = require("../models/izinCutiModel");

// ✅ CREATE
exports.createIzinCuti = async (req, res) => {
  try {
    const {
      tanggalMulai,
      tanggalSelesai,
      tipe,
      status,
      keterangan,
      pengaju,
      dicatatOleh,
      tenantID,
    } = req.body;

    const izinCuti = new IzinCuti({
      tanggalMulai,
      tanggalSelesai,
      tipe,
      status,
      keterangan,
      pengaju,
      dicatatOleh,
      tenantID,
    });

    await izinCuti.save();
    res.status(201).json(izinCuti);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 READ (All)
exports.getAllIzinCuti = async (req, res) => {
  try {
    const data = await IzinCuti.find().populate("tenantID", "namaToko");
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔍 READ (By ID)
exports.getIzinCutiById = async (req, res) => {
  try {
    const izinCuti = await IzinCuti.findById(req.params.id).populate(
      "tenantID",
      "namaToko"
    );

    if (!izinCuti)
      return res.status(404).json({ message: "Data izin/cuti tidak ditemukan" });

    res.json(izinCuti);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ UPDATE
exports.updateIzinCuti = async (req, res) => {
  try {
    const updates = req.body;

    const izinCuti = await IzinCuti.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    if (!izinCuti)
      return res.status(404).json({ message: "Data izin/cuti tidak ditemukan" });

    res.json(izinCuti);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🗑️ DELETE
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
