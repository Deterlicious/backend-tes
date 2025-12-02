require("dotenv").config();

const Akun = require("../models/akunModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
// Pastikan path redisClient sesuai dengan file utils Anda
const redis = require("../utils/redisClient"); 

// Konfigurasi JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "secret_key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret_key";

// --- Helper: Cache Keys & Validator ---
const keyProfile = (id) => `akun:profile:${id}`;
const keyAllAkun = "akun:all_users";

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// ======== Token ========
const createAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: "15m",
  });
};

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

    // 1. Validasi Input
    if (!email || !password) return res.status(400).json({ message: "Email dan password wajib diisi" });
    if (!isValidEmail(email)) return res.status(400).json({ message: "Format email tidak valid" });
    if (password.length < 6) return res.status(400).json({ message: "Password minimal 6 karakter" });

    const existingUser = await Akun.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email sudah digunakan" });

    const newUser = new Akun({ username, email, password, role });
    await newUser.save();

    // 2. Invalidate Cache Admin (karena jumlah user bertambah)
    await redis.del(keyAllAkun);

    res.status(201).json({ message: "Registrasi berhasil", data: newUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [POST] /auth/login
exports.login = async (req, res) => {
  try {
    const { email, password, deviceID } = req.body;

    // 1. Validasi input dasar
    if (!deviceID) return res.status(400).json({ message: "deviceID wajib diisi" });
    if (!email || !password) return res.status(400).json({ message: "Email dan password wajib diisi" });

    const user = await Akun.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email tidak ditemukan" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Password salah" });

    // 2. Cari device yang ada
    let device = user.device.find(d => d.deviceID === deviceID);

    if (device) {
      // --- ALUR 1: DEVICE SUDAH TERDAFTAR ---
      const randomTokenVersion = Math.floor(1000 + Math.random() * 9000);
      device.tokenVersion = randomTokenVersion;
      user.markModified("device");
      await user.save();

      // Invalidate cache profile user ini karena data berubah
      await redis.del(keyProfile(user._id));

      const accessToken = createAccessToken(user);
      const refreshToken = createRefreshToken(user, device);

      sendRefreshToken(res, refreshToken);

      return res.json({
        message: "Login berhasil",
        accessToken,
        refreshToken,
        data: user.toJSON()
      });

    } else {
      // --- ALUR 2: DEVICE BARU ---
      // 3. Cek kuota device
      if (user.device.length >= user.maxDevice) {
        return res.status(403).json({
          message: "Login gagal. Jumlah perangkat maksimal telah tercapai."
        });
      }

      // 4. Kuota aman, buat dan tambahkan device baru
      const newDevice = {
        deviceID: deviceID,
        type: user.device.length === 0 ? "primary" : "secondary",
        tokenVersion: Math.floor(1000 + Math.random() * 9000),
        lastUsed: new Date()
      };

      user.device.push(newDevice);

      user.deviceHistory.push({
        deviceID: deviceID,
        type: newDevice.type,
        action: "added"
      });

      user.markModified("device");
      user.markModified("deviceHistory");

      await user.save();

      // Invalidate cache profile user ini
      await redis.del(keyProfile(user._id));

      // 5. Buat token untuk device yang BARU
      const accessToken = createAccessToken(user);
      const refreshToken = createRefreshToken(user, newDevice);

      sendRefreshToken(res, refreshToken);

      return res.json({
        message: "Login berhasil. Perangkat baru telah ditambahkan.",
        accessToken,
        refreshToken,
        data: user.toJSON()
      });
    }

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
};

// [POST] /auth/refreshtoken
exports.refreshToken = async (req, res) => {
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
    
    // Invalidate Cache
    await redis.del(keyProfile(user._id));

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user, device);

    sendRefreshToken(res, newRefreshToken);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });

  } catch (err) {
    return res.status(403).json({ message: "Refresh token tidak valid.", error: err.message });
  }
};

// [POST] /auth/logout
exports.logout = async (req, res) => {
  try {
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
            // Invalidate Cache
            await redis.del(keyProfile(user._id));
          }
        }
      } catch (err) {
        // Token tidak valid atau kedaluwarsa, abaikan
      }
    }

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

// [POST] /auth/logoutall
exports.logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Akun.findById(userId);

    if (user && user.device) {
      user.device.forEach(device => {
        device.tokenVersion = 0;
      });
      user.markModified('device');
      await user.save();
      // Invalidate Cache
      await redis.del(keyProfile(userId));
    }

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

    // 1. Cek Redis Cache
    const cachedProfile = await redis.get(keyProfile(userId));
    if (cachedProfile) {
      return res.json(JSON.parse(cachedProfile));
    }

    // 2. Ambil DB jika cache miss
    const user = await Akun.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "Akun tidak ditemukan" });

    // 3. Simpan ke Redis (Expire 5 menit)
    await redis.setEx(keyProfile(userId), 300, JSON.stringify(user));

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [PUT] /auth/akun
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // 1. Validasi Field (Whitelist) - Mencegah update field berbahaya
    const allowedUpdates = ["username", "email", "tenantID"];
    const updates = {};
    Object.keys(req.body).forEach(key => {
        if(allowedUpdates.includes(key)) updates[key] = req.body[key];
    });

    if(Object.keys(updates).length === 0) {
        return res.status(400).json({message: "Tidak ada data valid untuk diupdate"});
    }

    const updated = await Akun.findByIdAndUpdate(userId, updates, { new: true });
    
    // 2. Invalidate Cache
    await redis.del(keyProfile(userId));
    await redis.del(keyAllAkun); // Invalidate admin list jika ada perubahan info user

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
    
    // Invalidate Cache
    await redis.del(keyProfile(userId));
    await redis.del(keyAllAkun);

    res.json({ message: "Akun berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======== Controller Khusus Admin ========
// [GET] /admin/all
exports.getAllAkun = async (req, res) => {
  try {
    // 1. Cek Redis Cache
    const cachedUsers = await redis.get(keyAllAkun);
    if(cachedUsers) {
        return res.json(JSON.parse(cachedUsers));
    }

    const users = await Akun.find({}).select("-password");

    // 2. Simpan Cache (60 detik)
    await redis.setEx(keyAllAkun, 60, JSON.stringify({
        message: "Berhasil mengambil semua akun (Cached)",
        total: users.length,
        data: users
    }));

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
    // Kita ambil data fresh dari DB untuk manajemen device yang akurat
    const user = await Akun.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
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
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
    
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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Akses ditolak. Token tidak valid atau tidak ada." });
    }

    const { deviceID, type } = req.body;
    if (!deviceID) {
      return res.status(400).json({ message: "deviceID wajib diisi." });
    }

    const user = await Akun.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    if (user.device.length >= user.maxDevice) {
      return res.status(400).json({ message: "Jumlah device maksimal sudah tercapai" });
    }

    if (user.device.some(d => d.deviceID === deviceID)) {
      return res.status(409).json({ message: "DeviceID ini sudah terdaftar." });
    }

    let deviceType = "secondary";
    if (user.device.length === 0) {
      deviceType = "primary";
    } else if (type === "primary" || type === "secondary") {
      deviceType = type;
    }

    const newDevice = {
      deviceID: deviceID,
      type: deviceType,
      tokenVersion: 0, 
      lastUsed: new Date() 
    };

    user.device.push(newDevice);
    user.deviceHistory.push({
      deviceID: deviceID,
      type: deviceType,
      action: "added"
    });

    user.markModified('device');
    user.markModified('deviceHistory');

    await user.save();

    // Invalidate Cache Profile
    await redis.del(keyProfile(userId));

    res.status(201).json({
      message: "Device berhasil ditambahkan",
      data: user.device
    });

  } catch (err) {
    console.error("Error adding device:", err);
    res.status(500).json({ message: err.message });
  }
};

// [PUT] /device/promote
exports.promoteDevice = async (req, res) => {
  try {
    const { deviceID } = req.body;
    if (!deviceID) return res.status(400).json({ message: "deviceID wajib diisi" });

    const user = await Akun.findById(req.user.id);
    const device = user.device.find(d => d.deviceID === deviceID);

    if (!device) return res.status(404).json({ message: "Device tidak ditemukan" });
    device.type = "primary";
    user.deviceHistory.push({ deviceID, type: "primary", action: "promoted" });

    await user.save();
    
    // Invalidate Cache
    await redis.del(keyProfile(req.user.id));

    res.json({ message: "Device berhasil dipromosikan", data: device });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [PUT] /device/demote
exports.demoteDevice = async (req, res) => {
  try {
    const { deviceID } = req.body;
    if (!deviceID) return res.status(400).json({ message: "deviceID wajib diisi" });

    const user = await Akun.findById(req.user.id);
    const device = user.device.find(d => d.deviceID === deviceID);

    if (!device) return res.status(404).json({ message: "Device tidak ditemukan" });
    device.type = "secondary";
    user.deviceHistory.push({ deviceID, type: "secondary", action: "demoted" });

    await user.save();
    
    // Invalidate Cache
    await redis.del(keyProfile(req.user.id));

    res.json({ message: "Device berhasil diturunkan", data: device });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [DELETE] /device/remove
exports.removeDevice = async (req, res) => {
  try {
    const { deviceID } = req.body;
    if (!deviceID) return res.status(400).json({ message: "deviceID wajib diisi" });

    const user = await Akun.findById(req.user.id);
    const deviceIndex = user.device.findIndex(d => d.deviceID === deviceID);
    if (deviceIndex === -1) return res.status(404).json({ message: "Device tidak ditemukan" });

    const deviceType = user.device[deviceIndex].type;

    user.device.splice(deviceIndex, 1);
    user.deviceHistory.push({ deviceID, type: deviceType, action: "removed" });
    await user.save();
    
    // Invalidate Cache
    await redis.del(keyProfile(req.user.id));

    res.json({ message: "Device berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======== Controller Riwayat Device ========

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
    // Validasi basic
    if(!deviceID || !type || !action) return res.status(400).json({message: "Data tidak lengkap"});

    const user = await Akun.findById(req.user.id);
    user.deviceHistory.push({ deviceID, type, action });
    await user.save();
    
    // Invalidate karena history bagian dari profile
    await redis.del(keyProfile(req.user.id));
    
    res.json({ message: "Riwayat device ditambahkan" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [DELETE] /devicehistory/:id
exports.deleteDeviceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Akun.findById(req.user.id);
    
    if (id < 0 || id >= user.deviceHistory.length) {
        return res.status(400).json({ message: "Index history tidak valid" });
    }

    user.deviceHistory.splice(id, 1);
    await user.save();
    
    // Invalidate
    await redis.del(keyProfile(req.user.id));

    res.json({ message: "Riwayat device dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};