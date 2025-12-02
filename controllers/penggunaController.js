require("dotenv").config();
const Pengguna = require("../models/penggunaModel");
const RolePermission = require("../models/rolePermissionModel");
const Permission = require("../models/permissionModel");
const Role = require("../models/roleModel");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai
const redis = require("../utils/redisClient");

const PENGGUNA_JWT_SECRET = process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";
const PENGGUNA_JWT_REFRESH_SECRET = process.env.PENGGUNA_JWT_REFRESH_SECRET || "pengguna_refresh_secret";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyPenggunaList = (tenantID) => `pengguna:tenant:${tenantID}`;
const keyPenggunaDetail = (id) => `pengguna:detail:${id}`;
const keyLoginScreen = (tenantID) => `pengguna:loginscreen:${tenantID}`;

// --- Token Helpers ---
const createPenggunaAccessToken = (pengguna, tokenVersion, permissions) => {
  return jwt.sign(
    {
      id: pengguna._id,
      nama: pengguna.nama,
      roleID: pengguna.roleID,
      tenantID: pengguna.tenantID,
      version: tokenVersion,
      permissions: permissions,
    },
    PENGGUNA_JWT_SECRET,
    { expiresIn: "15m" }
  );
};

const createPenggunaRefreshToken = (pengguna, tokenVersion) => {
  return jwt.sign(
    {
      id: pengguna._id,
      tenantID: pengguna.tenantID,
      version: tokenVersion,
    },
    PENGGUNA_JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

const sendPenggunaRefreshTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/pengguna",
  };

  if (token === "") {
    cookieOptions.expires = new Date(0);
  } else {
    cookieOptions.maxAge = 7 * 24 * 60 * 60 * 1000;
  }

  res.cookie("penggunaRefreshToken", token, cookieOptions);
};

// ======== Auth Controllers ========

exports.loginPin = async (req, res) => {
  try {
    const { pin, tenantID } = req.body;
    
    // 1. Validasi Input
    if (!pin || !tenantID) {
      return res.status(400).json({ message: "PIN dan tenantID wajib diisi" });
    }
    if (!isValidObjectId(tenantID)) {
      return res.status(400).json({ message: "Format tenantID tidak valid" });
    }

    // 2. Cari Pengguna
    // Optimasi: Hanya ambil field yang diperlukan untuk login (pin, status, roleID, nama)
    const allPenggunaInTenant = await Pengguna.find({ tenantID });
    
    let pengguna = null;
    // Loop ini berat jika user banyak (karena bcrypt), tapi diperlukan karena design login hanya pakai PIN
    for (let p of allPenggunaInTenant) {
      if (await p.comparePin(pin)) {
        pengguna = p;
        break;
      }
    }

    if (!pengguna) {
      return res.status(400).json({ message: "PIN salah atau tidak terdaftar" });
    }

    if (pengguna.status !== "aktif") {
      return res.status(403).json({ message: "Akun pengguna tidak aktif" });
    }

    // 3. Ambil Permissions
    const rolePermissions = await RolePermission.find({
      roleID: pengguna.roleID,
    }).populate("permissionID", "nama");
    const permissions = rolePermissions.map((rp) => rp.permissionID.nama);

    // 4. Update Token Version
    const newRandomTokenVersion = Math.floor(1000 + Math.random() * 9000);
    pengguna.tokenVersion = newRandomTokenVersion;
    await pengguna.save();

    // Cache Invalidation (Detail user berubah karena tokenVersion)
    await redis.del(keyPenggunaDetail(pengguna._id));

    // 5. Generate Tokens
    const accessToken = createPenggunaAccessToken(
      pengguna,
      newRandomTokenVersion,
      permissions
    );
    const refreshToken = createPenggunaRefreshToken(
      pengguna,
      newRandomTokenVersion
    );

    sendPenggunaRefreshTokenCookie(res, refreshToken);

    res.json({
      message: "Login PIN berhasil",
      accessToken,
      refreshToken,
      data: {
        id: pengguna._id,
        nama: pengguna.nama,
        roleID: pengguna.roleID,
        permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.refreshTokenPin = async (req, res) => {
  const token = req.cookies.penggunaRefreshToken || req.body.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "Tidak ada refresh token" });
  }

  try {
    const payload = jwt.verify(token, PENGGUNA_JWT_REFRESH_SECRET);
    
    // Gunakan findById langsung ke DB untuk keamanan maksimal (jangan pakai cache untuk auth check)
    const pengguna = await Pengguna.findById(payload.id);

    if (
      !pengguna ||
      pengguna.tokenVersion === 0 ||
      pengguna.tokenVersion !== payload.version
    ) {
      return res
        .status(401)
        .json({ message: "Sesi tidak valid. Silakan login kembali." });
    }

    const newRandomTokenVersion = Math.floor(1000 + Math.random() * 9000);
    pengguna.tokenVersion = newRandomTokenVersion;
    await pengguna.save();

    // Invalidate Cache Detail
    await redis.del(keyPenggunaDetail(pengguna._id));

    const rolePermissions = await RolePermission.find({
      roleID: pengguna.roleID,
    }).populate("permissionID", "nama");
    const permissions = rolePermissions.map((rp) => rp.permissionID.nama);

    const newAccessToken = createPenggunaAccessToken(
      pengguna,
      newRandomTokenVersion,
      permissions
    );
    const newRefreshToken = createPenggunaRefreshToken(
      pengguna,
      newRandomTokenVersion
    );

    sendPenggunaRefreshTokenCookie(res, newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    return res
      .status(403)
      .json({ message: "Refresh token tidak valid", error: err.message });
  }
};

exports.logoutPin = async (req, res) => {
  try {
    const penggunaId = req.pengguna.id;
    await Pengguna.findByIdAndUpdate(penggunaId, { tokenVersion: 0 });
    
    // Invalidate Cache
    await redis.del(keyPenggunaDetail(penggunaId));

    sendPenggunaRefreshTokenCookie(res, "");
    res.json({ message: "Logout berhasil" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======== CRUD Controllers ========

exports.createPengguna = async (req, res) => {
  try {
    const {
      nama,
      pin,
      roleID,
      status,
      nomorHp,
      posisiID,
      tenantID,
      fotoKaryawan,
    } = req.body;

    // 1. Validasi Input Wajib
    if (!nama || !pin || !tenantID) {
      return res.status(400).json({ message: "nama, pin, dan tenantID wajib diisi" });
    }
    if (pin.length < 6) {
        return res.status(400).json({ message: "PIN minimal 6 karakter" });
    }
    if (!isValidObjectId(tenantID)) {
        return res.status(400).json({ message: "Format tenantID tidak valid" });
    }
    if (roleID && !isValidObjectId(roleID)) {
        return res.status(400).json({ message: "Format roleID tidak valid" });
    }

    // 2. Cek Duplikasi PIN
    const existingPin = await Pengguna.findOne({ pin });
    if (existingPin) {
      return res.status(400).json({ message: "PIN sudah digunakan" });
    }

    // 3. Logika Owner vs Karyawan
    const userCount = await Pengguna.countDocuments({ tenantID });
    let finalRoleID = roleID;

    if (userCount > 0 && !req.pengguna) {
      return res.status(403).json({
        message: "Tenant ini sudah memiliki Owner. Silakan login untuk menambah karyawan.",
      });
    }

    if (userCount === 0) {
      // --- Logika Pembuatan Owner (User Pertama) ---
      let ownerRole = await Role.findOne({ tenantID, namaRole: "Owner" });
      if (!ownerRole) {
        ownerRole = new Role({
          tenantID,
          namaRole: "Owner",
          deskripsi: "Hak akses penuh (Super Admin)",
        });
        await ownerRole.save();
      }

      const allPermissions = await Permission.find({});
      await RolePermission.deleteMany({ roleID: ownerRole._id });

      const permissionInserts = allPermissions.map((perm) => ({
        tenantID,
        roleID: ownerRole._id,
        permissionID: perm._id,
      }));

      if (permissionInserts.length > 0) {
        await RolePermission.insertMany(permissionInserts);
      }

      finalRoleID = ownerRole._id;
    } else {
      // --- Logika Pembuatan Karyawan Biasa ---
      if (!roleID) {
        return res.status(400).json({ message: "roleID wajib diisi untuk penambahan karyawan" });
      }
    }

    const newPengguna = new Pengguna({
      nama,
      pin,
      roleID: finalRoleID,
      status: status || "aktif",
      nomorHp,
      posisiID,
      tenantID,
      fotoKaryawan,
      tokenVersion: 0,
    });

    await newPengguna.save();

    // 4. Cache Invalidation
    await redis.del(keyPenggunaList(tenantID));
    await redis.del(keyLoginScreen(tenantID));

    res.status(201).json({
      message: userCount === 0 ? "Owner berhasil dibuat" : "Pengguna berhasil dibuat",
      data: {
        id: newPengguna._id,
        nama: newPengguna.nama,
        roleID: newPengguna.roleID,
        tenantID: newPengguna.tenantID,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllPengguna = async (req, res) => {
  try {
    // Ambil tenantID dari user yang login (jika ada req.pengguna) atau query params
    const tenantID = req.query.tenantID || req.pengguna?.tenantID;

    if (!tenantID) {
        // Jika super admin ingin lihat semua user, mungkin perlu logic lain, 
        // tapi defaultnya kita batasi per tenant
        return res.status(400).json({message: "tenantID diperlukan"});
    }

    // 1. Cek Cache
    const cacheKey = keyPenggunaList(tenantID);
    const cachedData = await redis.get(cacheKey);
    if(cachedData) return res.json(JSON.parse(cachedData));

    // 2. Ambil DB
    const pengguna = await Pengguna.find({ tenantID })
      .populate("tenantID", "namaToko status")
      .populate("posisiID", "namaPosisi deskripsi")
      .populate("roleID", "namaRole deskripsi")
      .select("-pin"); // Jangan kirim hash PIN

    // 3. Simpan Cache
    await redis.setEx(cacheKey, 60, JSON.stringify(pengguna));

    res.json(pengguna);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPenggunaById = async (req, res) => {
  try {
    const { id } = req.params;
    if(!isValidObjectId(id)) return res.status(400).json({ message: "Invalid ID"});

    // 1. Cek Cache
    const cacheKey = keyPenggunaDetail(id);
    const cachedData = await redis.get(cacheKey);
    if(cachedData) return res.json(JSON.parse(cachedData));

    // 2. Ambil DB
    const pengguna = await Pengguna.findById(id)
      .populate("tenantID")
      .populate("posisiID")
      .populate("roleID", "namaRole")
      .select("-pin");

    if (!pengguna)
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });

    // 3. Simpan Cache
    await redis.setEx(cacheKey, 60, JSON.stringify(pengguna));

    res.json(pengguna);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePengguna = async (req, res) => {
  try {
    const { id } = req.params;
    if(!isValidObjectId(id)) return res.status(400).json({ message: "Invalid ID"});

    // 1. Validasi Field (Whitelisting)
    const allowedUpdates = ["nama", "pin", "roleID", "status", "nomorHp", "posisiID", "fotoKaryawan"];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
        if(allowedUpdates.includes(key)) updates[key] = req.body[key];
    });

    if(Object.keys(updates).length === 0) {
        return res.status(400).json({message: "Tidak ada data valid untuk diupdate"});
    }

    // 2. Handle PIN Update Logic
    // Kita harus fetch document dulu agar pre-save hook jalan untuk hashing PIN
    const pengguna = await Pengguna.findById(id);
    if (!pengguna) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    // Terapkan updates manual
    if (updates.nama) pengguna.nama = updates.nama;
    if (updates.roleID) pengguna.roleID = updates.roleID;
    if (updates.status) pengguna.status = updates.status;
    if (updates.nomorHp) pengguna.nomorHp = updates.nomorHp;
    if (updates.posisiID) pengguna.posisiID = updates.posisiID;
    if (updates.fotoKaryawan) pengguna.fotoKaryawan = updates.fotoKaryawan;
    
    if (updates.pin) {
      if (updates.pin.length < 6) {
        return res.status(400).json({ message: "PIN minimal 6 karakter" });
      }
      pengguna.pin = updates.pin; // pre-save akan meng-hash ini
    }

    const updatedPengguna = await pengguna.save();

    // 3. Cache Invalidation
    await redis.del(keyPenggunaDetail(id));
    await redis.del(keyPenggunaList(pengguna.tenantID));
    await redis.del(keyLoginScreen(pengguna.tenantID));

    res.json(updatedPengguna);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deletePengguna = async (req, res) => {
  try {
    const { id } = req.params;
    if(!isValidObjectId(id)) return res.status(400).json({ message: "Invalid ID"});

    const pengguna = await Pengguna.findById(id);
    if (!pengguna) return res.status(404).json({ message: "Pengguna tidak ditemukan" });

    // 1. Hapus DB
    await Pengguna.findByIdAndDelete(id);

    // 2. Cache Invalidation
    await redis.del(keyPenggunaDetail(id));
    await redis.del(keyPenggunaList(pengguna.tenantID));
    await redis.del(keyLoginScreen(pengguna.tenantID));

    res.json({ message: "Pengguna berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPenggunaForLoginScreen = async (req, res) => {
  try {
    const { tenantID } = req.params;

    if (!tenantID || !isValidObjectId(tenantID)) {
      return res.status(400).json({ message: "Tenant ID diperlukan dan harus valid" });
    }

    // 1. Cek Cache (Sangat penting untuk POS Login Screen)
    const cacheKey = keyLoginScreen(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
        return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil DB
    // Hanya ambil user Aktif untuk login screen
    const pengguna = await Pengguna.find({ tenantID, status: "aktif" })
      .select("nama fotoKaryawan roleID posisiID") // Optimization: Select only needed fields
      .populate("roleID", "namaRole")
      .populate("posisiID", "namaPosisi");

    // 3. Simpan Cache (Expire agak lama, misalnya 5 menit, karena jarang berubah)
    await redis.setEx(cacheKey, 300, JSON.stringify(pengguna));

    res.json(pengguna);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};