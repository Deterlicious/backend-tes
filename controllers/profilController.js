const Profil = require("../models/profilModel");

// ✅ CREATE Profil
exports.createProfil = async (req, res) => {
  try {
    const { username, email, password, tenantID } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email dan password wajib diisi" });
    }

    const existingUser = await Profil.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email sudah digunakan" });
    }

    const newProfil = new Profil({
      username,
      email,
      password,
      tenantID,
    });

    await newProfil.save();
    res.status(201).json({ message: "Profil berhasil dibuat", data: newProfil });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 READ Semua Profil
exports.getAllProfil = async (req, res) => {
  try {
    const profils = await Profil.find().populate("tenantID", "namaToko status");
    res.json(profils);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔍 READ Profil by ID
exports.getProfilById = async (req, res) => {
  try {
    const profil = await Profil.findById(req.params.id).populate("tenantID");
    if (!profil) return res.status(404).json({ message: "Profil tidak ditemukan" });
    res.json(profil);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ UPDATE Profil
exports.updateProfil = async (req, res) => {
  try {
    const updates = req.body;
    const profil = await Profil.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!profil) return res.status(404).json({ message: "Profil tidak ditemukan" });
    res.json(profil);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🗑️ DELETE Profil
exports.deleteProfil = async (req, res) => {
  try {
    const profil = await Profil.findByIdAndDelete(req.params.id);
    if (!profil) return res.status(404).json({ message: "Profil tidak ditemukan" });
    res.json({ message: "Profil berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
