const Akun = require("../models/akunModel");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");
const {
  validateRegister,
  validateLogin,
} = require("../validators/akunValidator");
const createError = require("http-errors");

const AKUN_JWT_SECRET = process.env.AKUN_JWT_SECRET || "akun_secret";
const AKUN_REFRESH_SECRET =
  process.env.AKUN_REFRESH_SECRET || "akun_refresh_secret";

// CACHE KEYS
const KEY_PROFILE = (id) => `akun:profile:${id}`;
const KEY_ALL_USERS = "akun:all_users";

class AkunService {
  // --- GENERATOR TOKEN (UPDATED) ---
  generateTokens(user, device) {
    // Payload dasar (SELALU ADA)
    const payload = {
      id: user._id,
      role: user.role, // client / admin
      deviceID: device.deviceID,
      version: device.tokenVersion,
    };

    // 🔐 KONDISIONAL: hanya jika akun SUDAH terikat tenant
    if (user.tenantID && user.roleID) {
      payload.tenantID = user.tenantID;
      payload.roleID = user.roleID;
    }

    const accessToken = jwt.sign(payload, AKUN_JWT_SECRET, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign(
      {
        id: user._id,
        deviceID: device.deviceID,
        version: device.tokenVersion,
      },
      AKUN_REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    return { accessToken, refreshToken };
  }

  async clearCache(userId) {
    await redis.del(KEY_PROFILE(userId));
  }

  async register(payload) {
    const validation = validateRegister(payload);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    const existing = await Akun.findOne({ email: payload.email });
    if (existing) throw createError(409, "Email sudah terdaftar.");

    const newUser = await Akun.create(payload);
    await redis.del(KEY_ALL_USERS);

    return newUser;
  }

  async login(payload) {
    const validation = validateLogin(payload);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    const { email, password, deviceID, deviceType } = payload;

    const user = await Akun.findOne({ email });
    if (!user) throw createError(404, "Email tidak ditemukan");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw createError(400, "Password salah");

    // Logika Device Management
    let device = user.device.find((d) => d.deviceID === deviceID);
    let isNewDevice = false;

    // Token Version
    const newTokenVersion = Math.floor(1000 + Math.random() * 9000);

    if (device) {
      device.tokenVersion = newTokenVersion;
      device.lastUsed = new Date();
    } else {
      if (user.device.length >= user.maxDevice) {
        throw createError(
          403,
          "Kuota perangkat penuh. Hapus perangkat lama terlebih dahulu.",
        );
      }

      isNewDevice = true;
      const newDeviceObj = {
        deviceID,
        type:
          deviceType || (user.device.length === 0 ? "primary" : "secondary"),
        tokenVersion: newTokenVersion,
        lastUsed: new Date(),
      };

      user.device.push(newDeviceObj);
      user.deviceHistory.push({
        deviceID,
        type: newDeviceObj.type,
        action: "added",
      });

      device = user.device[user.device.length - 1];
    }

    user.markModified("device");
    if (isNewDevice) user.markModified("deviceHistory");

    await user.save();
    await this.clearCache(user._id);

    // Generate Token (Method ini sekarang sudah update payloadnya)
    const tokens = this.generateTokens(user, device);

    return {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      tenantID: user.tenantID, // Kirim juga ID mentah ke client
      roleID: user.roleID,
      currentDevice: device.deviceID,
      tokens,
      message: isNewDevice ? "Login berhasil (Device Baru)" : "Login berhasil",
    };
  }

  async refreshToken(token) {
    if (!token) throw createError(401, "Token tidak ditemukan");

    let payload;
    try {
      payload = jwt.verify(token, AKUN_REFRESH_SECRET);
    } catch (err) {
      throw createError(403, "Refresh Token tidak valid");
    }

    const user = await Akun.findById(payload.id);
    if (!user) throw createError(401, "User tidak ditemukan");

    const device = user.device.find((d) => d.deviceID === payload.deviceID);
    if (!device) throw createError(401, "Perangkat tidak terdaftar");

    if (device.tokenVersion !== payload.version || device.tokenVersion === 0) {
      throw createError(
        403,
        "Sesi kedaluwarsa (Token Reuse Detected). Silakan login ulang.",
      );
    }

    const newTokenVersion = Math.floor(1000 + Math.random() * 9000);
    device.tokenVersion = newTokenVersion;
    device.lastUsed = new Date();

    user.markModified("device");
    await user.save();
    await this.clearCache(user._id);

    return this.generateTokens(user, device);
  }

  async logout(token) {
    if (!token) return;
    try {
      const payload = jwt.verify(token, AKUN_REFRESH_SECRET);
      const user = await Akun.findById(payload.id);

      if (user) {
        const device = user.device.find((d) => d.deviceID === payload.deviceID);
        if (device) {
          device.tokenVersion = 0;
          device.lastUsed = new Date();

          user.markModified("device");
          await user.save();
          await this.clearCache(user._id);
        }
      }
    } catch (ignore) {}
  }

  async getProfile(userId) {
    const cached = await redis.get(KEY_PROFILE(userId));
    if (cached) return JSON.parse(cached);

    const user = await Akun.findById(userId)
      .select("-password -deviceHistory")
      .lean();
    if (!user) return null;

    await redis.set(KEY_PROFILE(userId), JSON.stringify(user), "EX", 300);
    return user;
  }

  async updateProfile(userId, payload) {
    const safePayload = {};
    if (payload.username) safePayload.username = payload.username;
    if (payload.email) safePayload.email = payload.email;
    if (payload.tenantID) safePayload.tenantID = payload.tenantID;

    const updated = await Akun.findByIdAndUpdate(userId, safePayload, {
      new: true,
    })
      .select("-password")
      .lean();

    await this.clearCache(userId);
    if (payload.email) await redis.del(KEY_ALL_USERS);

    return updated;
  }

  async getAllUsers() {
    const cached = await redis.get(KEY_ALL_USERS);
    if (cached) return JSON.parse(cached);

    const users = await Akun.find({})
      .select("-password -device -deviceHistory")
      .lean();

    await redis.set(KEY_ALL_USERS, JSON.stringify(users), "EX", 60);
    return users;
  }

  // --- REFACTORING: LOGIKA DELETE DIPINDAHKAN KESINI ---
  async deleteUserByAdmin(targetUserId, requesterId) {
    if (targetUserId === requesterId) {
      throw createError(400, "Tidak dapat menghapus akun sendiri.");
    }

    const deleted = await Akun.findByIdAndDelete(targetUserId);
    if (!deleted) throw createError(404, "User tidak ditemukan");

    await this.clearCache(targetUserId);
    await redis.del(KEY_ALL_USERS);

    return true;
  }
}

module.exports = new AkunService();
