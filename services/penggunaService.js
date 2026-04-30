// const Pengguna = require("../models/penggunaModel");
// const Role = require("../models/roleModel");
// const jwt = require("jsonwebtoken");
// const redis = require("../config/redis");
// const { validatePenggunaPayload } = require("../validators/penggunaValidator");
// const { validateDeviceAction } = require("../validators/akunValidator");
// const createError = require("http-errors");

// const PENGGUNA_ACCESS_TOKEN =
//   process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";
// const PENGGUNA_REFRESH_TOKEN =
//   process.env.PENGGUNA_JWT_REFRESH_SECRET || "pengguna_refresh_secret";

// const KEY_LIST = (tenantID) => `pengguna:list:${tenantID}`;
// const KEY_DETAIL = (id) => `pengguna:detail:${id}`;
// const KEY_LOGIN_LIST = (tenantID) => `pengguna:login-screen:${tenantID}`;

// class PenggunaService {
//   // TOKEN GENERATORS

//   // Generate Access Token
//   // Untuk pengguna app: sertakan deviceID dan version dari device
//   // Untuk pengguna web: version dari tokenVersion root
//   generateToken(pengguna, device = null) {
//     const payload = {
//       id: pengguna._id,
//       tenantID: pengguna.tenantID,
//       roleID: pengguna.roleID._id || pengguna.roleID,
//       aksesType: pengguna.aksesType,
//     };

//     if (pengguna.aksesType === "app" && device) {
//       payload.deviceID = device.deviceID;
//       payload.version = device.tokenVersion;
//     } else {
//       payload.version = pengguna.tokenVersion;
//     }

//     return jwt.sign(payload, PENGGUNA_ACCESS_TOKEN, { expiresIn: "12h" });
//   }

//   // Generate Refresh Token
//   generateRefreshToken(pengguna, device = null) {
//     const payload = {
//       id: pengguna._id,
//       tenantID: pengguna.tenantID,
//       aksesType: pengguna.aksesType,
//     };

//     if (pengguna.aksesType === "app" && device) {
//       payload.deviceID = device.deviceID;
//       payload.version = device.tokenVersion;
//     } else {
//       payload.version = pengguna.tokenVersion;
//     }

//     return jwt.sign(payload, PENGGUNA_REFRESH_TOKEN, { expiresIn: "7d" });
//   }

//   async clearCache(tenantID, userID) {
//     const keys = [KEY_LIST(tenantID), KEY_LOGIN_LIST(tenantID)];
//     if (userID) keys.push(KEY_DETAIL(userID));
//     await redis.del(keys);
//   }

//   // REGISTER OWNER
//   async registerOwner(payload, tenantID) {
//     // 1. Cek Eksistensi & Role
//     const existingUser = await Pengguna.findOne({ tenantID });
//     if (existingUser)
//       throw createError(400, "Owner sudah terdaftar untuk tenant ini.");

//     const ownerRole = await Role.findOne({ tenantID, namaRole: "Owner" });
//     if (!ownerRole) throw createError(500, "Role Owner tidak ditemukan.");

//     // 2. Siapkan Payload Dasar
//     const { nama, pin, deviceID, deviceType = "primary" } = payload;
//     const aksesType = payload.aksesType || "app";

//     const ownerData = {
//       nama,
//       pin,
//       aksesType,
//       roleID: ownerRole._id,
//       tenantID,
//       deviceID,
//       tokenVersion: Date.now(),
//     };

//     const validation = validatePenggunaPayload(ownerData);
//     if (!validation.valid) throw createError(400, validation.errors[0]);

//     // 4. Create User
//     const user = await Pengguna.create(ownerData);
//     let device = null;

//     // 5. Logika Perangkat (Hanya jika app)
//     if (user.aksesType === "app") {
//       const newDeviceObj = {
//         deviceID,
//         type: deviceType,
//         tokenVersion: Date.now(),
//         lastUsed: new Date(),
//       };

//       user.device.push(newDeviceObj);
//       user.deviceHistory.push({ deviceID, type: deviceType, action: "added" });

//       await user.save();
//       device = user.device[user.device.length - 1];
//     }

//     await user.populate("roleID", "namaRole");
//     await this.clearCache(tenantID);

//     // 6. Transformasi Output (KONSISTEN)
//     const userObj = user.toObject({ minimize: false });

//     // Keamanan: Hapus PIN dan data internal
//     delete userObj.pin;
//     delete userObj.__v;

//     // Sesuaikan role agar mengembalikan string namaRole
//     userObj.role = user.roleID.namaRole;

//     return {
//       accessToken: this.generateToken(user, device),
//       refreshToken: this.generateRefreshToken(user, device),
//       user: userObj,
//     };
//   }

//   // LOGIN PIN
//   async login({ nama, pin, tenantID, deviceID, deviceType }) {
//     const pengguna = await Pengguna.findOne({
//       nama,
//       tenantID,
//     }).populate("roleID", "namaRole");

//     if (!pengguna) throw createError(404, "Pengguna tidak ditemukan");

//     const isMatch = await pengguna.comparePin(pin);
//     if (!isMatch) throw createError(400, "PIN salah");

//     let device = null;

//     if (pengguna.aksesType === "app") {
//       // Pengguna app WAJIB menyertakan deviceID
//       if (!deviceID) {
//         throw createError(
//           400,
//           "Device ID wajib disertakan untuk login via aplikasi.",
//         );
//       }

//       device = pengguna.device.find((d) => d.deviceID === deviceID);
//       const newTokenVersion = Date.now();

//       if (device) {
//         // Device sudah terdaftar — update tokenVersion dan lastUsed
//         device.tokenVersion = newTokenVersion;
//         device.lastUsed = new Date();
//       } else {
//         // Device baru — cek kuota
//         if (pengguna.device.length >= pengguna.maxDevice) {
//           throw createError(
//             403,
//             "Kuota perangkat penuh. Harap hapus perangkat lama terlebih dahulu.",
//           );
//         }

//         const newDeviceObj = {
//           deviceID,
//           type:
//             deviceType ||
//             (pengguna.device.length === 0 ? "primary" : "secondary"),
//           tokenVersion: newTokenVersion,
//           lastUsed: new Date(),
//         };

//         pengguna.device.push(newDeviceObj);
//         pengguna.deviceHistory.push({
//           deviceID,
//           type: newDeviceObj.type,
//           action: "added",
//         });

//         device = pengguna.device[pengguna.device.length - 1];
//       }

//       pengguna.markModified("device");
//       pengguna.markModified("deviceHistory");
//     } else {
//       // Pengguna web — tidak perlu device, update tokenVersion di root
//       pengguna.tokenVersion = Date.now();
//     }

//     await pengguna.save();
//     await this.clearCache(tenantID, pengguna._id);

//     const accessToken = this.generateToken(pengguna, device);
//     const refreshToken = this.generateRefreshToken(pengguna, device);

//     const userObj = pengguna.toObject({ minimize: false });
//     delete userObj.pin;
//     delete userObj.__v;
//     userObj.role = userObj.roleID.namaRole;
//     delete userObj.roleID;

//     return {
//       token: accessToken,
//       refreshToken,
//       user: userObj,
//     };
//   }

//   // REFRESH TOKEN
//   async refreshToken(oldRefreshToken) {
//     if (!oldRefreshToken)
//       throw createError(401, "Refresh Token tidak ditemukan");

//     let decoded;
//     try {
//       decoded = jwt.verify(oldRefreshToken, PENGGUNA_REFRESH_TOKEN);
//     } catch (err) {
//       throw createError(403, "Refresh Token tidak valid atau kadaluwarsa");
//     }

//     const user = await Pengguna.findById(decoded.id).populate(
//       "roleID",
//       "namaRole",
//     );

//     // Fix bug 1: Ubah 404 menjadi 401 untuk standar keamanan sesi
//     if (!user) {
//       throw createError(401, "Pengguna tidak ditemukan. Sesi tidak valid.");
//     }

//     // Fix bug 2: Cegah Fatal Crash akibat Orphan Data
//     if (!user.roleID) {
//       throw createError(
//         403,
//         "Akses ditolak. Role pengguna telah dihapus oleh sistem.",
//       );
//     }

//     // Validasi tenantID
//     if (!user.tenantID || user.tenantID.toString() !== decoded.tenantID) {
//       throw createError(401, "Token tidak valid untuk tenant ini.");
//     }

//     let device = null;

//     if (user.aksesType === "app") {
//       // Pengguna app — validasi device dan tokenVersion per device
//       if (!decoded.deviceID) {
//         throw createError(401, "Device ID tidak ditemukan pada token.");
//       }

//       device = user.device.find((d) => d.deviceID === decoded.deviceID);
//       if (!device) {
//         throw createError(
//           401,
//           "Perangkat tidak dikenali. Silakan login ulang.",
//         );
//       }

//       if (
//         device.tokenVersion !== decoded.version ||
//         device.tokenVersion === 0
//       ) {
//         throw createError(401, "Sesi kedaluwarsa. Silakan login ulang.");
//       }

//       // Rotate tokenVersion per device
//       device.tokenVersion = Date.now();
//       device.lastUsed = new Date();
//       user.markModified("device");
//     } else {
//       // Pengguna web — validasi tokenVersion di root
//       if (user.tokenVersion !== decoded.version || user.tokenVersion === 0) {
//         throw createError(401, "Sesi tidak valid. Silakan login kembali.");
//       }

//       // Rotate tokenVersion root
//       user.tokenVersion = Date.now();
//     }

//     await user.save();
//     await this.clearCache(user.tenantID, user._id);

//     return {
//       accessToken: this.generateToken(user, device),
//       refreshToken: this.generateRefreshToken(user, device),
//     };
//   }

//   // LOGOUT (PENCABUTAN SESI)
//   async logout(oldRefreshToken) {
//     if (!oldRefreshToken) return;
//     try {
//       const decoded = jwt.verify(oldRefreshToken, PENGGUNA_REFRESH_TOKEN);
//       const user = await Pengguna.findById(decoded.id);

//       if (user) {
//         if (user.aksesType === "app" && decoded.deviceID) {
//           const device = user.device.find((d) => d.deviceID === decoded.deviceID);
//           if (device) {
//             device.tokenVersion = 0; // Bunuh sesi device ini
//             user.markModified("device");
//           }
//         } else {
//           user.tokenVersion = 0; // Bunuh sesi web
//         }
//         await user.save();
//         await this.clearCache(user.tenantID, user._id);
//       }
//     } catch (ignore) {
//       // Abaikan jika token memang sudah kedaluwarsa/tidak valid
//     }
//   }

//   // DEVICE MANAGEMENT (hanya untuk aksesType "app")

//   async addDevice(penggunaID, tenantID, payload) {
//     const validation = validateDeviceAction(payload);
//     if (!validation.valid) throw createError(400, validation.errors[0]);

//     const { deviceID, type } = payload;
//     const user = await Pengguna.findOne({ _id: penggunaID, tenantID });
//     if (!user) throw createError(404, "Pengguna tidak ditemukan.");

//     if (user.aksesType !== "app") {
//       throw createError(
//         400,
//         "Device management hanya tersedia untuk pengguna tipe app.",
//       );
//     }

//     if (user.device.some((d) => d.deviceID === deviceID)) {
//       throw createError(400, "Device ID sudah terdaftar.");
//     }

//     if (user.device.length >= user.maxDevice) {
//       throw createError(403, "Kuota perangkat penuh.");
//     }

//     const finalType =
//       user.device.length === 0 ? "primary" : type || "secondary";
//     const newDevice = {
//       deviceID,
//       type: finalType,
//       tokenVersion: 0,
//       lastUsed: new Date(),
//     };

//     user.device.push(newDevice);
//     user.deviceHistory.push({ deviceID, type: finalType, action: "added" });

//     user.markModified("device");
//     user.markModified("deviceHistory");
//     await user.save();
//     await redis.del(KEY_DETAIL(penggunaID));

//     return user.device;
//   }

//   async promoteDevice(penggunaID, tenantID, deviceID) {
//     const user = await Pengguna.findOne({ _id: penggunaID, tenantID });
//     if (!user) throw createError(404, "Pengguna tidak ditemukan.");

//     const device = user.device.find((d) => d.deviceID === deviceID);
//     if (!device) throw createError(404, "Perangkat tidak ditemukan.");

//     const currentPrimary = user.device.filter(
//       (d) => d.type === "primary",
//     ).length;
//     if (currentPrimary >= user.maxPrimaryDevice) {
//       throw createError(400, "Slot primary device penuh.");
//     }

//     device.type = "primary";
//     user.deviceHistory.push({ deviceID, type: "primary", action: "promoted" });

//     user.markModified("device");
//     await user.save();
//     await redis.del(KEY_DETAIL(penggunaID));

//     return device;
//   }

//   async demoteDevice(penggunaID, tenantID, deviceID) {
//     const user = await Pengguna.findOne({ _id: penggunaID, tenantID });
//     if (!user) throw createError(404, "Pengguna tidak ditemukan.");

//     const device = user.device.find((d) => d.deviceID === deviceID);
//     if (!device) throw createError(404, "Perangkat tidak ditemukan.");

//     device.type = "secondary";
//     user.deviceHistory.push({ deviceID, type: "secondary", action: "demoted" });

//     user.markModified("device");
//     await user.save();
//     await redis.del(KEY_DETAIL(penggunaID));

//     return device;
//   }

//   async removeDevice(penggunaID, tenantID, deviceID) {
//     const user = await Pengguna.findOne({ _id: penggunaID, tenantID });
//     if (!user) throw createError(404, "Pengguna tidak ditemukan.");

//     const index = user.device.findIndex((d) => d.deviceID === deviceID);
//     if (index === -1) throw createError(404, "Perangkat tidak ditemukan.");

//     const deviceType = user.device[index].type;
//     user.device.splice(index, 1);
//     user.deviceHistory.push({ deviceID, type: deviceType, action: "removed" });

//     user.markModified("device");
//     user.markModified("deviceHistory");
//     await user.save();
//     await redis.del(KEY_DETAIL(penggunaID));

//     return true;
//   }

//   async getDeviceHistory(penggunaID, tenantID) {
//     const user = await Pengguna.findOne({ _id: penggunaID, tenantID })
//       .select("deviceHistory aksesType")
//       .lean();

//     if (!user) throw createError(404, "Pengguna tidak ditemukan.");
//     if (user.aksesType !== "app") {
//       throw createError(400, "Pengguna web tidak memiliki riwayat perangkat.");
//     }

//     return user.deviceHistory || [];
//   }

//   // CRUD

//   async getForLoginScreen(tenantID) {
//     const safeTenantID = String(tenantID);
//     const cached = await redis.get(KEY_LOGIN_LIST(safeTenantID));
//     if (cached) return JSON.parse(cached);

//     const users = await Pengguna.find({
//       tenantID: safeTenantID,
//       status: "aktif",
//     })
//       .select("_id nama roleID tenantID fotoKaryawan aksesType")
//       .populate("roleID", "namaRole")
//       .lean();

//     await redis.set(
//       KEY_LOGIN_LIST(safeTenantID),
//       JSON.stringify(users),
//       "EX",
//       300,
//     );
//     return users;
//   }

//   async getAll(tenantID) {
//     const cached = await redis.get(KEY_LIST(tenantID));
//     if (cached) return JSON.parse(cached);

//     const users = await Pengguna.find({ tenantID })
//       .select("-pin -__v") // Langsung buang __v di query
//       .populate("roleID", "namaRole")
//       .lean();

//     const formattedUsers = users.map(u => {
//       u.role = u.roleID?.namaRole || "No Role";
//       delete u.roleID;
//       return u;
//     });

//     await redis.set(KEY_LIST(tenantID), JSON.stringify(formattedUsers), "EX", 60);
//     return formattedUsers;
//   }

//   async getById(id, tenantID) {
//     const cached = await redis.get(KEY_DETAIL(id));
//     if (cached) {
//       const parsed = JSON.parse(cached);
//       if (parsed.tenantID !== tenantID.toString())
//         throw createError(403, "Akses ditolak");
//       return parsed;
//     }

//     const user = await Pengguna.findOne({ _id: id, tenantID })
//       .select("-pin -__v") // Langsung buang __v
//       .populate("roleID", "namaRole")
//       .lean();

//     if (!user) throw createError(404, "Pengguna tidak ditemukan");

//     // FIX: Ratakan objek roleID
//     user.role = user.roleID?.namaRole || "No Role";
//     delete user.roleID;

//     await redis.set(KEY_DETAIL(id), JSON.stringify(user), "EX", 60);
//     return user;
//   }

//   async create(payload, tenantID) {
//     payload.tenantID = tenantID;
//     payload.tokenVersion = Date.now();

//     const validation = validatePenggunaPayload(payload);
//     if (!validation.valid) throw createError(400, validation.errors[0]);

//     const roleExists = await Role.findOne({ _id: payload.roleID, tenantID });
//     if (!roleExists) throw createError(404, "Jabatan (Role) tidak ditemukan.");

//     if (roleExists.namaRole === "Owner") {
//       const existingOwner = await Pengguna.findOne({
//         tenantID,
//         roleID: roleExists._id,
//       });
//       if (existingOwner) {
//         throw createError(
//           400,
//           "Role Owner hanya boleh dimiliki oleh 1 pengguna.",
//         );
//       }
//     }

//     const user = await Pengguna.create(payload);
//     await user.populate("roleID", "namaRole");
//     await this.clearCache(tenantID);

//     const userObj = user.toObject({ minimize: false });
//     delete userObj.pin;
//     delete userObj.__v;
//     userObj.role = userObj.roleID.namaRole;
//     delete userObj.roleID;

//     return userObj;

//     return user;
//   }

//   async update(id, payload, tenantID) {
//     delete payload.tenantID;

//     const validation = validatePenggunaPayload(payload, true);
//     if (!validation.valid) throw createError(400, validation.errors[0]);

//     if (payload.roleID) {
//       const roleExists = await Role.findOne({ _id: payload.roleID, tenantID });
//       if (!roleExists) throw createError(404, "Jabatan tidak ditemukan.");

//       if (roleExists.namaRole === "Owner") {
//         const existingOwner = await Pengguna.findOne({
//           tenantID,
//           roleID: roleExists._id,
//           _id: { $ne: id },
//         });
//         if (existingOwner) {
//           throw createError(
//             400,
//             "Role Owner sudah digunakan oleh pengguna lain.",
//           );
//         }
//       }
//     }

//     const user = await Pengguna.findOne({ _id: id, tenantID });
//     if (!user) throw createError(404, "Pengguna tidak ditemukan");

//     Object.assign(user, payload);
//     const updated = await user.save();
//     await updated.populate("roleID", "namaRole");

//     const userObj = updated.toObject({ minimize: false });
//     delete userObj.pin;
//     delete userObj.__v;
//     userObj.role = userObj.roleID.namaRole;
//     delete userObj.roleID;

//     return userObj;

//     await this.clearCache(tenantID, id);
//     return updated;
//   }

//   async delete(id, tenantID) {
//     const user = await Pengguna.findOne({ _id: id, tenantID }).populate(
//       "roleID",
//     );
//     if (!user) throw createError(404, "Pengguna tidak ditemukan");

//     if (user.roleID.namaRole === "Owner") {
//       throw createError(403, "Role Owner tidak dapat dihapus.");
//     }

//     await user.deleteOne();
//     await this.clearCache(tenantID, id);
//     return true;
//   }

//   async checkOwnerExists(tenantID) {
//     const ownerRole = await Role.findOne({ tenantID, namaRole: "Owner" });
//     if (!ownerRole) return false;
//     const owner = await Pengguna.findOne({ tenantID, roleID: ownerRole._id });
//     return !!owner;
//   }
// }

// module.exports = new PenggunaService();

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

  // AUTH LOGIC
  // async registerOwner(payload, tenantID) {
  //   const {  pin, nama, deviceID } = payload;

  //   const roleOwner = await Role.findOne({ namaRole: "Owner" });
  //   if (!roleOwner) throw createError(404, "Role Owner tidak ditemukan.");

  //   const existingOwner = await Pengguna.findOne({
  //     tenantID,
  //     roleID: roleOwner._id,
  //   });
  //   if (existingOwner) throw createError(400, "Owner sudah terdaftar.");

  //   const newOwner = new Pengguna({
  //     tenantID,
  //     pin,
  //     nama,
  //     roleID: roleOwner._id,
  //     aksesType: "web",
  //     deviceID,
  //   });

  //   await newOwner.save();
  //   await this.clearCache(tenantID);

  //   if (user.aksesType === "app") {
  //     if (!deviceID) throw createError(400, "Device ID wajib disertakan.");
  //     device.lastLogin = new Date();
  //     await user.save();
  //   }

  //   const accessToken = this.generateToken(newOwner);
  //   const refreshToken = this.generateRefreshToken(newOwner);

  //   return {
  //     id: newOwner._id,
  //     nama: newOwner.nama,
  //     aksesType: newOwner.aksesType,
  //     accessToken,
  //     refreshToken,
  //   };
  // }

  async registerOwner(payload, tenantID) {
    const { pin, nama, deviceID, deviceType, aksesType } = payload;

    // validasi ini masih perlu perbaikan
    const roleOwner = await Role.findOne({ tenantID, namaRole: "Owner" });
    if (!roleOwner) throw createError(404, "Role Owner tidak ditemukan.");

    const existingOwner = await Pengguna.findOne({
      tenantID,
      roleID: roleOwner._id,
    });
    if (existingOwner) throw createError(400, "Owner sudah terdaftar.");

    // Tentukan aksesType: default "app" kalau tidak dikirim
    const resolvedAksesType = aksesType || "app";

    // Kalau aksesType "app", deviceID wajib ada
    if (resolvedAksesType === "app" && !deviceID) {
      throw createError(
        400,
        "Device ID wajib disertakan untuk Owner via aplikasi.",
      );
    }

    const newOwner = new Pengguna({
      tenantID,
      pin,
      nama,
      roleID: roleOwner._id,
      aksesType: resolvedAksesType,
      tokenVersion: Date.now(),
    });

    // Kalau aksesType "app", daftarkan device pertama langsung
    let device = null;
    if (resolvedAksesType === "app") {
      const newDeviceObj = {
        deviceID,
        type: deviceType || "primary",
        tokenVersion: Date.now(),
        lastUsed: new Date(),
      };
      newOwner.device.push(newDeviceObj);
      newOwner.deviceHistory.push({
        deviceID,
        type: newDeviceObj.type,
        action: "added",
      });
      device = newOwner.device[newOwner.device.length - 1];
    }

    await newOwner.save();
    await newOwner.populate("roleID", "namaRole");
    await this.clearCache(tenantID, newOwner._id);

    // await redis.del(`auth:pengguna:${newOwner._id}`);

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

  // async login( pin, deviceID = null, deviceName = null) {
  //   const user = await Pengguna.findOne({ }).populate(
  //     "roleID",
  //     "namaRole permissions",
  //   );
  //   if (!user) throw createError(401, "Email atau pin salah.");

  //   const isMatch = await user.comparePin(pin);
  //   if (!isMatch) throw createError(401, "Email atau pin salah.");

  //   let device = null;
  //   if (user.aksesType === "app") {
  //     if (!deviceID) throw createError(400, "Device ID wajib disertakan.");

  //     device = user.device.find((d) => d.deviceID === deviceID);

  //     if (!device) {
  //       user.device.push({
  //         deviceID,
  //         deviceName: deviceName || "Unknown Device",
  //         type: "secondary",
  //         tokenVersion: 0,
  //       });
  //       device = user.device[user.device.length - 1];
  //     }

  //     device.lastLogin = new Date();
  //     await user.save();
  //   }

  //   const accessToken = this.generateToken(user, device);
  //   const refreshToken = this.generateRefreshToken(user, device);

  //   const userObj = user.toObject({ minimize: false });
  //   delete userObj.pin;
  //   delete userObj.pin;
  //   delete userObj.__v;
  //   userObj.role = userObj.roleID.namaRole;
  //   userObj.permissions = userObj.roleID.permissions;

  //   return {
  //     accessToken, // perbaikan: kunci diselaraskan dengan controller
  //     refreshToken,
  //     pengguna: userObj, // perbaikan: kunci diselaraskan dengan controller
  //   };
  // }

  async login({ nama, pin, tenantID, deviceID = null, deviceType = null }) {
    // FIX: filter wajib pakai nama dan tenantID agar tidak ambil data sembarangan
    const user = await Pengguna.findOne({ nama, tenantID }).populate(
      "roleID",
      "namaRole permissions",
    );
    if (!user) throw createError(401, "Nama atau PIN salah.");

    const isMatch = await user.comparePin(pin);
    if (!isMatch) throw createError(401, "Nama atau PIN salah.");

    let device = null;

    if (user.aksesType === "app") {
      if (!deviceID) throw createError(400, "Device ID wajib disertakan.");

      device = user.device.find((d) => d.deviceID === deviceID);

      if (device) {
        // Device sudah terdaftar — update tokenVersion dan lastUsed
        device.tokenVersion = Date.now();
        device.lastUsed = new Date(); // FIX: lastUsed bukan lastLogin
      } else {
        // Device baru — cek kuota
        if (user.device.length >= user.maxDevice) {
          throw createError(
            403,
            "Kuota perangkat penuh. Hapus perangkat lama terlebih dahulu.",
          );
        }
        user.device.push({
          deviceID,
          type:
            deviceType || (user.device.length === 0 ? "primary" : "secondary"),
          tokenVersion: Date.now(),
          lastUsed: new Date(), // FIX: lastUsed bukan lastLogin
        });
        user.deviceHistory.push({
          deviceID,
          type: deviceType || "secondary",
          action: "added",
        });
        device = user.device[user.device.length - 1];
      }

      user.markModified("device");
      user.markModified("deviceHistory");
    } else {
      // Pengguna web — update tokenVersion di root
      user.tokenVersion = Date.now();
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

  async create(payload, tenantID) {
    validatePenggunaPayload(payload);
    const { roleID, nama, aksesType, deviceID, deviceType } = payload;

    const existing = await Pengguna.findOne({ tenantID, nama: payload.nama });
    if (existing) throw createError(400, "nama sudah digunakan ini.");

    const roleExists = await Role.findById(roleID);
    if (!roleExists) throw createError(404, "Role tidak ditemukan.");

    // if (roleExists.namaRole === "owner") {
    //   const ownerExists = await Pengguna.findOne({ tenantID, roleID });
    //   if (ownerExists)
    //     throw createError(400, "Tenant ini sudah memiliki Owner.");
    // }

    const newUser = new Pengguna({
      ...payload,
      tenantID,
      aksesType,
      tokenVersion: Date.now(),
    });

    if (aksesType === "app") {
      const newDeviceObj = {
        deviceID,
        type: deviceType || "primary", // Karena ini pengguna biasa/karyawan, default-nya secondary/tergantung skema Anda
        tokenVersion: Date.now(),
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

    // return {
    //   id: newUser._id,
    //   nama: newUser.nama,
    //   role: newUser.roleID.namaRole,
    //   status: newUser.status,
    //   fotoKaryawan: newUser.fotoKaryawan || null,
    //   aksesType: newUser.aksesType,
    // };

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
