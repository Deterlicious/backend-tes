require("dotenv").config();

const Akun = require("../models/akunModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Konfigurasi JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "secret_key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret_key";

// ======== Fungsi Helper Token ========

const createAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: "1m",
  });
};

const createRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id, version: user.tokenVersion },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

const sendRefreshToken = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/akun/auth",
  });
};

// ======== Controller Autentikasi ========

// [POST] /auth/register
exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email dan password wajib diisi" });

    const existingUser = await Akun.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email sudah digunakan" });

    const newUser = new Akun({ username, email, password, role });
    await newUser.save();

    res.status(201).json({ message: "Registrasi berhasil", data: newUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [POST] /auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Akun.findOne({ email });

    if (!user) return res.status(404).json({ message: "Email tidak ditemukan" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Password salah" });

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    sendRefreshToken(res, refreshToken);

    res.json({ message: "Login berhasil", accessToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [POST] /auth/refresh-token
exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "Akses ditolak. Tidak ada refresh token." });
  }

  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET);

    const user = await Akun.findById(payload.id);
    if (!user) {
      return res.status(401).json({ message: "User tidak ditemukan." });
    }

    if (user.tokenVersion !== payload.version) {
      sendRefreshToken(res, "");
      return res.status(401).json({ message: "Sesi tidak valid. Silakan login kembali." });
    }

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user);
    sendRefreshToken(res, newRefreshToken);

    res.json({ accessToken: newAccessToken });

  } catch (err) {
    return res.status(403).json({ message: "Refresh token tidak valid.", error: err.message });
  }
};

// [POST] /auth/logout
exports.logout = async (req, res) => {
  try {
    res.cookie("refreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/akun/auth",
      expires: new Date(0),
    });

    res.json({ message: "Logout berhasil" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [POST] /auth/logout-all
exports.logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.id;
    await Akun.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });

    res.cookie("refreshToken", "", {
      httpOnly: true,
      expires: new Date(0),
      path: "/api/akun/auth",
    });

    res.json({ message: "Berhasil logout dari semua perangkat." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======== Controller Profil Pengguna ========

// [GET] /auth/profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const user = await Akun.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "Akun tidak ditemukan" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [PUT] /auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const updates = req.body;
    const updated = await Akun.findByIdAndUpdate(userId, updates, { new: true });
    res.json({ message: "Akun diperbarui", data: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [DELETE] /auth/delete
exports.deleteProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    await Akun.findByIdAndDelete(userId);
    res.json({ message: "Akun berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======== Controller Manajemen Device ========

// [GET] /devices
exports.getDevices = async (req, res) => {
  try {
    const user = await Akun.findById(req.user.id);
    res.json(user.device);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [GET] /devices/check/:deviceId
exports.checkDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const user = await Akun.findById(req.user.id);
    const device = user.device.find(d => d.deviceID === deviceId);
    if (!device) return res.status(404).json({ message: "Device tidak ditemukan" });
    res.json(device);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [POST] /devices/add
exports.addDevice = async (req, res) => {
  try {
    const { deviceID, type } = req.body;
    const user = await Akun.findById(req.user.id);

    if (user.device.length >= user.maxDevice)
      return res.status(400).json({ message: "Jumlah device maksimal sudah tercapai" });

    user.device.push({ deviceID, type });
    user.deviceHistory.push({ deviceID, type, action: "added" });

    await user.save();
    res.json({ message: "Device berhasil ditambahkan", data: user.device });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [PUT] /device/promote
exports.promoteDevice = async (req, res) => {
  try {
    const { deviceID } = req.body;
    const user = await Akun.findById(req.user.id);
    const device = user.device.find(d => d.deviceID === deviceID);

    if (!device) return res.status(404).json({ message: "Device tidak ditemukan" });
    device.type = "primary";
    user.deviceHistory.push({ deviceID, type: "primary", action: "promoted" });

    await user.save();
    res.json({ message: "Device berhasil dipromosikan", data: device });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [PUT] /device/demote
exports.demoteDevice = async (req, res) => {
  try {
    const { deviceID } = req.body;
    const user = await Akun.findById(req.user.id);
    const device = user.device.find(d => d.deviceID === deviceID);

    if (!device) return res.status(404).json({ message: "Device tidak ditemukan" });
    device.type = "secondary";
    user.deviceHistory.push({ deviceID, type: "secondary", action: "demoted" });

    await user.save();
    res.json({ message: "Device berhasil diturunkan", data: device });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [DELETE] /device/remove
exports.removeDevice = async (req, res) => {
  try {
    const { deviceID } = req.body;
    const user = await Akun.findById(req.user.id);
    user.device = user.device.filter(d => d.deviceID !== deviceID);
    user.deviceHistory.push({ deviceID, type: "secondary", action: "removed" });
    await user.save();
    res.json({ message: "Device berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======== Controller Riwayat Device ========

// [GET] /device-history
exports.getDeviceHistory = async (req, res) => {
  try {
    const user = await Akun.findById(req.user.id);
    res.json(user.deviceHistory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [POST] /device-history
exports.addDeviceHistory = async (req, res) => {
  try {
    const { deviceID, type, action } = req.body;
    const user = await Akun.findById(req.user.id);
    user.deviceHistory.push({ deviceID, type, action });
    await user.save();
    res.json({ message: "Riwayat device ditambahkan" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [DELETE] /device-history/:id
exports.deleteDeviceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Akun.findById(req.user.id);
    user.deviceHistory.splice(id, 1);
    await user.save();
    res.json({ message: "Riwayat device dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};