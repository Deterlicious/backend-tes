const Pengguna = require("../models/penggunaModel");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");
const { validatePenggunaPayload } = require("../validators/penggunaValidator");
const createError = require("http-errors");

const PENGGUNA_ACCESS_TOKEN = process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";
const PENGGUNA_REFRESH_TOKEN = process.env.PENGGUNA_JWT_REFRESH_SECRET || "pengguna_refresh_secret";

const KEY_LIST = (tenantID) => `pengguna:list:${tenantID}`;
const KEY_DETAIL = (id) => `pengguna:detail:${id}`;
const KEY_LOGIN_LIST = (tenantID) => `pengguna:login-screen:${tenantID}`;

class PenggunaService {
  generateToken(pengguna) {
    return jwt.sign(
      {
        id: pengguna._id,
        tenantID: pengguna.tenantID,
        roleID: pengguna.roleID,
        version: pengguna.tokenVersion,
      },
      PENGGUNA_ACCESS_TOKEN,
      { expiresIn: "12h" }
    );
  }

  generateRefreshToken(pengguna) {
    return jwt.sign(
      {
        id: pengguna._id,
        tenantID: pengguna.tenantID,
        roleID: pengguna.roleID,
        version: pengguna.tokenVersion,
      },
      PENGGUNA_REFRESH_TOKEN,
      { expiresIn: "7d" }
    );
  }

  async clearCache(tenantID, userID) {
    const keys = [KEY_LIST(tenantID), KEY_LOGIN_LIST(tenantID)];
    if (userID) keys.push(KEY_DETAIL(userID));
    await redis.del(keys);
  }

  async login({ nama, pin }) {
    const pengguna = await Pengguna.findOne({ nama }).populate(
      "roleID",
      "namaRole"
    );

    if (!pengguna) {
      throw createError(404, "Pengguna tidak ditemukan");
    }

    const isMatch = await pengguna.comparePin(pin);
    if (!isMatch) {
      throw createError(400, "PIN salah");
    }


    pengguna.tokenVersion = Date.now();
    await pengguna.save();

    // Access token (short-lived)
    const accessToken = this.generateToken(pengguna);

    // Refresh token (long-lived)
    const refreshToken = this.generateRefreshToken(pengguna);

    return {
      token: accessToken,
      refreshToken,
      user: {
        nama: pengguna.nama,
        role: pengguna.roleID.namaRole,
      },
    };
  }

  async logout() {
    // Tidak perlu melakukan apa-apa di server untuk logout pengguna
    // Cukup hapus cookie di client
    return true;
  }

  // async login({ nama, pin }) {
  //   const pengguna = await Pengguna.findOne({ nama })
  //     .populate("roleID", "namaRole")
  //     .lean(false);
  //   if (!pengguna) {
  //     throw createError(404, "Pengguna tidak ditemukan");
  //   }
  //   const isMatch = await pengguna.comparePin(pin);
  //   if (!isMatch) {
  //     throw createError(400, "PIN salah");
  //   }
  //   pengguna.tokenVersion = Date.now();
  //   await pengguna.save();
  //   const token = this.generateToken(pengguna);
  //   return {
  //     token,
  //     user: {
  //       nama: pengguna.nama,
  //       role: pengguna.roleID.namaRole,
  //     },
  //   };
  // }

  async refreshToken(oldRefreshToken) {
    if (!oldRefreshToken) {
      throw createError(401, "Refresh Token tidak ditemukan");
    }

    let payload;
    try {
      payload = jwt.verify(oldRefreshToken, PENGGUNA_REFRESH_TOKEN);
    } catch (err) {
      throw createError(403, "Refresh Token tidak valid atau kadaluwarsa");
    }

    const user = await Pengguna.findById(payload.id);
    if (!user) {
      throw createError(404, "User tidak ditemukan (mungkin telah dihapus)");
    }

    const newAccessToken = jwt.sign(
      { id: user._id, roleID: user.roleID, tenantID: user.tenantID },
      PENGGUNA_ACCESS_TOKEN,
      { expiresIn: "15m" }
    );

    const newRefreshToken = jwt.sign(
      { id: user._id, tenantID: user.tenantID },
      PENGGUNA_REFRESH_TOKEN,
      { expiresIn: "12h" }
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

async getForLoginScreen(tenantID) {
    // 🛡️ SECURITY & BUG FIX: 
    // Paksa konversi ke String untuk mencegah error "Cannot convert object..."
    // Ini menangani kasus jika tenantID berupa ObjectId Mongoose atau object lainnya.
    const safeTenantID = String(tenantID);

    const cached = await redis.get(KEY_LOGIN_LIST(safeTenantID));
    if (cached) return JSON.parse(cached);

    const users = await Pengguna.find({ tenantID: safeTenantID })
      .select("_id nama roleID tenantID")
      .populate("roleID", "namaRole")
      .lean();

    await redis.set(KEY_LOGIN_LIST(safeTenantID), JSON.stringify(users), "EX", 300);

    return users;
  }

  async getAll(tenantID) {
    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    const users = await Pengguna.find({ tenantID })
      .select("-pin")
      .populate("roleID", "namaRole")
      .lean();

    await redis.set(KEY_LIST(tenantID), JSON.stringify(users), "EX", 60);
    return users;
  }

  async getById(id, tenantID) {
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.tenantID !== tenantID.toString()) {
        throw createError(403, "Akses lintas tenant ditolak");
      }
      return parsed;
    }

    const user = await Pengguna.findOne({ _id: id, tenantID })
      .select("-pin")
      .populate("roleID", "namaRole")
      .lean();

    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    await redis.set(KEY_DETAIL(id), JSON.stringify(user), "EX", 60);
    return user;
  }

  // async create(payload, tenantID) {
  //   const validation = validatePenggunaPayload(payload);
  //   if (!validation.valid) {
  //     throw createError(400, validation.errors[0]);
  //   }

  //   payload.tenantID = tenantID;

  //   const user = await Pengguna.create(payload);
  //   await this.clearCache(tenantID);

  //   return user;
  // }

  async create(payload, tenantID) {
    const validation = validatePenggunaPayload(payload);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    payload.tenantID = tenantID;
    payload.tokenVersion = Date.now();

    const user = await Pengguna.create(payload);

    await user.populate("roleID", "namaRole");
    await this.clearCache(tenantID);

    const accessToken = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      token: accessToken,
      refreshToken,
      user: {
        nama: user.nama,
        role: user.roleID.namaRole,
      },
    };
  }

  async update(id, payload, tenantID) {
    delete payload.tenantID;

    const validation = validatePenggunaPayload(payload, true);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    const user = await Pengguna.findOne({ _id: id, tenantID });
    if (!user) {
      throw createError(404, "Pengguna tidak ditemukan");
    }

    Object.assign(user, payload);
    const updated = await user.save();

    await this.clearCache(tenantID, id);
    return updated;
  }

  async delete(id, tenantID) {
    const user = await Pengguna.findOne({ _id: id, tenantID });
    if (!user) {
      throw createError(404, "Pengguna tidak ditemukan");
    }

    await user.deleteOne();
    await this.clearCache(tenantID, id);
    return true;
  }
}

module.exports = new PenggunaService();
