const Akun = require("../models/akunModel");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");
const { validateRegister, validateLogin } = require("../validators/akunValidator");
const createError = require("http-errors");

const JWT_SECRET = process.env.JWT_SECRET || "secret_key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret_key";

// CACHE KEYS
const KEY_PROFILE = (id) => `akun:profile:${id}`;
const KEY_ALL_USERS = "akun:all_users";

class AkunService {
  
  // HELPERS
  generateTokens(user, device) {
    const accessToken = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign(
      { id: user._id, deviceID: device.deviceID, version: device.tokenVersion },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );
    return { accessToken, refreshToken };
  }

  async clearCache(userId) {
    await redis.del(KEY_PROFILE(userId));
  }

  // AUTH LOGIC
  async register(payload) {
    const validation = validateRegister(payload);
    if (!validation.valid) return { error: validation.errors };

    const existing = await Akun.findOne({ email: payload.email });
    if (existing) return { error: ["Email sudah digunakan"] };

    const newUser = await Akun.create(payload);
    await redis.del(KEY_ALL_USERS); // Admin list update

    return newUser;
  }

  async login(payload) {
    // Validasi
    const validation = validateLogin(payload);
    if (!validation.valid) return { error: validation.errors };

    const { email, password, deviceID } = payload;

    // Cek User
    const user = await Akun.findOne({ email });
    if (!user) throw createError(404, "Email tidak ditemukan");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw createError(400, "Password salah");

    // Logika Device (Complex Logic)
    let device = user.device.find(d => d.deviceID === deviceID);
    let isNewDevice = false;

    if (device) {
      // Device Lama: Rotate token version
      device.tokenVersion = Math.floor(1000 + Math.random() * 9000);
      device.lastUsed = new Date();
    } else {
      // Device Baru: Cek Kuota
      if (user.device.length >= user.maxDevice) {
        throw createError(403, "Kuota perangkat penuh. Hapus perangkat lama terlebih dahulu.");
      }

      isNewDevice = true;
      const newDevice = {
        deviceID,
        type: user.device.length === 0 ? "primary" : "secondary",
        tokenVersion: Math.floor(1000 + Math.random() * 9000),
        lastUsed: new Date()
      };
      
      user.device.push(newDevice);
      user.deviceHistory.push({ deviceID, type: newDevice.type, action: "added" });
      
      // Re-assign variable 'device' agar bisa dipakai di bawah
      device = newDevice; 
    }

    user.markModified("device");
    if (isNewDevice) user.markModified("deviceHistory");
    
    await user.save();
    await this.clearCache(user._id);

    // Generate Token
    const tokens = this.generateTokens(user, device);

    return { 
      user: user.toJSON(), 
      tokens, 
      message: isNewDevice ? "Login berhasil (Device Baru)" : "Login berhasil" 
    };
  }

  async refreshToken(token) {
    if (!token) throw createError(401, "No token provided");

    let payload;
    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      throw createError(403, "Invalid Refresh Token");
    }

    const user = await Akun.findById(payload.id);
    if (!user) throw createError(401, "User not found");

    const device = user.device.find(d => d.deviceID === payload.deviceID);
    if (!device) throw createError(401, "Device not registered");

    if (device.tokenVersion !== payload.version || device.tokenVersion === 0) {
      throw createError(401, "Session Expired / Invalidated");
    }

    // Rotate Version
    device.tokenVersion = Math.floor(1000 + Math.random() * 9000);
    device.lastUsed = new Date();
    user.markModified("device");
    await user.save();
    await this.clearCache(user._id);

    return this.generateTokens(user, device);
  }

  async logout(token) {
    if (!token) return;
    try {
      const payload = jwt.verify(token, JWT_REFRESH_SECRET);
      const user = await Akun.findById(payload.id);
      if (user) {
        const device = user.device.find(d => d.deviceID === payload.deviceID);
        if (device) {
          device.tokenVersion = 0; // Invalidate
          user.markModified("device");
          await user.save();
          await this.clearCache(user._id);
        }
      }
    } catch (ignore) {}
  }

  // PROFILE LOGIC
  async getProfile(userId) {
    const cached = await redis.get(KEY_PROFILE(userId));
    if (cached) return JSON.parse(cached);

    const user = await Akun.findById(userId).select("-password").lean();
    if (!user) return null;

    await redis.set(KEY_PROFILE(userId), JSON.stringify(user), "EX", 300);
    return user;
  }

  async updateProfile(userId, payload) {
    // Whitelisting di service layer
    const safePayload = {};
    if (payload.username) safePayload.username = payload.username;
    if (payload.email) safePayload.email = payload.email;
    if (payload.tenantID) safePayload.tenantID = payload.tenantID;

    const updated = await Akun.findByIdAndUpdate(userId, safePayload, { new: true }).lean();
    
    await this.clearCache(userId);
    // Jika email berubah, cache admin list mungkin basi
    if (payload.email) await redis.del(KEY_ALL_USERS);

    return updated;
  }

  // Admin Only
  async getAllUsers() {
    const cached = await redis.get(KEY_ALL_USERS);
    if (cached) return JSON.parse(cached);

    const users = await Akun.find({}).select("-password").lean();
    
    await redis.set(KEY_ALL_USERS, JSON.stringify(users), "EX", 60);
    return users;
  }
}

module.exports = new AkunService();