const Profile = require("../models/profileModel");

// ✅ CREATE Profile
exports.createProfile = async (req, res) => {
  try {
    const { username, email, password, nomorHP, tenantID, role } = req.body;

    if (!email || !password || !nomorHP) {
      return res.status(400).json({ message: "email, password, dan nomorHP wajib diisi" });
    }

    const existingUser = await Profile.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email sudah digunakan" });
    }

    const newProfile = new Profile({
      username,
      email,
      password,
      nomorHP,
      tenantID,
      role,
    });

    await newProfile.save();
    res.status(201).json({ message: "Profile berhasil dibuat", data: newProfile });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 READ Semua Profile
exports.getAllProfiles = async (req, res) => {
  try {
    const profiles = await Profile.find().populate("tenantID", "namaToko status");
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔍 READ Profile by ID
exports.getProfileById = async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id).populate("tenantID");
    if (!profile) return res.status(404).json({ message: "Profile tidak ditemukan" });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ UPDATE Profile
exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    const profile = await Profile.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!profile) return res.status(404).json({ message: "Profile tidak ditemukan" });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🗑️ DELETE Profile
exports.deleteProfile = async (req, res) => {
  try {
    const profile = await Profile.findByIdAndDelete(req.params.id);
    if (!profile) return res.status(404).json({ message: "Profile tidak ditemukan" });
    res.json({ message: "Profile berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
