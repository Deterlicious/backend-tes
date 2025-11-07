require("dotenv").config();

const Akun = require("../models/akunModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Konfigurasi JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "secret_key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret_key";

// ======== Token ========
const createAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: "15m",
  });
};

// DIMODIFIKASI: Membutuhkan 'device' untuk menyertakan deviceID dan tokenVersion-nya
const createRefreshToken = (user, device) => {
  return jwt.sign(
    { id: user._id, deviceID: device.deviceID, version: device.tokenVersion },
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
    // Catatan: User harus menambahkan device terlebih dahulu via endpoint /device/add
    // sebelum bisa login dengan device tersebut.
    await newUser.save();

    res.status(201).json({ message: "Registrasi berhasil", data: newUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [POST] /auth/login
// DIMODIFIKASI: Sekarang membutuhkan deviceID untuk login
exports.login = async (req, res) => {
  try {
    const { email, password, deviceID } = req.body;

    if (!deviceID) {
      return res.status(400).json({ message: "deviceID wajib diisi" });
    }

    const user = await Akun.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email tidak ditemukan" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Password salah" });

    const device = user.device.find(d => d.deviceID === deviceID);
    if (!device) {
      return res.status(404).json({ message: "Device ini tidak terdaftar di akun Anda." });
    }

    const randomTokenVersion = Math.floor(1000 + Math.random() * 9000);
    device.tokenVersion = randomTokenVersion;
    user.markModified("device");
    await user.save();

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user, device);

    // **Tetap kirim refresh token via cookie**
    sendRefreshToken(res, refreshToken);

    // **Tambahan dari program teman kamu (KIRIM JUGA di JSON)**
    return res.json({
      message: "Login berhasil",
      accessToken,
      refreshToken,
      data: user.toJSON()
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [POST] /auth/refreshtoken
// DIMODIFIKASI: Logika verifikasi diubah total
exports.refreshToken = async (req, res) => {
  // **Tambahan dari teman kamu → refresh token diterima dari JSON juga**
  const token = req.cookies.refreshToken || req.body.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "Akses ditolak. Tidak ada refresh token." });
  }

  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET);

    const user = await Akun.findById(payload.id);
    if (!user) return res.status(401).json({ message: "User tidak ditemukan." });

    const device = user.device.find(d => d.deviceID === payload.deviceID);
    if (!device) {
      return res.status(401).json({ message: "Device tidak terdaftar." });
    }

    if (device.tokenVersion === 0 || device.tokenVersion !== payload.version) {
      sendRefreshToken(res, "");
      return res.status(401).json({ message: "Sesi tidak valid. Silakan login kembali." });
    }

    const newRandomTokenVersion = Math.floor(1000 + Math.random() * 9000);
    device.tokenVersion = newRandomTokenVersion;
    user.markModified("device");
    await user.save();

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user, device);

    // **Tetap kirim via cookie**
    sendRefreshToken(res, newRefreshToken);

    // **Tambahan dari teman kamu → kirim juga via JSON**
    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });

  } catch (err) {
    return res.status(403).json({ message: "Refresh token tidak valid.", error: err.message });
  }
};

// [POST] /auth/logout
// DIMODIFIKASI: Mengatur tokenVersion device menjadi 0
exports.logout = async (req, res) => {
  try {
    // [PERBAIKAN] Baca dari kedua sumber, sama seperti refreshToken
    const token = req.cookies.refreshToken || req.body.refreshToken;

    if (token) {
      try {
        const payload = jwt.verify(token, JWT_REFRESH_SECRET);
        const user = await Akun.findById(payload.id);
        if (user) {
          const device = user.device.find(d => d.deviceID === payload.deviceID);
          if (device) {
            device.tokenVersion = 0;
            user.markModified('device');
            await user.save();
          }
        }
      } catch (err) {
        // Token tidak valid atau kedaluwarsa, abaikan
      }
    }

    // [PERBAIKAN] Hapus cookie (untuk klien web)
    res.cookie("refreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/akun/auth",
      expires: new Date(0),
    });

    // [PERBAIKAN] Kirim respons JSON (untuk semua klien)
    res.json({ message: "Logout berhasil" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [POST] /auth/logoutall
// DIMODIFIKASI: Mengatur SEMUA tokenVersion device menjadi 0
exports.logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.id; // Ini didapat dari Access Token, jadi aman
    const user = await Akun.findById(userId);

    if (user && user.device) {
      user.device.forEach(device => {
        device.tokenVersion = 0;
      });
      user.markModified('device');
      await user.save();
    }

    // [PERBAIKAN] Tetap hapus cookie, untuk klien web
    res.cookie("refreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/akun/auth",
      expires: new Date(0),
    });

    res.json({ message: "Berhasil logout dari semua perangkat." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [GET] /auth/akun
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

// [PUT] /auth/akun
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const updates = req.body;
    // Mencegah 'device' diupdate manual lewat endpoint ini
    if (updates.device) delete updates.device;
    const updated = await Akun.findByIdAndUpdate(userId, updates, { new: true });
    res.json({ message: "Akun diperbarui", data: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [DELETE] /auth/akun
exports.deleteProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    await Akun.findByIdAndDelete(userId);
    res.json({ message: "Akun berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======== Controller Khusus Admin ========
// [GET] /admin/all
exports.getAllAkun = async (req, res) => {
  try {
    // Ambil semua akun dari database
    // Gunakan .select('-password') untuk alasan keamanan,
    // agar password hash tidak ikut terkirim
    const users = await Akun.find({}).select("-password");

    res.json({
      message: "Berhasil mengambil semua akun",
      total: users.length,
      data: users
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======== Controller Manajemen Device ========
// [GET] /device
exports.getDevice = async (req, res) => {
  try {
    const user = await Akun.findById(req.user.id);
    res.json(user.device);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [GET] /device/check/:deviceId
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

// [POST] /device/add
exports.addDevice = async (req, res) => {
  try {
    const { deviceID, type } = req.body;
    const user = await Akun.findById(req.user.id);

    if (user.device.length >= user.maxDevice)
      return res.status(400).json({ message: "Jumlah device maksimal sudah tercapai" });

    // Cek jika deviceID sudah ada
    if (user.device.some(d => d.deviceID === deviceID)) {
      return res.status(400).json({ message: "DeviceID sudah terdaftar." });
    }

    // Menambahkan device baru (tokenVersion akan default 0)
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
    const device = user.device.find(d => d.deviceID === deviceID);
    if (!device) return res.status(404).json({ message: "Device tidak ditemukan" });

    // Ambil tipe device sebelum dihapus untuk history
    const deviceType = device.type || "secondary";

    user.device = user.device.filter(d => d.deviceID !== deviceID);
    user.deviceHistory.push({ deviceID, type: deviceType, action: "removed" });
    await user.save();
    res.json({ message: "Device berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======== Controller Riwayat Device ========
// (Tidak ada perubahan di bagian ini)

// [GET] /devicehistory
exports.getDeviceHistory = async (req, res) => {
  try {
    const user = await Akun.findById(req.user.id);
    res.json(user.deviceHistory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [POST] /devicehistory
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

// [DELETE] /devicehistory/:id
exports.deleteDeviceHistory = async (req, res) => {
  try {
    const { id } = req.params; // Asumsi 'id' adalah index, ini kurang ideal
    const user = await Akun.findById(req.user.id);
    user.deviceHistory.splice(id, 1);
    await user.save();
    res.json({ message: "Riwayat device dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};