const RolePermission = require("../models/rolePermissionModel");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai
const redis = require("../utils/redisClient");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
// Cache disimpan per Role ID
const keyRolePermissions = (roleID) => `role:permissions:${roleID}`;

exports.assignPermission = async (req, res) => {
  try {
    const { tenantID, roleID, permissionID } = req.body;

    // 1. Validasi Input
    if (!tenantID || !roleID || !permissionID) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    if (!isValidObjectId(tenantID) || !isValidObjectId(roleID) || !isValidObjectId(permissionID)) {
      return res.status(400).json({ message: "Format ID tidak valid" });
    }

    // 2. Cek Duplikasi (meskipun DB punya unique index, cek di sini untuk pesan error yg lebih rapi)
    const existing = await RolePermission.findOne({ roleID, permissionID });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Permission ini sudah ada di role tersebut" });
    }

    // 3. Simpan ke DB
    const newAssign = new RolePermission({ tenantID, roleID, permissionID });
    await newAssign.save();

    // 4. Cache Invalidation
    // Hapus cache permission milik role ini agar data terupdate
    await redis.del(keyRolePermissions(roleID));

    res.status(201).json(newAssign);
  } catch (error) {
    // Handle duplicate error dari Mongo
    if (error.code === 11000) {
      return res.status(409).json({ message: "Permission sudah ditetapkan ke role ini." });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.getPermissionsByRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    if (!isValidObjectId(roleId)) {
      return res.status(400).json({ message: "Format Role ID tidak valid" });
    }

    // 1. Cek Cache
    const cacheKey = keyRolePermissions(roleId);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const permissions = await RolePermission.find({ roleID: roleId })
      .populate("permissionID", "nama grup")
      .populate("roleID", "namaRole");

    // 3. Simpan Cache (Expire 1 jam karena konfigurasi permission jarang berubah)
    await redis.setEx(cacheKey, 3600, JSON.stringify(permissions));

    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removePermission = async (req, res) => {
  try {
    const { id } = req.params; // Ini adalah ID dari dokumen RolePermission (relasi), bukan permissionID

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID Relasi tidak valid" });
    }

    // Cari dulu dokumennya untuk mendapatkan roleID sebelum dihapus
    const assignment = await RolePermission.findById(id);

    if (!assignment) {
      return res
        .status(404)
        .json({ message: "Relasi permission tidak ditemukan" });
    }

    // 1. Hapus dari DB
    await RolePermission.findByIdAndDelete(id);

    // 2. Cache Invalidation
    // Hapus cache milik role yang bersangkutan
    await redis.del(keyRolePermissions(assignment.roleID));

    res.json({ message: "Permission berhasil dihapus dari role" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};