const Permission = require("../models/permissionModel");

exports.createPermission = async (req, res) => {
  try {
    const { nama, grup } = req.body;

    if (!nama || !grup) {
      return res.status(400).json({ message: "Nama dan grup wajib diisi" });
    }

    const newPermission = new Permission({ nama, grup });
    await newPermission.save();

    res.status(201).json(newPermission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ grup: 1, nama: 1 });
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPermissionsGrouped = async (req, res) => {
  try {
    const groupedPermissions = await Permission.aggregate([
      {
        $group: {
          _id: "$grup",
          permissions: {
            $push: {
              _id: "$_id",
              nama: "$nama",
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.json(groupedPermissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deletePermission = async (req, res) => {
  try {
    const permission = await Permission.findByIdAndDelete(req.params.id);

    if (!permission) {
      return res.status(404).json({ message: "Permission tidak ditemukan" });
    }

    res.json({ message: "Permission berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};