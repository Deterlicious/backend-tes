require("dotenv").config();
const Pengguna = require("../models/penggunaModel");
const RolePermission = require("../models/rolePermissionModel");
const Permission = require("../models/permissionModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const PENGGUNA_JWT_SECRET = process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";
const PENGGUNA_JWT_REFRESH_SECRET =
  process.env.PENGGUNA_JWT_REFRESH_SECRET || "pengguna_refresh_secret";

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

exports.loginPin = async (req, res) => {
  try {
    const { pin, tenantID } = req.body;
    if (!pin || !tenantID) {
      return res.status(400).json({ message: "PIN dan tenantID wajib diisi" });
    }
    const allPenggunaInTenant = await Pengguna.find({ tenantID });
    let pengguna = null;
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
    const rolePermissions = await RolePermission.find({
      roleID: pengguna.roleID,
    }).populate("permissionID", "nama");
    const permissions = rolePermissions.map((rp) => rp.permissionID.nama);
    const newRandomTokenVersion = Math.floor(1000 + Math.random() * 9000);
    pengguna.tokenVersion = newRandomTokenVersion;
    await pengguna.save();
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

    sendPenggunaRefreshTokenCookie(res, "");

    res.json({ message: "Logout berhasil" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createPengguna = async (req, res) => {
  try {
    const { nama, pin, roleID, status, nomorHp, posisiID, tenantID, fotoKaryawan } =
      req.body;
    if (!nama || !pin || !roleID || !tenantID) {
      return res
        .status(400)
        .json({ message: "nama, pin, roleID, dan tenantID wajib diisi" });
    }
    const existingPin = await Pengguna.findOne({ pin });
    if (existingPin) {
      return res.status(400).json({ message: "PIN sudah digunakan" });
    }
    const newPengguna = new Pengguna({
      nama,
      pin,
      roleID,
      status,
      nomorHp,
      posisiID,
      tenantID,
      fotoKaryawan,
    });
    await newPengguna.save();
    res
      .status(201)
      .json({ message: "Pengguna berhasil dibuat", data: newPengguna });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllPengguna = async (req, res) => {
  try {
    const pengguna = await Pengguna.find()
      .populate("tenantID", "namaToko status")
      .populate("posisiID", "namaPosisi deskripsi")
      .populate("roleID", "namaRole deskripsi");
    res.json(pengguna);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPenggunaById = async (req, res) => {
  try {
    const pengguna = await Pengguna.findById(req.params.id)
      .populate("tenantID")
      .populate("posisiID")
      .populate("roleID", "namaRole");
    if (!pengguna)
      return res.status(440).json({ message: "Pengguna tidak ditemukan" });
    res.json(pengguna);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePengguna = async (req, res) => {
  try {
    const { pin, ...otherUpdates } = req.body;
    const pengguna = await Pengguna.findById(req.params.id);
    if (!pengguna) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }
    Object.assign(pengguna, otherUpdates);
    if (pin) {
      if (pin.length < 6) {
        return res.status(400).json({ message: "PIN minimal 6 karakter" });
      }
      pengguna.pin = pin;
    }
    const updatedPengguna = await pengguna.save();
    res.json(updatedPengguna);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deletePengguna = async (req, res) => {
  try {
    const pengguna = await Pengguna.findByIdAndDelete(req.params.id);
    if (!pengguna)
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    res.json({ message: "Pengguna berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};