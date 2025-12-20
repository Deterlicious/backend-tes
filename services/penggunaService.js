const Pengguna = require("../models/penggunaModel");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");
const { validatePenggunaPayload } = require("../validators/penggunaValidator");
const createError = require("http-errors");

const JWT_SECRET = process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";

const KEY_LIST = (tenantID) => `pengguna:list:${tenantID}`;
const KEY_DETAIL = (id) => `pengguna:detail:${id}`;

class PenggunaService {

  generateToken(pengguna) {
    return jwt.sign(
      {
        id: pengguna._id,
        tenantID: pengguna.tenantID,
        roleID: pengguna.roleID,
        version: pengguna.tokenVersion
      },
      JWT_SECRET,
      { expiresIn: "12h" }
    );
  }

  async clearCache(tenantID, userID) {
    await redis.del(KEY_LIST(tenantID));
    if (userID) await redis.del(KEY_DETAIL(userID));
  }

  async login({ nama, pin }) {
    const pengguna = await Pengguna.findOne({ nama })
      .populate("roleID", "namaRole")
      .lean(false);

    if (!pengguna) {
      throw createError(404, "Pengguna tidak ditemukan");
    }

    const isMatch = await pengguna.comparePin(pin);
    if (!isMatch) {
      throw createError(400, "PIN salah");
    }

    pengguna.tokenVersion = Date.now();
    await pengguna.save();

    const token = this.generateToken(pengguna);

    return {
      token,
      user: {
        nama: pengguna.nama,
        role: pengguna.roleID.namaRole,
      }
    };
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

  async create(payload, tenantID) {
    const validation = validatePenggunaPayload(payload);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    payload.tenantID = tenantID;

    const user = await Pengguna.create(payload);
    await this.clearCache(tenantID);

    return user;
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
