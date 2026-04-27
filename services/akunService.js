const Akun = require("../models/akunModel");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");
const { validateRegister, validateLogin } = require("../validators/akunValidator");
const createError = require("http-errors");

const AKUN_JWT_SECRET = process.env.AKUN_JWT_SECRET || "akun_secret";
const AKUN_REFRESH_SECRET = process.env.AKUN_REFRESH_SECRET || "akun_refresh_secret";

const KEY_PROFILE = (id) => `akun:profile:${id}`;
const KEY_ALL_USERS = "akun:all_users";

class AkunService {

  // Generate token JWT — tidak lagi butuh device, tokenVersion di level Akun
  generateTokens(user) {
    const payload = {
      id: user._id,
      role: user.role,
      version: user.tokenVersion,
    };

    // Tambahkan tenantID ke token hanya jika akun sudah terikat dengan toko
    if (user.tenantID) {
      payload.tenantID = user.tenantID;
    }

    const accessToken = jwt.sign(payload, AKUN_JWT_SECRET, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign(
      {
        id: user._id,
        version: user.tokenVersion,
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

    const { email, password } = payload;

    const user = await Akun.findOne({ email });
    if (!user) throw createError(404, "Email tidak ditemukan.");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw createError(400, "Password salah.");

    // Update tokenVersion setiap login untuk invalidasi token lama
    user.tokenVersion = Date.now();
    await user.save();
    await this.clearCache(user._id);

    const tokens = this.generateTokens(user);

    return {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      tenantID: user.tenantID,
      tokens,
      message: "Login berhasil.",
    };
  }

  async refreshToken(token) {
    if (!token) throw createError(401, "Refresh token tidak ditemukan.");

    let payload;
    try {
      payload = jwt.verify(token, AKUN_REFRESH_SECRET);
    } catch (err) {
      throw createError(403, "Refresh token tidak valid atau kedaluwarsa.");
    }

    const user = await Akun.findById(payload.id);
    if (!user) throw createError(401, "Pengguna tidak ditemukan.");

    // Validasi tokenVersion
    if (user.tokenVersion !== payload.version || user.tokenVersion === 0) {
      throw createError(403, "Sesi kedaluwarsa. Silakan login ulang.");
    }

    // Rotate tokenVersion setiap refresh
    user.tokenVersion = Date.now();
    await user.save();
    await this.clearCache(user._id);

    return this.generateTokens(user);
  }

  async logout(token) {
    if (!token) return;
    try {
      const payload = jwt.verify(token, AKUN_REFRESH_SECRET);
      const user = await Akun.findById(payload.id);

      if (user) {
        // Set tokenVersion ke 0 untuk invalidasi semua sesi
        user.tokenVersion = 0;
        await user.save();
        await this.clearCache(user._id);
      }
    } catch (ignore) {}
  }

  async getProfile(userId) {
    const cached = await redis.get(KEY_PROFILE(userId));
    if (cached) return JSON.parse(cached);

    const user = await Akun.findById(userId)
      .select("-password")
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
      .select("-password")
      .lean();

    await redis.set(KEY_ALL_USERS, JSON.stringify(users), "EX", 60);
    return users;
  }

  async deleteUserByAdmin(targetUserId, requesterId) {
    if (targetUserId === requesterId) {
      throw createError(400, "Tidak dapat menghapus akun Anda sendiri.");
    }

    const deleted = await Akun.findByIdAndDelete(targetUserId);
    if (!deleted) throw createError(404, "Pengguna tidak ditemukan.");

    await this.clearCache(targetUserId);
    await redis.del(KEY_ALL_USERS);

    return true;
  }
}

module.exports = new AkunService();