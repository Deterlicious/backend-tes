const RolePermission = require("../models/rolePermissionModel");

exports.assignPermission = async (req, res) => {
  try {
    const { tenantID, roleID, permissionID } = req.body;
    if (!tenantID || !roleID || !permissionID) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const existing = await RolePermission.findOne({ roleID, permissionID });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Permission ini sudah ada di role tersebut" });
    }

    const newAssign = new RolePermission({ tenantID, roleID, permissionID });
    await newAssign.save();
    res.status(201).json(newAssign);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPermissionsByRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const permissions = await RolePermission.find({ roleID: roleId })
      .populate("permissionID", "nama grup")
      .populate("roleID", "namaRole");

    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removePermission = async (req, res) => {
  try {
    const assignment = await RolePermission.findByIdAndDelete(req.params.id);
    if (!assignment) {
      return res
        .status(404)
        .json({ message: "Relasi permission tidak ditemukan" });
    }
    res.json({ message: "Permission berhasil dihapus dari role" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};