const Posisi = require("../models/posisiModel");

// ✅ CREATE
exports.createPosisi = async (req, res) => {
  try {
    const { namaPosisi, deskripsi, tenantID } = req.body;
    if (!namaPosisi || !deskripsi) {
      return res.status(400).json({ message: "namaPosisi dan deskripsi wajib diisi" });
    }

    const newPosisi = new Posisi({ namaPosisi, deskripsi, tenantID });
    await newPosisi.save();
    res.status(201).json(newPosisi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 READ Semua
exports.getAllPosisi = async (req, res) => {
  try {
    const posisi = await Posisi.find().populate("tenantID", "namaToko status");
    res.json(posisi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔍 READ by ID
exports.getPosisiById = async (req, res) => {
  try {
    const posisi = await Posisi.findById(req.params.id).populate("tenantID");
    if (!posisi) return res.status(404).json({ message: "Posisi tidak ditemukan" });
    res.json(posisi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ UPDATE
exports.updatePosisi = async (req, res) => {
  try {
    const updates = req.body;
    const posisi = await Posisi.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!posisi) return res.status(404).json({ message: "Posisi tidak ditemukan" });
    res.json(posisi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🗑️ DELETE
exports.deletePosisi = async (req, res) => {
  try {
    const posisi = await Posisi.findByIdAndDelete(req.params.id);
    if (!posisi) return res.status(404).json({ message: "Posisi tidak ditemukan" });
    res.json({ message: "Posisi berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
