const Permission = require("../models/permissionModel");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai
const redis = require("../utils/redisClient");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyAllPermissions = "permissions:all";
const keyGroupedPermissions = "permissions:grouped";

exports.createPermission = async (req, res) => {
  try {
    // 1. Validasi Input & Whitelisting
    const { nama, grup } = req.body;

    if (!nama || !grup) {
      return res.status(400).json({ message: "Nama dan grup wajib diisi" });
    }

    // 2. Simpan ke DB
    const newPermission = new Permission({ nama, grup });
    await newPermission.save();

    // 3. Cache Invalidation
    // Karena data berubah, semua cache terkait permission harus dihapus
    await redis.del(keyAllPermissions);
    await redis.del(keyGroupedPermissions);

    res.status(201).json(newPermission);
  } catch (error) {
    // Handle error duplikasi (dari unique index mongoose)
    if (error.code === 11000) {
      return res.status(400).json({ message: "Permission dengan nama ini sudah ada di grup tersebut." });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.getAllPermissions = async (req, res) => {
  try {
    // 1. Cek Cache
    const cachedData = await redis.get(keyAllPermissions);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const permissions = await Permission.find().sort({ grup: 1, nama: 1 });

    // 3. Simpan ke Cache (Expire 1 jam karena permission jarang berubah)
    await redis.setEx(keyAllPermissions, 3600, JSON.stringify(permissions));

    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPermissionsGrouped = async (req, res) => {
  try {
    // 1. Cek Cache
    const cachedData = await redis.get(keyGroupedPermissions);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Aggregasi DB
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
        $sort: { _id: 1 }, // Urutkan berdasarkan nama grup
      },
    ]);

    // 3. Simpan ke Cache
    await redis.setEx(keyGroupedPermissions, 3600, JSON.stringify(groupedPermissions));

    res.json(groupedPermissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Validasi ID
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "Format ID Permission tidak valid" });
    }

    // 2. Hapus dari DB
    const permission = await Permission.findByIdAndDelete(id);

    if (!permission) {
      return res.status(404).json({ message: "Permission tidak ditemukan" });
    }

    // 3. Cache Invalidation
    await redis.del(keyAllPermissions);
    await redis.del(keyGroupedPermissions);

    res.json({ message: "Permission berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};