const Pengguna = require("../models/penggunaModel");
const Role = require("../models/roleModel");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");
const { validatePenggunaPayload } = require("../validators/penggunaValidator");
const { validateDeviceAction } = require("../validators/akunValidator");
const createError = require("http-errors");

const PENGGUNA_ACCESS_TOKEN = process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";
const PENGGUNA_REFRESH_TOKEN = process.env.PENGGUNA_JWT_REFRESH_SECRET || "pengguna_refresh_secret";

const KEY_LIST = (tenantID) => `pengguna:list:${tenantID}`;
const KEY_DETAIL = (id) => `pengguna:detail:${id}`;
const KEY_LOGIN_LIST = (tenantID) => `pengguna:login-screen:${tenantID}`;

class PenggunaService {

  // TOKEN GENERATORS

  // Generate Access Token
  // Untuk pengguna app: sertakan deviceID dan version dari device
  // Untuk pengguna web: version dari tokenVersion root
  generateToken(pengguna, device = null) {
    const payload = {
      id: pengguna._id,
      tenantID: pengguna.tenantID,
      roleID: pengguna.roleID._id || pengguna.roleID,
      aksesType: pengguna.aksesType,
    };

    if (pengguna.aksesType === "app" && device) {
      payload.deviceID = device.deviceID;
      payload.version = device.tokenVersion;
    } else {
      payload.version = pengguna.tokenVersion;
    }

    return jwt.sign(payload, PENGGUNA_ACCESS_TOKEN, { expiresIn: "12h" });
  }

  // Generate Refresh Token
  generateRefreshToken(pengguna, device = null) {
    const payload = {
      id: pengguna._id,
      tenantID: pengguna.tenantID,
      aksesType: pengguna.aksesType,
    };

    if (pengguna.aksesType === "app" && device) {
      payload.deviceID = device.deviceID;
      payload.version = device.tokenVersion;
    } else {
      payload.version = pengguna.tokenVersion;
    }

    return jwt.sign(payload, PENGGUNA_REFRESH_TOKEN, { expiresIn: "7d" });
  }

  async clearCache(tenantID, userID) {
    const keys = [KEY_LIST(tenantID), KEY_LOGIN_LIST(tenantID)];
    if (userID) keys.push(KEY_DETAIL(userID));
    await redis.del(keys);
  }

  // REGISTER OWNER
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
    // Owner default aksesType app — bisa login web dan app
    payload.aksesType = payload.aksesType || "app";

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
        _id: user._id,
        nama: user.nama,
        role: user.roleID.namaRole,
      },
    };
  }

  // LOGIN PIN
  async login({ nama, pin, tenantID, deviceID, deviceType }) {
    const pengguna = await Pengguna.findOne({
      nama,
      tenantID,
    }).populate("roleID", "namaRole");

    if (!pengguna) throw createError(404, "Pengguna tidak ditemukan");

    const isMatch = await pengguna.comparePin(pin);
    if (!isMatch) throw createError(400, "PIN salah");

    let device = null;

    if (pengguna.aksesType === "app") {
      // Pengguna app WAJIB menyertakan deviceID
      if (!deviceID) {
        throw createError(400, "Device ID wajib disertakan untuk login via aplikasi.");
      }

      device = pengguna.device.find((d) => d.deviceID === deviceID);
      const newTokenVersion = Date.now();

      if (device) {
        // Device sudah terdaftar — update tokenVersion dan lastUsed
        device.tokenVersion = newTokenVersion;
        device.lastUsed = new Date();
      } else {
        // Device baru — cek kuota
        if (pengguna.device.length >= pengguna.maxDevice) {
          throw createError(403, "Kuota perangkat penuh. Harap hapus perangkat lama terlebih dahulu.");
        }

        const newDeviceObj = {
          deviceID,
          type: deviceType || (pengguna.device.length === 0 ? "primary" : "secondary"),
          tokenVersion: newTokenVersion,
          lastUsed: new Date(),
        };

        pengguna.device.push(newDeviceObj);
        pengguna.deviceHistory.push({
          deviceID,
          type: newDeviceObj.type,
          action: "added",
        });

        device = pengguna.device[pengguna.device.length - 1];
      }

      pengguna.markModified("device");
      pengguna.markModified("deviceHistory");

    } else {
      // Pengguna web — tidak perlu device, update tokenVersion di root
      pengguna.tokenVersion = Date.now();
    }

    await pengguna.save();
    await this.clearCache(tenantID, pengguna._id);

    const accessToken = this.generateToken(pengguna, device);
    const refreshToken = this.generateRefreshToken(pengguna, device);

    return {
      token: accessToken,
      refreshToken,
      user: {
        _id: pengguna._id,
        nama: pengguna.nama,
        role: pengguna.roleID.namaRole,
        aksesType: pengguna.aksesType,
      },
    };
  }

  // REFRESH TOKEN
  async refreshToken(oldRefreshToken) {
    if (!oldRefreshToken) throw createError(401, "Refresh Token tidak ditemukan");

    let decoded;
    try {
      decoded = jwt.verify(oldRefreshToken, PENGGUNA_REFRESH_TOKEN);
    } catch (err) {
      throw createError(403, "Refresh Token tidak valid atau kadaluwarsa");
    }

    const user = await Pengguna.findById(decoded.id).populate("roleID", "namaRole");
    
    // Fix bug 1: Ubah 404 menjadi 401 untuk standar keamanan sesi
    if (!user) {
      throw createError(401, "Pengguna tidak ditemukan. Sesi tidak valid.");
    }

    // Fix bug 2: Cegah Fatal Crash akibat Orphan Data
    if (!user.roleID) {
      throw createError(403, "Akses ditolak. Role pengguna telah dihapus oleh sistem.");
    }

    // Validasi tenantID (fix masalah 3)
    if (!user.tenantID || user.tenantID.toString() !== decoded.tenantID) {
      throw createError(401, "Token tidak valid untuk tenant ini.");
    }

    // Validasi tenantID (fix masalah 3)
    if (!user.tenantID || user.tenantID.toString() !== decoded.tenantID) {
      throw createError(401, "Token tidak valid untuk tenant ini.");
    }

    let device = null;

    if (user.aksesType === "app") {
      // Pengguna app — validasi device dan tokenVersion per device
      if (!decoded.deviceID) {
        throw createError(401, "Device ID tidak ditemukan pada token.");
      }

      device = user.device.find((d) => d.deviceID === decoded.deviceID);
      if (!device) {
        throw createError(401, "Perangkat tidak dikenali. Silakan login ulang.");
      }

      if (device.tokenVersion !== decoded.version || device.tokenVersion === 0) {
        throw createError(401, "Sesi kedaluwarsa. Silakan login ulang.");
      }

      // Rotate tokenVersion per device
      device.tokenVersion = Date.now();
      device.lastUsed = new Date();
      user.markModified("device");

    } else {
      // Pengguna web — validasi tokenVersion di root
      if (user.tokenVersion !== decoded.version || user.tokenVersion === 0) {
        throw createError(401, "Sesi tidak valid. Silakan login kembali.");
      }

      // Rotate tokenVersion root
      user.tokenVersion = Date.now();
    }

    await user.save();
    await this.clearCache(user.tenantID, user._id);

    return {
      accessToken: this.generateToken(user, device),
      refreshToken: this.generateRefreshToken(user, device),
    };
  }

  // DEVICE MANAGEMENT (hanya untuk aksesType "app")

  async addDevice(penggunaID, tenantID, payload) {
    const validation = validateDeviceAction(payload);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    const { deviceID, type } = payload;
    const user = await Pengguna.findOne({ _id: penggunaID, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan.");

    if (user.aksesType !== "app") {
      throw createError(400, "Device management hanya tersedia untuk pengguna tipe app.");
    }

    if (user.device.some((d) => d.deviceID === deviceID)) {
      throw createError(400, "Device ID sudah terdaftar.");
    }

    if (user.device.length >= user.maxDevice) {
      throw createError(403, "Kuota perangkat penuh.");
    }

    const finalType = user.device.length === 0 ? "primary" : (type || "secondary");
    const newDevice = {
      deviceID,
      type: finalType,
      tokenVersion: 0,
      lastUsed: new Date(),
    };

    user.device.push(newDevice);
    user.deviceHistory.push({ deviceID, type: finalType, action: "added" });

    user.markModified("device");
    user.markModified("deviceHistory");
    await user.save();
    await redis.del(KEY_DETAIL(penggunaID));

    return user.device;
  }

  async promoteDevice(penggunaID, tenantID, deviceID) {
    const user = await Pengguna.findOne({ _id: penggunaID, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan.");

    const device = user.device.find((d) => d.deviceID === deviceID);
    if (!device) throw createError(404, "Perangkat tidak ditemukan.");

    const currentPrimary = user.device.filter((d) => d.type === "primary").length;
    if (currentPrimary >= user.maxPrimaryDevice) {
      throw createError(400, "Slot primary device penuh.");
    }

    device.type = "primary";
    user.deviceHistory.push({ deviceID, type: "primary", action: "promoted" });

    user.markModified("device");
    await user.save();
    await redis.del(KEY_DETAIL(penggunaID));

    return device;
  }

  async demoteDevice(penggunaID, tenantID, deviceID) {
    const user = await Pengguna.findOne({ _id: penggunaID, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan.");

    const device = user.device.find((d) => d.deviceID === deviceID);
    if (!device) throw createError(404, "Perangkat tidak ditemukan.");

    device.type = "secondary";
    user.deviceHistory.push({ deviceID, type: "secondary", action: "demoted" });

    user.markModified("device");
    await user.save();
    await redis.del(KEY_DETAIL(penggunaID));

    return device;
  }

  async removeDevice(penggunaID, tenantID, deviceID) {
    const user = await Pengguna.findOne({ _id: penggunaID, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan.");

    const index = user.device.findIndex((d) => d.deviceID === deviceID);
    if (index === -1) throw createError(404, "Perangkat tidak ditemukan.");

    const deviceType = user.device[index].type;
    user.device.splice(index, 1);
    user.deviceHistory.push({ deviceID, type: deviceType, action: "removed" });

    user.markModified("device");
    user.markModified("deviceHistory");
    await user.save();
    await redis.del(KEY_DETAIL(penggunaID));

    return true;
  }

  async getDeviceHistory(penggunaID, tenantID) {
    const user = await Pengguna.findOne({ _id: penggunaID, tenantID })
      .select("deviceHistory aksesType")
      .lean();

    if (!user) throw createError(404, "Pengguna tidak ditemukan.");
    if (user.aksesType !== "app") {
      throw createError(400, "Pengguna web tidak memiliki riwayat perangkat.");
    }

    return user.deviceHistory || [];
  }

  // CRUD

  async getForLoginScreen(tenantID) {
    const safeTenantID = String(tenantID);
    const cached = await redis.get(KEY_LOGIN_LIST(safeTenantID));
    if (cached) return JSON.parse(cached);

    const users = await Pengguna.find({ tenantID: safeTenantID, status: "aktif" })
      .select("_id nama roleID tenantID fotoKaryawan aksesType")
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

    const roleExists = await Role.findOne({ _id: payload.roleID, tenantID });
    if (!roleExists) throw createError(404, "Jabatan (Role) tidak ditemukan.");

    if (roleExists.namaRole === "Owner") {
      const existingOwner = await Pengguna.findOne({
        tenantID,
        roleID: roleExists._id,
      });
      if (existingOwner) {
        throw createError(400, "Role Owner hanya boleh dimiliki oleh 1 pengguna.");
      }
    }

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
      const roleExists = await Role.findOne({ _id: payload.roleID, tenantID });
      if (!roleExists) throw createError(404, "Jabatan tidak ditemukan.");

      if (roleExists.namaRole === "Owner") {
        const existingOwner = await Pengguna.findOne({
          tenantID,
          roleID: roleExists._id,
          _id: { $ne: id },
        });
        if (existingOwner) {
          throw createError(400, "Role Owner sudah digunakan oleh pengguna lain.");
        }
      }
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

    if (user.roleID.namaRole === "Owner") {
      throw createError(403, "Role Owner tidak dapat dihapus.");
    }

    await user.deleteOne();
    await this.clearCache(tenantID, id);
    return true;
  }

  async checkOwnerExists(tenantID) {
    const ownerRole = await Role.findOne({ tenantID, namaRole: "Owner" });
    if (!ownerRole) return false;
    const owner = await Pengguna.findOne({ tenantID, roleID: ownerRole._id });
    return !!owner;
  }
}

module.exports = new PenggunaService();