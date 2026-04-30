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

    return jwt.sign(payload, PENGGUNA_ACCESS_TOKEN, { expiresIn: "1d" });
  }

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

  // async registerOwner(payload, tenantID) {
  //   const { pin, nama, roleID, deviceID, deviceType, aksesType } = payload;

  //   const roleOwner = await Role.findOne({ tenantID, namaRole: "Owner" });
  //   if (!roleOwner) throw createError(404, "Role Owner tidak ditemukan.");

  //   // cek nama sudah dipakai atau belum di tenant ini
  //   const existing = await Pengguna.findOne({ tenantID, nama: payload.nama });
  //   if (existing) throw createError(400, "nama sudah digunakan ini.");

  //   // Tentukan aksesType: default "app" kalau tidak dikirim
  //   const resolvedAksesType = aksesType || "app";

  //   // Kalau aksesType "app", deviceID wajib ada
  //   if (resolvedAksesType === "app" && !deviceID) {
  //     throw createError(
  //       400,
  //       "Device ID wajib disertakan untuk Owner via aplikasi.",
  //     );
  //   }

  //   const newOwner = new Pengguna({
  //     tenantID,
  //     pin,
  //     nama,
  //     roleID: roleOwner._id,
  //     aksesType: resolvedAksesType,
  //     tokenVersion: Date.now(),

  //     ...payload,
  //     tenantID,
  //     tokenVersion: Date.now(),
  //   });

  //   // Kalau aksesType "app", daftarkan device pertama langsung
  //   let device = null;
  //   if (resolvedAksesType === "app") {
  //     const newDeviceObj = {
  //       deviceID,
  //       type: deviceType || "primary",
  //       tokenVersion: Date.now(),
  //       lastUsed: new Date(),
  //     };
  //     newOwner.device.push(newDeviceObj);
  //     newOwner.deviceHistory.push({
  //       deviceID,
  //       type: newDeviceObj.type,
  //       action: "added",
  //     });
  //     device = newOwner.device[newOwner.device.length - 1];
  //   }

  //   await newOwner.save();
  //   await newOwner.populate("roleID", "namaRole");
  //   await this.clearCache(tenantID, newOwner._id);

  //   // await redis.del(`auth:pengguna:${newOwner._id}`);

  //   const accessToken = this.generateToken(newOwner, device);
  //   const refreshToken = this.generateRefreshToken(newOwner, device);

  //   return {
  //     pengguna: {
  //       id: newOwner._id,
  //       nama: newOwner.nama,
  //       aksesType: newOwner.aksesType,
  //       role: newOwner.roleID.namaRole,
  //       status: newOwner.status,
  //     },
  //     accessToken,
  //     refreshToken,
  //   };
  // }

  async registerOwner(payload, tenantID) {
    const { pin, nama, deviceID, deviceType, aksesType } = payload;

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

    // Validasi: kalau ada "app", device wajib
    if (normalizedAksesType.includes("app") && !deviceID) {
      throw createError(400, "Device ID wajib jika aksesType mengandung 'app'");
    }

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

    const accessToken = this.generateToken(newOwner, device);
    const refreshToken = this.generateRefreshToken(newOwner, device);

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

  // async login({ nama, pin, tenantID, deviceID, deviceType, aksesType }) {
  //   const { pin, nama, deviceID, deviceType, aksesType } = payload;

  //   const requestAkses = payload.ak

  //   if (
  //     !requestAkses ||
  //     !Array.isArray(requestAkses) ||
  //     requestAkses.length !== 1
  //   ) {
  //     throw createError(400, "aksesType saat login harus satu (web atau app)");
  //   }

  //   const loginType = requestAkses[0];

  //   // FIX: filter wajib pakai nama dan tenantID agar tidak ambil data sembarangan
  //   const user = await Pengguna.findOne({ nama, tenantID }).populate(
  //     "roleID",
  //     "namaRole permissions",
  //   );
  //   if (!user) throw createError(401, "Nama atau PIN tidak ditemukan.");

  //   const isMatch = await user.comparePin(pin);
  //   if (!isMatch) throw createError(401, "Nama atau PIN salah.");

  //   let device = null;

  //   // if (user.aksesType.includes("app")) {
  //   if (Array.isArray(user.aksesType) && user.aksesType.includes("app")) {
  //     // if (user.aksesType === "app") {
  //     if (!deviceID) throw createError(400, "Device ID wajib disertakan.");

  //     device = user.device.find((d) => d.deviceID === deviceID);

  //     if (device) {
  //       // Device sudah terdaftar — update tokenVersion dan lastUsed
  //       device.tokenVersion = Date.now();
  //       device.lastUsed = new Date(); // FIX: lastUsed bukan lastLogin
  //     } else {
  //       // Device baru — cek kuota
  //       if (user.device.length >= user.maxDevice) {
  //         throw createError(
  //           403,
  //           "Kuota perangkat penuh. Hapus perangkat lama terlebih dahulu.",
  //         );
  //       }
  //       user.device.push({
  //         deviceID,
  //         type:
  //           deviceType || (user.device.length === 0 ? "primary" : "secondary"),
  //         tokenVersion: Date.now(),
  //         lastUsed: new Date(), // FIX: lastUsed bukan lastLogin
  //       });
  //       user.deviceHistory.push({
  //         deviceID,
  //         type: deviceType || "secondary",
  //         action: "added",
  //       });
  //       device = user.device[user.device.length - 1];
  //     }

  //     user.markModified("device");
  //     user.markModified("deviceHistory");
  //   } else {
  //     // Pengguna web — update tokenVersion di root
  //     user.tokenVersion = Date.now();
  //   }

  //   await user.save();
  //   await this.clearCache(tenantID, user._id);
  //   await redis.del(`auth:pengguna:${user._id}`);

  //   const accessToken = this.generateToken(user, device);
  //   const refreshToken = this.generateRefreshToken(user, device);

  //   return {
  //     pengguna: {
  //       id: user._id,
  //       nama: user.nama,
  //       aksesType: user.aksesType,
  //       role: user.roleID?.namaRole || null,
  //       status: user.status,
  //     },
  //     accessToken,
  //     refreshToken,
  //   };
  // }

  async login({ nama, pin, tenantID, deviceID, deviceType, aksesType }) {
    // NORMALISASI: terima string atau array
    const normalizedAksesType = Array.isArray(aksesType)
      ? aksesType
      : aksesType
        ? [aksesType]
        : [];

    // VALIDASI: harus 1 (login context)
    if (normalizedAksesType.length !== 1) {
      throw createError(400, "aksesType saat login harus satu (web atau app)");
    }

    const loginType = normalizedAksesType[0];

    // VALIDASI nilai
    if (!["web", "app"].includes(loginType)) {
      throw createError(400, "aksesType tidak valid");
    }

    // Ambil user
    const user = await Pengguna.findOne({ nama, tenantID }).populate(
      "roleID",
      "namaRole permissions",
    );
    if (!user) throw createError(401, "Nama atau PIN salah.");

    const isMatch = await user.comparePin(pin);
    if (!isMatch) throw createError(401, "Nama atau PIN salah.");

    // VALIDASI akses user
    if (!Array.isArray(user.aksesType) || !user.aksesType.includes(loginType)) {
      throw createError(403, "Akses tidak diizinkan untuk pengguna ini.");
    }

    const now = Date.now();
    let device = null;

    if (loginType === "app") {
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
    await redis.del(`auth:pengguna:${user._id}`);

    const accessToken = this.generateToken(user, device);
    const refreshToken = this.generateRefreshToken(user, device);

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
    try {
      const decoded = jwt.verify(token, PENGGUNA_REFRESH_TOKEN);
      const user = await Pengguna.findById(decoded.id);

      if (!user) throw createError(401, "Pengguna tidak ditemukan.");

      let device = null;
      if (user.aksesType === "app") {
        device = user.device.find((d) => d.deviceID === decoded.deviceID);
        if (!device || device.tokenVersion !== decoded.version) {
          throw createError(401, "Sesi perangkat tidak valid.");
        }

        // ✅ Rotate tokenVersion per device
        device.tokenVersion = Date.now();
        device.lastUsed = new Date();
        user.markModified("device");
      } else {
        if (user.tokenVersion !== decoded.version) {
          throw createError(401, "Sesi tidak valid.");
        }

        user.tokenVersion = Date.now();
      }

      await user.save();
      await this.clearCache(user.tenantID, user._id); // ✅ invalidate cache

      const accessToken = this.generateToken(user, device);
      const newRefreshToken = this.generateRefreshToken(user, device);

      return { accessToken, newRefreshToken };
    } catch (err) {
      if (createError.isHttpError(err)) throw err; // ✅ jangan wrap error yang sudah HTTP
      throw createError(401, "Refresh token tidak valid atau kedaluwarsa.");
    }
  }

  async logout(token) {
    try {
      const decoded = jwt.verify(token, PENGGUNA_REFRESH_TOKEN);
      const user = await Pengguna.findById(decoded.id);
      if (!user) return;

      if (user.aksesType === "app") {
        const device = user.device.find((d) => d.deviceID === decoded.deviceID);
        if (device) {
          device.tokenVersion += 1;
        }
      } else {
        user.tokenVersion += 1;
      }

      await user.save();
      await this.clearCache(user.tenantID, user._id);
    } catch (err) {
      return;
    }
  }

  // CACHE HELPERS
  // async clearCache(tenantID, id = null) {
  //   const keys = [KEY_LIST(tenantID), KEY_LOGIN_LIST(tenantID)];
  //   if (id) keys.push(KEY_DETAIL(id));

  //   await Promise.all(keys.map((key) => redis.del(key)));
  // }

  async clearCache(tenantID, id = null) {
    const keys = [KEY_LIST(tenantID), KEY_LOGIN_LIST(tenantID)];
    if (id) {
      keys.push(KEY_DETAIL(id));
      // [PERBAIKAN MUTLAK]: Wajib menghapus cache sesi auth milik middleware!
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
      .select("-pin -pin -__v")
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
      .select("-pin -pin -__v")
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

  // async create(payload, tenantID) {
  //   validatePenggunaPayload(payload);
  //   const { roleID, deviceID, deviceType, aksesType } = payload;

  //   const existing = await Pengguna.findOne({ tenantID, nama: payload.nama });
  //   if (existing) throw createError(400, "nama sudah digunakan ini.");

  //   const roleExists = await Role.findById(roleID);
  //   if (!roleExists) throw createError(404, "Role tidak ditemukan.");

  //   const newUser = new Pengguna({
  //     ...payload,
  //     tenantID,
  //     tokenVersion: Date.now(),
  //   });

  //   const normalizedAksesType = Array.isArray(aksesType)
  //     ? aksesType
  //     : [aksesType];

  //   // if (aksesType === "app") {
  //   if (normalizedAksesType.includes("app")) {
  //     if (!deviceID) {
  //       throw createError(
  //         400,
  //         "deviceID wajib jika aksesType mengandung 'app'",
  //       );
  //     }
  //     const newDeviceObj = {
  //       deviceID,
  //       type: deviceType || "primary", // Karena ini pengguna biasa/karyawan, default-nya secondary/tergantung skema Anda
  //       tokenVersion: Date.now(),
  //       lastUsed: new Date(),
  //     };
  //     newUser.device.push(newDeviceObj);
  //     newUser.deviceHistory.push({
  //       deviceID,
  //       type: newDeviceObj.type,
  //       action: "added",
  //     });
  //   }

  //   await newUser.save();
  //   newUser.aksesType = normalizedAksesType;
  //   await newUser.populate("roleID", "namaRole");

  //   return {
  //     pengguna: {
  //       id: newUser._id,
  //       nama: newUser.nama,
  //       role: newUser.roleID.namaRole,
  //       status: newUser.status,
  //       fotoKaryawan: newUser.fotoKaryawan || null,
  //       aksesType: newUser.aksesType,
  //     },
  //   };
  // }

  async create(payload, tenantID) {
    validatePenggunaPayload(payload);

    const { roleID, deviceID, deviceType, aksesType } = payload;

    const existing = await Pengguna.findOne({ tenantID, nama: payload.nama });
    if (existing) throw createError(400, "nama sudah digunakan ini.");

    const roleExists = await Role.findById(roleID);
    if (!roleExists) throw createError(404, "Role tidak ditemukan.");

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
      lastLogin: null,
    });

    await user.save();
    await this.clearCache(tenantID, id);
    return user.device;
  }
}

module.exports = new PenggunaService();
