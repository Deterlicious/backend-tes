const Role = require("../models/roleModel");

exports.createRole = async (req, res) => {
  try {
    const { tenantID, namaRole, deskripsi } = req.body;
    if (!tenantID || !namaRole) {
      return res
        .status(400)
        .json({ message: "tenantID dan namaRole wajib diisi" });
    }
    const newRole = new Role({ tenantID, namaRole, deskripsi });
    await newRole.save();
    res.status(201).json(newRole);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find().populate("tenantID", "namaToko");
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: "Role tidak ditemukan" });
    res.json(role);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!role) return res.status(404).json({ message: "Role tidak ditemukan" });
    res.json(role);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) return res.status(404).json({ message: "Role tidak ditemukan" });
    res.json({ message: "Role berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};