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

    // 1. Buat instance secara eksplisit
    // Masukkan username: null jika tidak ada di payload agar konsisten muncul di JSON
    const newUser = new Akun({
      email: payload.email,
      password: payload.password,
      username: payload.username || null,
      role: payload.role || "client",
      tenantID: payload.tenantID || null,
    });

    await newUser.save();
    await redis.del(KEY_ALL_USERS);

    // 2. TRANSFORMASI & PEMBERSIHAN (CRITICAL)
    // Gunakan minimize: false agar username: null tetap terlihat di result
    const result = newUser.toObject({ minimize: false });

    // Hapus data sensitif dan internal sebelum dikembalikan ke controller
    delete result.password;
    delete result.__v;

    return result;
  }

  async login(payload) {
    const validation = validateLogin(payload);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    const { email, password } = payload;

    const user = await Akun.findOne({ email });
    if (!user) throw createError(404, "Email tidak ditemukan.");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw createError(400, "Password salah.");

    user.tokenVersion = Date.now();
    await user.save();
    await this.clearCache(user._id);

    const tokens = this.generateTokens(user);

    // KONSISTENSI: Gunakan minimize: false agar username: null muncul
    const userObj = user.toObject({ minimize: false });
    delete userObj.password;
    delete userObj.__v;

    // EVALUASI DINAMIS: Mengecek eksistensi tenantID secara langsung
    const hasTenant =
      userObj.tenantID !== null && userObj.tenantID !== undefined;

    // Pastikan struktur return ini datar (flat) untuk accessToken & refreshToken
    return {
      user: userObj,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      needsSetup: !hasTenant, // Jika hasTenant false, needsSetup menjadi true
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

  // perbaikan: Menambah parameter accessToken dari controller
  async logout(token, accessToken) {
    // 1. Logika Invalidasi Refresh Token (Tetap dipertahankan)
    if (token) {
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

    // 2. perbaikan: Logika Redis Blacklist khusus untuk Access Token
    if (accessToken) {
      try {
        const decodedAccess = jwt.verify(accessToken, AKUN_JWT_SECRET);

        // Hitung sisa waktu token dalam detik (exp - waktu sekarang)
        const timeRemaining = decodedAccess.exp - Math.floor(Date.now() / 1000);

        // Jika token masih memiliki sisa waktu, masukkan ke blacklist
        if (timeRemaining > 0) {
          // Key di redis akan menggunakan prefix 'bl_' (blacklist)
          await redis.set(
            `bl_${accessToken}`,
            "blacklisted",
            "EX",
            timeRemaining,
          );
        }
      } catch (ignore) {
        // Blok catch kosong dipertahankan agar jika token sudah kedaluwarsa
        // secara alami, API tidak crash dan tetap melanjutkan proses penghapusan cookie.
      }
    }
  }

  async getProfile(tenantID) {
    // Cari akun via tenantID untuk dapat akunID
    const akun = await Akun.findOne({ tenantID }).select("-password").lean();
    if (!akun) throw createError(404, "Akun tidak ditemukan."); // ✅ throw, bukan return null

    // Cache tetap pakai akunID → konsisten dengan clearCache()
    const cached = await redis.get(KEY_PROFILE(akun._id));
    if (cached) return JSON.parse(cached);

    await redis.set(KEY_PROFILE(akun._id), JSON.stringify(akun), "EX", 300);
    return akun;
  }

  // perbaikan: Menggunakan findOne dan .save() agar middleware Mongoose untuk hashing password aktif
  async updateProfile(tenantID, payload) {
    // FIX 1: Menggunakan findOne untuk pencarian berdasarkan kolom custom, bukan findById
    const user = await Akun.findOne({ tenantID });

    if (!user) {
      throw createError(404, "Akun tidak ditemukan.");
    }

    // perbaikan: Logika ganti password yang mengunci pergerakan tanpa password lama
    if (payload.password) {
      if (!payload.oldPassword) {
        throw createError(
          400,
          "Password lama wajib disertakan untuk alasan keamanan.",
        );
      }

      // Pastikan method comparePassword ini sudah ada di schema akunModel.js Anda
      const isMatch = await user.comparePassword(payload.oldPassword);
      if (!isMatch) {
        throw createError(400, "Password lama tidak sesuai.");
      }

      // Assign password baru (Mongoose pre-save hook akan melakukan hashing nanti)
      user.password = payload.password;
    }

    // Update field lain secara selektif
    if (payload.username !== undefined) user.username = payload.username;
    if (payload.email) user.email = payload.email;
    if (payload.tenantID) user.tenantID = payload.tenantID;

    // Simpan ke database, memicu Mongoose validation dan hook hashing password
    await user.save();

    // Pembersihan Cache
    // FIX 2: Menggunakan user._id, bukan userId yang tidak terdefinisi
    await this.clearCache(user._id);
    if (payload.email) {
      await redis.del(KEY_ALL_USERS);
    }

    // Transformasi agar response aman (tidak membocorkan password baru/lama)
    const result = user.toObject({ minimize: false });
    delete result.password;
    delete result.__v;

    return result;
  }

  // perbaikan: Tambahkan parameter requesterId agar selaras dengan Controller
  async getAllAkun(requesterId) {
    // perbaikan: Terapkan validasi otorisasi level akun (platform)
    const requester = await Akun.findById(requesterId).select("role").lean();
    if (!requester || requester.role !== "admin") {
      throw createError(
        403,
        "Forbidden: Hanya admin platform yang dapat mengakses seluruh data akun.",
      );
    }

    const cached = await redis.get(KEY_ALL_USERS);
    if (cached) return JSON.parse(cached);

    const users = await Akun.find({}).select("-password").lean();

    await redis.set(KEY_ALL_USERS, JSON.stringify(users), "EX", 60);
    return users;
  }

  async deleteUserByAdmin(targetUserId, requesterId) {
    const requester = await Akun.findById(requesterId).select("role").lean();

    // if (targetUserId === requesterId) {
    //   throw createError(400, "Tidak dapat menghapus akun Anda sendiri.");
    // }

    if (!requester || requester.role !== "admin") {
      throw createError(
        403,
        "Forbidden: hanya admin yang boleh menghapus akun.",
      );
    }

    const deleted = await Akun.findByIdAndDelete(targetUserId);
    if (!deleted) throw createError(404, "Pengguna tidak ditemukan.");

    await this.clearCache(targetUserId);
    await redis.del(KEY_ALL_USERS);

    return true;
  }
}

module.exports = new AkunService();
