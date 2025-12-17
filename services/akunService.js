const Akun = require("../models/akunModel");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");
const { validateRegister, validateLogin } = require("../validators/akunValidator");
const createError = require("http-errors");

// PENTING: Gunakan variable yang SAMA dengan authAkun.js
const AKUN_JWT_SECRET = process.env.AKUN_JWT_SECRET || "akun_secret";
const AKUN_REFRESH_SECRET = process.env.AKUN_REFRESH_SECRET || "akun_refresh_secret";

// CACHE KEYS
const KEY_PROFILE = (id) => `akun:profile:${id}`;
const KEY_ALL_USERS = "akun:all_users";

class AkunService {

  // Generator Token yang Sesuai dengan Middleware authAkun
  
  generateTokens(user, device) {
    // ACCESS TOKEN (Dipakai di Authorization Header)
    // Payload HARUS mengandung deviceID dan version agar lolos di authAkun
    const accessToken = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        deviceID: device.deviceID, // <--- WAJIB ADA (Kunci Fix)
        version: device.tokenVersion // <--- WAJIB ADA (Kunci Fix)
      }, 
      AKUN_JWT_SECRET, 
      { expiresIn: "15m" } // Access Token pendek (Security Best Practice)
    );

    // REFRESH TOKEN (Disimpan di Cookie)
    const refreshToken = jwt.sign(
      { 
        id: user._id, 
        deviceID: device.deviceID, 
        version: device.tokenVersion 
      },
      AKUN_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    return { accessToken, refreshToken };
  }

  async clearCache(userId) {
    await redis.del(KEY_PROFILE(userId));
  }

  async register(payload) {
    const validation = validateRegister(payload);
    if (!validation.valid) return { error: validation.errors };

    const existing = await Akun.findOne({ email: payload.email });
    if (existing) return { error: ["Email sudah digunakan"] };

    const newUser = await Akun.create(payload);
    await redis.del(KEY_ALL_USERS); 

    return newUser;
  }

  async login(payload) {
    // Validasi Input
    const validation = validateLogin(payload);
    if (!validation.valid) return { error: validation.errors };

    const { email, password, deviceID, deviceType } = payload;

    // Cek User & Password
    const user = await Akun.findOne({ email });
    if (!user) throw createError(404, "Email tidak ditemukan");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw createError(400, "Password salah");

    // Logika Device Management
    let device = user.device.find(d => d.deviceID === deviceID);
    let isNewDevice = false;

    // Generate Token Version Baru (Acak)
    const newTokenVersion = Math.floor(1000 + Math.random() * 9000);

    if (device) {
      // Device Lama: Update versi token & last used
      device.tokenVersion = newTokenVersion;
      device.lastUsed = new Date();
    } else {
      // Device Baru: Cek Kuota
      if (user.device.length >= user.maxDevice) {
        throw createError(403, "Kuota perangkat penuh. Hapus perangkat lama terlebih dahulu.");
      }

      isNewDevice = true;
      const newDeviceObj = {
        deviceID,
        type: deviceType || (user.device.length === 0 ? "primary" : "secondary"),
        tokenVersion: newTokenVersion,
        lastUsed: new Date()
      };
      
      user.device.push(newDeviceObj);
      user.deviceHistory.push({ deviceID, type: newDeviceObj.type, action: "added" });
      
      // Ambil referensi object yang baru dipush agar bisa dipakai generateTokens
      device = user.device[user.device.length - 1]; 
    }

    // Mark Modified karena kita mengubah isi array
    user.markModified("device");
    if (isNewDevice) user.markModified("deviceHistory");
    
    await user.save();
    await this.clearCache(user._id);

    // Generate Token (Pass object 'device' yang sudah punya version baru)
    const tokens = this.generateTokens(user, device);

    // Filter return user data (jangan kirim password/history)
    const userResponse = {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        tenantID: user.tenantID,
        currentDevice: device.deviceID
    };

    return { 
      user: userResponse, 
      tokens, 
      message: isNewDevice ? "Login berhasil (Device Baru)" : "Login berhasil" 
    };
  }

  async refreshToken(token) {
    if (!token) throw createError(401, "Token tidak ditemukan");

    let payload;
    try {
      // Verifikasi signature Refresh Token
      payload = jwt.verify(token, AKUN_REFRESH_SECRET);
    } catch (err) {
      throw createError(403, "Refresh Token tidak valid");
    }

    const user = await Akun.findById(payload.id);
    if (!user) throw createError(401, "User tidak ditemukan");

    // Cari device berdasarkan payload token lama
    const device = user.device.find(d => d.deviceID === payload.deviceID);
    if (!device) throw createError(401, "Perangkat tidak terdaftar");

    // Cek apakah versi token masih cocok (Token Rotation Check)
    // Jika tokenVersion di DB sudah berubah (misal karena login ulang atau logout), tolak.
    if (device.tokenVersion !== payload.version || device.tokenVersion === 0) {
      throw createError(403, "Sesi kedaluwarsa (Token Reuse Detected). Silakan login ulang.");
    }

    // ROTASI TOKEN: Ganti version setiap kali refresh (Keamanan Tinggi)
    const newTokenVersion = Math.floor(1000 + Math.random() * 9000);
    device.tokenVersion = newTokenVersion;
    device.lastUsed = new Date();
    
    user.markModified("device");
    await user.save();
    await this.clearCache(user._id);

    // Generate Token Baru dengan Version Baru
    return this.generateTokens(user, device);
  }

  async logout(token) {
    if (!token) return;
    try {
      const payload = jwt.verify(token, AKUN_REFRESH_SECRET);
      const user = await Akun.findById(payload.id);
      
      if (user) {
        const device = user.device.find(d => d.deviceID === payload.deviceID);
        if (device) {
          device.tokenVersion = 0; // Set 0 agar token lama invalid
          device.lastUsed = new Date();
          
          user.markModified("device");
          await user.save();
          await this.clearCache(user._id);
        }
      }
    } catch (ignore) {
      // Jika token malformed saat logout, abaikan saja
    }
  }

  async getProfile(userId) {
    const cached = await redis.get(KEY_PROFILE(userId));
    if (cached) return JSON.parse(cached);

    // Lean queries lebih cepat untuk read-only
    const user = await Akun.findById(userId).select("-password -deviceHistory").lean();
    if (!user) return null;

    // Cache selama 5 menit
    await redis.set(KEY_PROFILE(userId), JSON.stringify(user), "EX", 300);
    return user;
  }

  async updateProfile(userId, payload) {
    // Whitelisting field yang boleh diupdate
    const safePayload = {};
    if (payload.username) safePayload.username = payload.username;
    // Email update mungkin butuh verifikasi ulang, tapi kita allow dulu
    if (payload.email) safePayload.email = payload.email;
    
    // Hanya update tenantID jika belum ada (atau logic bisnis khusus)
    if (payload.tenantID) safePayload.tenantID = payload.tenantID;

    const updated = await Akun.findByIdAndUpdate(userId, safePayload, { new: true }).select("-password").lean();
    
    await this.clearCache(userId);
    if (payload.email) await redis.del(KEY_ALL_USERS);

    return updated;
  }

  // Admin Only
  async getAllUsers() {
    const cached = await redis.get(KEY_ALL_USERS);
    if (cached) return JSON.parse(cached);

    const users = await Akun.find({}).select("-password -device -deviceHistory").lean();
    
    await redis.set(KEY_ALL_USERS, JSON.stringify(users), "EX", 60);
    return users;
  }
}

module.exports = new AkunService();