const Pengguna = require("../models/penggunaModel");

// ✅ CREATE
exports.createPengguna = async (req, res) => {
  try {
    const { nama, pin, role, status, nomorHP, posisiID, tenantID, fotoKaryawan } = req.body;

    if (!nama || !pin || !role) {
      return res.status(400).json({ message: "nama, pin, dan role wajib diisi" });
    }

    const existingPin = await Pengguna.findOne({ pin });
    if (existingPin) {
      return res.status(400).json({ message: "PIN sudah digunakan" });
    }

    const newPengguna = new Pengguna({
      nama,
      pin,
      role,
      status,
      nomorHP,
      posisiID,
      tenantID,
      fotoKaryawan,
    });

    await newPengguna.save();
    res.status(201).json({ message: "Pengguna berhasil dibuat", data: newPengguna });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 READ Semua
exports.getAllPengguna = async (req, res) => {
  try {
    const pengguna = await Pengguna.find()
      .populate("tenantID", "namaToko status")
      .populate("posisiID", "namaPosisi deskripsi");
    res.json(pengguna);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔍 READ by ID
exports.getPenggunaById = async (req, res) => {
  try {
    const pengguna = await Pengguna.findById(req.params.id)
      .populate("tenantID")
      .populate("posisiID");
    if (!pengguna) return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    res.json(pengguna);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ UPDATE
exports.updatePengguna = async (req, res) => {
  try {
    const updates = req.body;
    const pengguna = await Pengguna.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!pengguna) return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    res.json(pengguna);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🗑️ DELETE
exports.deletePengguna = async (req, res) => {
  try {
    const pengguna = await Pengguna.findByIdAndDelete(req.params.id);
    if (!pengguna) return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    res.json({ message: "Pengguna berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
