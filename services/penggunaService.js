const Pengguna = require("../models/penggunaModel");
const Role = require("../models/roleModel");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");
const {
  validatePenggunaPayload,
  validateDeviceAction,
} = require("../validators/penggunaValidator");

const createError = require("http-errors");

const PENGGUNA_ACCESS_TOKEN =
  process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";
const PENGGUNA_REFRESH_TOKEN =
  process.env.PENGGUNA_JWT_REFRESH_SECRET || "pengguna_refresh_secret";

const KEY_LIST = (tenantID) => `pengguna:list:${tenantID}`;
const KEY_DETAIL = (id) => `pengguna:detail:${id}`;
const KEY_LOGIN_LIST = (tenantID) => `pengguna:login-screen:${tenantID}`;

class PenggunaService {
  // TOKEN GENERATORS
  generateToken(pengguna, device = null, loginType) {
    const payload = {
      id: pengguna._id,
      tenantID: pengguna.tenantID,
      roleID: pengguna.roleID._id || pengguna.roleID,
      aksesType: pengguna.aksesType, // tetap simpan (capability)
      loginType,
    };

    if (loginType === "app" && device) {
      payload.deviceID = device.deviceID;
      payload.version = device.tokenVersion;
    } else {
      payload.version = pengguna.tokenVersion;
    }

    return jwt.sign(payload, PENGGUNA_ACCESS_TOKEN, { expiresIn: "1d" });
  }

  generateRefreshToken(pengguna, device = null, loginType) {
    const payload = {
      id: pengguna._id,
      tenantID: pengguna.tenantID,
      aksesType: pengguna.aksesType,
      loginType,
    };

    if (loginType === "app" && device) {
      payload.deviceID = device.deviceID;
      payload.version = device.tokenVersion;
    } else {
      payload.version = pengguna.tokenVersion;
    }

    return jwt.sign(payload, PENGGUNA_REFRESH_TOKEN, { expiresIn: "7d" });
  }

  async registerOwner(payload, tenantID) {
    const { pin, nama, deviceID, deviceType, aksesType } = payload;

    if (!deviceID) {
      throw createError(400, "Device ID wajib untuk registrasi Owner.");
    }

    const roleOwner = await Role.findOne({ tenantID, namaRole: "Owner" });
    if (!roleOwner) throw createError(404, "Role Owner tidak ditemukan.");

    // Cek nama unik
    const existing = await Pengguna.findOne({ tenantID, nama });
    if (existing) throw createError(400, "nama sudah digunakan ini.");

    const now = Date.now();

    // Samakan dengan create: selalu array
    const normalizedAksesType = Array.isArray(aksesType)
      ? aksesType
      : [aksesType || "app"]; // default tetap app

    const newOwner = new Pengguna({
      ...payload,
      tenantID,
      roleID: roleOwner._id, // override penting
      aksesType: normalizedAksesType, // konsisten array
      tokenVersion: now,
    });

    let device = null;

    // Register device jika ada akses app
    if (normalizedAksesType.includes("app")) {
      const newDeviceObj = {
        deviceID,
        type: deviceType || "primary",
        tokenVersion: now,
        lastUsed: new Date(),
      };

      newOwner.device.push(newDeviceObj);

      newOwner.deviceHistory.push({
        deviceID,
        type: newDeviceObj.type,
        action: "added",
      });

      device = newDeviceObj;
    }

    await newOwner.save();
    await newOwner.populate("roleID", "namaRole");

    await this.clearCache(tenantID, newOwner._id);

    const loginType = "app";

    const accessToken = this.generateToken(newOwner, device, loginType);
    const refreshToken = this.generateRefreshToken(newOwner, device, loginType);

    return {
      pengguna: {
        id: newOwner._id,
        nama: newOwner.nama,
        aksesType: newOwner.aksesType,
        role: newOwner.roleID.namaRole,
        status: newOwner.status,
      },
      accessToken,
      refreshToken,
    };
  }

  async login({ nama, pin, tenantID, deviceID, deviceType, loginType }) {
    // Normalisasi — terima string atau array
    const normalizedLoginType = Array.isArray(loginType)
      ? loginType
      : loginType
        ? [loginType]
        : [];

    if (normalizedLoginType.length !== 1) {
      throw createError(400, "loginType saat login harus satu (web atau app)");
    }

    const resolvedLoginType = normalizedLoginType[0];

    if (!["web", "app"].includes(resolvedLoginType)) {
      throw createError(400, "loginType tidak valid");
    }

    const user = await Pengguna.findOne({ nama, tenantID }).populate(
      "roleID",
      "namaRole permissions",
    );
    if (!user) throw createError(401, "Nama atau PIN salah.");

    const isMatch = await user.comparePin(pin);
    if (!isMatch) throw createError(401, "Nama atau PIN salah.");

    if (
      !Array.isArray(user.aksesType) ||
      !user.aksesType.includes(resolvedLoginType)
    ) {
      throw createError(403, "Akses tidak diizinkan untuk pengguna ini.");
    }

    const now = Date.now();
    let device = null;

    if (resolvedLoginType === "app") {
      if (!deviceID) {
        throw createError(400, "Device ID wajib disertakan.");
      }

      device = user.device.find((d) => d.deviceID === deviceID);

      if (device) {
        device.tokenVersion = now;
        device.lastUsed = new Date();
      } else {
        if (user.device.length >= user.maxDevice) {
          throw createError(
            403,
            "Kuota perangkat penuh. Hapus perangkat lama terlebih dahulu.",
          );
        }

        const newDeviceObj = {
          deviceID,
          type:
            deviceType || (user.device.length === 0 ? "primary" : "secondary"),
          tokenVersion: now,
          lastUsed: new Date(),
        };

        user.device.push(newDeviceObj);
        user.deviceHistory.push({
          deviceID,
          type: newDeviceObj.type,
          action: "added",
        });

        device = newDeviceObj;
      }

      user.markModified("device");
      user.markModified("deviceHistory");
    } else {
      // WEB LOGIN
      user.tokenVersion = now;
    }

    await user.save();
    await this.clearCache(tenantID, user._id);

    const accessToken = this.generateToken(user, device, resolvedLoginType);
    const refreshToken = this.generateRefreshToken(
      user,
      device,
      resolvedLoginType,
    );

    return {
      pengguna: {
        id: user._id,
        nama: user.nama,
        aksesType: user.aksesType,
        role: user.roleID?.namaRole || null,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token) {
    let decoded;

    // 1. Try-catch untuk cek token jwt
    try {
      decoded = jwt.verify(token, PENGGUNA_REFRESH_TOKEN);
    } catch (err) {
      throw createError(401, "Refresh token tidak valid atau kedaluwarsa.");
    }

    // Query ke DB dilakukan DI LUAR try-catch jwt
    const user = await Pengguna.findById(decoded.id);
    if (!user) throw createError(401, "Pengguna tidak ditemukan.");

    const loginType = decoded.loginType;
    let device = null;

    if (loginType === "app") {
      device = user.device.find((d) => d.deviceID === decoded.deviceID);
      if (!device || device.tokenVersion !== decoded.version) {
        throw createError(401, "Sesi perangkat tidak valid.");
      }

      // Rotate tokenVersion per device
      device.tokenVersion = Date.now();
      device.lastUsed = new Date();
      user.markModified("device");
    } else {
      if (user.tokenVersion !== decoded.version) {
        throw createError(401, "Sesi tidak valid.");
      }
      user.tokenVersion = Date.now();
    }

    // Jika save() gagal (misal MongoDB crash), dia akan otomatis melempar error 500
    // tanpa dibungkam oleh catch 401 seperti sebelumnya.
    await user.save();
    await this.clearCache(user.tenantID, user._id); // invalidate cache

    const accessToken = this.generateToken(user, device, loginType);
    const newRefreshToken = this.generateRefreshToken(user, device, loginType);

    return { accessToken, newRefreshToken };
  }

  async logout(token, accessToken) {
    try {
      const decoded = jwt.verify(token, PENGGUNA_REFRESH_TOKEN);
      const user = await Pengguna.findById(decoded.id);
      if (!user) return;

      const loginType = decoded.loginType;

      if (loginType === "app") {
        const device = user.device.find((d) => d.deviceID === decoded.deviceID);
        if (device) {
          device.tokenVersion = 0;
          user.markModified("device");
        }
      } else {
        user.tokenVersion = 0;
      }

      await user.save();
      await this.clearCache(user.tenantID, user._id);
    } catch (err) {
      // Abaikan error pada refresh token (silent exit bagian 1)
    }

    if (accessToken) {
      try {
        const decodedAccess = jwt.verify(
          accessToken,
          process.env.PENGGUNA_JWT_SECRET || "pengguna_secret",
        );
        const timeRemaining = decodedAccess.exp - Math.floor(Date.now() / 1000);

        if (timeRemaining > 0) {
          await redis.set(
            `bl_${accessToken}`,
            "blacklisted",
            "EX",
            timeRemaining,
          );
        }
      } catch (ignore) {} // Diam-diam abaikan jika token sudah kedaluwarsa
    }
  }

  // Cache helpers
  async clearCache(tenantID, id = null) {
    const keys = [KEY_LIST(tenantID), KEY_LOGIN_LIST(tenantID)];
    if (id) {
      keys.push(KEY_DETAIL(id));
      // perbaikan: Wajib menghapus cache sesi auth milik middleware.
      // Jika tidak, middleware akan terus membaca tokenVersion lama yang tertinggal di Redis.
      keys.push(`auth:pengguna:${id}`);
    }

    await Promise.all(keys.map((key) => redis.del(key)));
  }

  // CRUD LOGIC
  async getAll(tenantID) {
    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    const users = await Pengguna.find({ tenantID })
      .populate("roleID", "namaRole")
      .select("-pin -__v")
      .lean();

    const result = users.map((u) => ({
      ...u,
      role: u.roleID?.namaRole || null,
      roleID: u.roleID?._id || u.roleID,
    }));

    await redis.set(KEY_LIST(tenantID), JSON.stringify(result), "EX", 3600);
    return result;
  }

  async getById(id, tenantID) {
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) return JSON.parse(cached);

    const user = await Pengguna.findOne({ _id: id, tenantID })
      .populate("roleID", "namaRole")
      .select("-pin -__v")
      .lean();

    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    const result = {
      ...user,
      role: user.roleID?.namaRole || null,
      roleID: user.roleID?._id || user.roleID,
    };

    await redis.set(KEY_DETAIL(id), JSON.stringify(result), "EX", 3600);
    return result;
  }

  async create(payload, tenantID) {
    validatePenggunaPayload(payload);

    const { roleID, deviceID, deviceType, aksesType } = payload;

    const existing = await Pengguna.findOne({ tenantID, nama: payload.nama });
    if (existing) throw createError(400, "nama sudah digunakan ini.");

    const roleExists = await Role.findById(roleID);
    if (!roleExists) throw createError(404, "Role tidak ditemukan.");

    if (String(roleExists.tenantID) !== String(tenantID)) {
      throw createError(403, "Role tidak valid untuk tenant ini.");
    }

    if (roleExists.namaRole === "Owner") {
      const existingOwner = await Pengguna.findOne({
        tenantID,
        roleID: roleExists._id,
      });
      if (existingOwner) {
        throw createError(
          400,
          "Role Owner sudah digunakan oleh pengguna lain.",
        );
      }
    }

    const now = Date.now();

    const normalizedAksesType = Array.isArray(aksesType)
      ? aksesType
      : [aksesType];

    const newUser = new Pengguna({
      ...payload,
      tenantID,
      tokenVersion: now,
      aksesType: normalizedAksesType,
    });

    if (normalizedAksesType.includes("app")) {
      if (!deviceID) {
        throw createError(
          400,
          "deviceID wajib jika aksesType mengandung 'app'",
        );
      }

      const newDeviceObj = {
        deviceID,
        type: deviceType || "primary",
        tokenVersion: now,
        lastUsed: new Date(),
      };

      newUser.device.push(newDeviceObj);

      newUser.deviceHistory.push({
        deviceID,
        type: newDeviceObj.type,
        action: "added",
      });
    }

    await newUser.save();
    await newUser.populate("roleID", "namaRole");

    return {
      pengguna: {
        id: newUser._id,
        nama: newUser.nama,
        role: newUser.roleID.namaRole,
        status: newUser.status,
        fotoKaryawan: newUser.fotoKaryawan || null,
        aksesType: newUser.aksesType,
      },
    };
  }

  async update(id, payload, tenantID) {
    if (!payload || Object.keys(payload).length === 0) {
      throw createError(400, "Data update tidak boleh kosong.");
    }
    if (payload.roleID) {
      const roleExists = await Role.findById(payload.roleID);
      if (!roleExists) throw createError(404, "Role tidak ditemukan.");

      if (roleExists.namaRole === "Owner") {
        const existingOwner = await Pengguna.findOne({
          tenantID,
          roleID: roleExists._id,
          _id: { $ne: id },
        });
        if (existingOwner) {
          throw createError(
            400,
            "Role Owner sudah digunakan oleh pengguna lain.",
          );
        }
      }
    }

    const user = await Pengguna.findOne({ _id: id, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    Object.assign(user, payload);
    const updated = await user.save();
    await updated.populate("roleID", "namaRole");

    const userObj = updated.toObject({ minimize: false });
    delete userObj.pin;
    delete userObj.pin;
    delete userObj.__v;
    userObj.role = userObj.roleID.namaRole;
    userObj.roleID = userObj.roleID._id;

    await this.clearCache(tenantID, id); // perbaikan: dipindahkan ke atas agar cache benar-benar terhapus
    return userObj; // perbaikan: menghapus kode mati di bawah baris ini
  }

  async delete(id, tenantID) {
    const user = await Pengguna.findOne({ _id: id, tenantID }).populate(
      "roleID",
    );
    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    if (user.roleID.namaRole === "Owner") {
      throw createError(403, "Role Owner tidak dapat dihapus.");
    }

    await user.deleteOne();
    await this.clearCache(tenantID, id);
    return true;
  }

  async checkOwnerExists(tenantID) {
    const ownerRole = await Role.findOne({ namaRole: "Owner" });
    if (!ownerRole) return false;
    const owner = await Pengguna.findOne({ tenantID, roleID: ownerRole._id });
    return !!owner;
  }

  // DEVICE MANAGEMENT
  async promoteDevice(id, tenantID, deviceID) {
    const user = await Pengguna.findOne({ _id: id, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    user.device.forEach((d) => {
      if (d.deviceID === deviceID) d.type = "primary";
      else d.type = "secondary";
    });

    await user.save();
    await this.clearCache(tenantID, id);
    return user.device;
  }

  async demoteDevice(id, tenantID, deviceID) {
    const user = await Pengguna.findOne({ _id: id, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    const device = user.device.find((d) => d.deviceID === deviceID);
    if (!device) throw createError(404, "Perangkat tidak ditemukan");

    device.type = "secondary";
    await user.save();
    await this.clearCache(tenantID, id);
    return user.device;
  }

  async removeDevice(id, tenantID, deviceID) {
    const user = await Pengguna.findOne({ _id: id, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    const deviceExists = user.device.some((d) => d.deviceID === deviceID);
    if (!deviceExists) {
      throw createError(404, "Perangkat tidak ditemukan atau sudah dihapus.");
    }

    user.device = user.device.filter((d) => d.deviceID !== deviceID);
    await user.save();
    await this.clearCache(tenantID, id);
    return true;
  }

  async getDeviceHistory(id, tenantID) {
    const user = await Pengguna.findOne({ _id: id, tenantID }).select("device");
    if (!user) throw createError(404, "Pengguna tidak ditemukan");
    return user.device;
  }

  async addDevice(id, tenantID, payload) {
    validateDeviceAction(payload);
    const user = await Pengguna.findOne({ _id: id, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    const exists = user.device.find((d) => d.deviceID === payload.deviceID);
    if (exists) throw createError(400, "Perangkat sudah terdaftar.");

    user.device.push({
      ...payload,
      tokenVersion: 0,
      lastUsed: null,
    });

    await user.save();
    await this.clearCache(tenantID, id);
    return user.device;
  }
}

module.exports = new PenggunaService();
