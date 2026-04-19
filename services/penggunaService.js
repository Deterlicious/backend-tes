const Pengguna = require("../models/penggunaModel");
const Role = require("../models/roleModel");
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
  // Helper untuk generate Access Token
  generateToken(pengguna) {
    return jwt.sign(
      {
        id: pengguna._id,
        tenantID: pengguna.tenantID,
        roleID: pengguna.roleID._id || pengguna.roleID,
        version: pengguna.tokenVersion,
      },
      PENGGUNA_ACCESS_TOKEN,
      { expiresIn: "12h" },
    );
  } 

  // Helper untuk generate Refresh Token
  generateRefreshToken(pengguna) {
    return jwt.sign(
      {
        id: pengguna._id,
        tenantID: pengguna.tenantID,
        version: pengguna.tokenVersion,
      },
      PENGGUNA_REFRESH_TOKEN,
      { expiresIn: "7d" },
    );
  }

  async clearCache(tenantID, userID) {
    const keys = [KEY_LIST(tenantID), KEY_LOGIN_LIST(tenantID)];
    if (userID) keys.push(KEY_DETAIL(userID));
    await redis.del(keys);
  }

  /**
   * Method untuk Registrasi Pengguna Pertama (Owner)
   */
  async registerOwner(payload, tenantID) {
    const existingUser = await Pengguna.findOne({ tenantID });
    if (existingUser) {
      throw createError(400, "Owner sudah terdaftar untuk tenant ini.");
    }

    const ownerRole = await Role.findOne({ tenantID, namaRole: "Owner" });
    if (!ownerRole) {
      throw createError(500, "Role Owner tidak ditemukan. Pastikan toko dibuat dengan benar.");
    }

    payload.roleID = ownerRole._id;
    payload.tenantID = tenantID;
    payload.tokenVersion = Date.now();

    const validation = validatePenggunaPayload(payload);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    const user = await Pengguna.create(payload);
    await user.populate("roleID", "namaRole");
    
    await this.clearCache(tenantID);

    const accessToken = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      token: accessToken,
      refreshToken,
      user: {
        _id: user._id, // 🔥 SEKARANG ID DIKIRIM KE CONTROLLER
        nama: user.nama,
        role: user.roleID.namaRole,
      },
    };
  }

  async login({ nama, pin }) {
    const pengguna = await Pengguna.findOne({ nama }).populate("roleID", "namaRole");

    if (!pengguna) throw createError(404, "Pengguna tidak ditemukan");

    const isMatch = await pengguna.comparePin(pin);
    if (!isMatch) throw createError(400, "PIN salah");
    
    pengguna.tokenVersion = Date.now();
    await pengguna.save();

    const accessToken = this.generateToken(pengguna);
    const refreshToken = this.generateRefreshToken(pengguna);

    return {
      token: accessToken,
      refreshToken,
      user: {
        _id: pengguna._id, // 🔥 SEKARANG ID DIKIRIM KE CONTROLLER
        nama: pengguna.nama,
        role: pengguna.roleID.namaRole,
      },
    };
  }

  async refreshToken(oldRefreshToken) {
    if (!oldRefreshToken) throw createError(401, "Refresh Token tidak ditemukan");

    let decoded;
    try {
      decoded = jwt.verify(oldRefreshToken, PENGGUNA_REFRESH_TOKEN);
    } catch (err) {
      throw createError(403, "Refresh Token tidak valid atau kadaluwarsa");
    }

    const user = await Pengguna.findById(decoded.id).populate("roleID", "namaRole");
    if (!user) throw createError(404, "User tidak ditemukan");
    
    if (user.tokenVersion !== decoded.version) {
      throw createError(401, "Sesi tidak valid. Silakan login kembali.");
    }

    return {
      accessToken: this.generateToken(user),
      refreshToken: this.generateRefreshToken(user),
    };
  }

  async getForLoginScreen(tenantID) {
    const safeTenantID = String(tenantID);
    const cached = await redis.get(KEY_LOGIN_LIST(safeTenantID));
    if (cached) return JSON.parse(cached);

    const users = await Pengguna.find({ tenantID: safeTenantID, status: "aktif" })
      .select("_id nama roleID tenantID fotoKaryawan")
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
      if (parsed.tenantID !== tenantID.toString()) throw createError(403, "Akses ditolak");
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

  async create(payload, tenantID) {
    payload.tenantID = tenantID;
    payload.tokenVersion = Date.now();

    const validation = validatePenggunaPayload(payload);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    const roleExists = await Role.findOne({ _id: payload.roleID, tenantID: tenantID });
    if (!roleExists) throw createError(404, "Jabatan (Role) tidak ditemukan.");

    const user = await Pengguna.create(payload);
    await user.populate("roleID", "namaRole");
    await this.clearCache(tenantID);

    return user;
  }

  async update(id, payload, tenantID) {
    delete payload.tenantID; 

    const validation = validatePenggunaPayload(payload, true);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    if (payload.roleID) {
      const roleExists = await Role.findOne({ _id: payload.roleID, tenantID: tenantID });
      if (!roleExists) throw createError(404, "Jabatan tidak ditemukan.");
    }

    const user = await Pengguna.findOne({ _id: id, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    Object.assign(user, payload);
    const updated = await user.save();
    await updated.populate("roleID", "namaRole");

    await this.clearCache(tenantID, id);
    return updated;
  }

  async delete(id, tenantID) {
    const user = await Pengguna.findOne({ _id: id, tenantID }).populate("roleID");
    if (!user) throw createError(404, "Pengguna tidak ditemukan");
    
    if (user.roleID.namaRole === "Owner") throw createError(403, "Role Owner tidak dapat dihapus.");

    await user.deleteOne();
    await this.clearCache(tenantID, id);
    return true;
  }
}

module.exports = new PenggunaService();