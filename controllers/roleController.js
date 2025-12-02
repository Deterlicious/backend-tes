const Role = require("../models/roleModel");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai
const redis = require("../utils/redisClient");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyRoleList = (tenantID) => `role:tenant:${tenantID}`;
const keyRoleDetail = (id) => `role:detail:${id}`;

exports.createRole = async (req, res) => {
  try {
    const { tenantID, namaRole, deskripsi } = req.body;

    // 1. Validasi Input
    if (!tenantID || !namaRole) {
      return res.status(400).json({ message: "tenantID dan namaRole wajib diisi" });
    }
    if (!isValidObjectId(tenantID)) {
      return res.status(400).json({ message: "Format tenantID tidak valid" });
    }

    const newRole = new Role({ tenantID, namaRole, deskripsi });
    await newRole.save();

    // 2. Cache Invalidation
    // Hapus cache list role milik tenant ini agar role baru muncul
    await redis.del(keyRoleList(tenantID));

    res.status(201).json(newRole);
  } catch (error) {
    // Handle error duplikasi (dari unique index)
    if (error.code === 11000) {
      return res.status(400).json({ message: "Role dengan nama tersebut sudah ada di tenant ini." });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.getAllRoles = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan dalam query params" });
    }

    // 1. Cek Cache
    const cacheKey = keyRoleList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const roles = await Role.find({ tenantID }).populate("tenantID", "namaToko");

    // 3. Simpan Cache (Expire 1 jam karena role jarang berubah)
    await redis.setEx(cacheKey, 3600, JSON.stringify(roles));

    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID Role tidak valid" });
    }

    // 1. Cek Cache
    const cacheKey = keyRoleDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const role = await Role.findById(id).populate("tenantID", "namaToko");
    
    if (!role) {
        return res.status(404).json({ message: "Role tidak ditemukan" });
    }

    // 3. Simpan Cache
    await redis.setEx(cacheKey, 3600, JSON.stringify(role));

    res.json(role);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID Role tidak valid" });
    }

    // 1. Validasi Field (Whitelisting)
    const allowedUpdates = ["namaRole", "deskripsi"];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
        if(allowedUpdates.includes(key)) {
            updates[key] = req.body[key];
        }
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Tidak ada data valid untuk diupdate" });
    }

    // 2. Update DB
    const role = await Role.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!role) return res.status(404).json({ message: "Role tidak ditemukan" });

    // 3. Cache Invalidation
    await redis.del(keyRoleDetail(id));
    await redis.del(keyRoleList(role.tenantID));

    res.json(role);
  } catch (error) {
    // Handle error duplikasi saat update
    if (error.code === 11000) {
        return res.status(400).json({ message: "Nama role tersebut sudah digunakan di tenant ini." });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID Role tidak valid" });
    }

    const role = await Role.findById(id);
    if (!role) return res.status(404).json({ message: "Role tidak ditemukan" });

    // 1. Hapus DB
    await Role.findByIdAndDelete(id);

    // 2. Cache Invalidation
    await redis.del(keyRoleDetail(id));
    await redis.del(keyRoleList(role.tenantID));

    res.json({ message: "Role berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};