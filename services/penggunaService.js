const Pengguna = require("../models/penggunaModel");
const Role = require("../models/roleModel");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");
const { validatePenggunaPayload } = require("../validators/penggunaValidator");

const mongoose = require("mongoose");
const crypto = require("crypto");
const Device = require("../models/deviceModel");
const { DEVICE_STATUS } = require("../config/constants");
// Asumsi Anda menggunakan utility createError
// const createError = require("../utils/createError");

const createError = require("http-errors");

// const PENGGUNA_ACCESS_TOKEN =
//   process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";
// const PENGGUNA_REFRESH_TOKEN =
//   process.env.PENGGUNA_JWT_REFRESH_SECRET || "pengguna_refresh_secret";

const KEY_LIST = (tenantID) => `pengguna:list:${tenantID}`;
const KEY_DETAIL = (id) => `pengguna:detail:${id}`;
const KEY_LOGIN_LIST = (tenantID) => `pengguna:login-screen:${tenantID}`;

class PenggunaService {
  // TOKEN GENERATORS (BARU
  generateToken(pengguna, device = null, loginType) {
    const roleName =
      pengguna.roleID && typeof pengguna.roleID === "object"
        ? pengguna.roleID.namaRole
        : null;
    const rawPermissions =
      pengguna.roleID && typeof pengguna.roleID === "object"
        ? pengguna.roleID.permissions || []
        : [];

    // Mapping: Ekstrak HANYA string 'nama' agar JWT tetap ringan dan bisa dibaca oleh Sidebar frontend
    const permissions = rawPermissions.map((p) =>
      p && typeof p === "object" && p.nama ? p.nama : p,
    );

    const payload = {
      id: pengguna._id,
      // Memastikan hanya ID berupa string yang masuk ke properti tenantID
      tenantID: pengguna.tenantID?._id || pengguna.tenantID,
      tenantName: pengguna.tenantID?.namaToko || "Toko Tidak Diketahui",
      roleID: pengguna.roleID?._id || pengguna.roleID,
      role: roleName,
      permissions,
      aksesType: pengguna.aksesType,
      loginType,
    };

    if (loginType === "app" && device) {
      // Sesuai Roadmap: Gunakan installationId
      payload.installationId = device.installationId;
      // Untuk 'app', kita tidak lagi mengandalkan payload.version
      // karena validasi dilakukan via database status & refreshTokenHash
    } else {
      // Untuk 'web', tetap gunakan tokenVersion pada model Pengguna
      payload.version = pengguna.tokenVersion;
    }

    return jwt.sign(payload, process.env.PENGGUNA_ACCESS_TOKEN, {
      expiresIn: loginType === "web" ? "1h" : "1d",
    });
  }

  generateRefreshToken(pengguna, device = null, loginType) {
    if (loginType === "app") {
      // Sesuai Roadmap: Refresh Token untuk APP adalah Opaque Token (Random String)
      // Token mentah ini akan dikirim ke klien, dan Hash-nya disimpan di DB
      return crypto.randomBytes(40).toString("hex");
    }

    // Untuk WEB, kita tetap gunakan JWT Refresh Token agar kompatibel dengan sistem lama
    const payload = {
      id: pengguna._id,
      tenantID: pengguna.tenantID,
      aksesType: pengguna.aksesType,
      loginType,
      version: pengguna.tokenVersion,
    };

    return jwt.sign(payload, process.env.PENGGUNA_REFRESH_TOKEN, {
      expiresIn: "7d",
    });
  }

  // registerOwner (BARU)
  async registerOwner(payload, tenantID) {
    // 1. Ekstraksi Payload, buang deviceID dan deviceType, menggantinya dengan metadata lengkap
    const {
      pin,
      nama,
      aksesType,
      installationId,
      deviceName,
      appVersion,
      osVersion,
      ipAddress,
    } = payload;

    const normalizedAksesType = Array.isArray(aksesType)
      ? aksesType
      : [aksesType || "app"]; // default tetap app

    // Jika registrasi via App, installationId hukumnya wajib
    if (normalizedAksesType.includes("app") && !installationId) {
      throw createError(
        400,
        "installationId wajib untuk registrasi Owner via App.",
      );
    }

    // 2. Validasi Role & Unik Nama
    const roleOwner = await Role.findOne({ tenantID, namaRole: "Owner" });
    if (!roleOwner) throw createError(404, "Role Owner tidak ditemukan.");

    const existing = await Pengguna.findOne({ tenantID, nama });
    if (existing) throw createError(400, "Nama sudah digunakan.");

    const now = Date.now();

    // 3. Mulai Transaksi MongoDB (Atomic Operation)
    const session = await mongoose.startSession();
    session.startTransaction();

    let newOwner, device, rawRefreshToken;

    try {
      // A. Buat Pengguna
      newOwner = new Pengguna({
        nama,
        pin,
        tenantID,
        roleID: roleOwner._id,
        aksesType: normalizedAksesType,
        tokenVersion: now,
      });
      await newOwner.save({ session });
      await newOwner.populate([
        {
          path: "roleID",
          select: "namaRole permissions",
          populate: {
            path: "permissions",
            select: "nama",
          },
        },
        {
          path: "tenantID",
          select: "namaToko",
        },
      ]);

      rawRefreshToken = null;
      device = null;

      // B. Buat Device
      if (normalizedAksesType.includes("app")) {
        if (!process.env.REFRESH_SECRET) {
          throw new Error("REFRESH_SECRET belum dikonfigurasi.");
        }

        rawRefreshToken = crypto.randomBytes(40).toString("hex");
        const refreshTokenHash = crypto
          .createHmac("sha256", process.env.REFRESH_SECRET)
          .update(rawRefreshToken)
          .digest("hex");

        device = new Device({
          penggunaID: newOwner._id,
          installationId,
          status: DEVICE_STATUS.TRUSTED,
          refreshTokenHash,
          deviceName,
          platform: "app",
          appVersion,
          osVersion,
          lastIpAddress: ipAddress,
          lastSeenAt: new Date(),
          approvedBy: newOwner._id,
          approvedAt: new Date(),
        });
        await device.save({ session });
      }

      // Commit — hanya DB operation di dalam try-catch ini
      await session.commitTransaction();
    } catch (error) {
      // Hanya akan masuk sini jika operasi DB di atas yang gagal
      await session.abortTransaction();
      throw error;
    } finally {
      // endSession() selalu jalan, baik commit maupun abort
      session.endSession();
    }

    // Post-commit logic di LUAR try-catch session
    // Kalau ini throw, tidak akan trigger abortTransaction
    await this.clearCache(tenantID, newOwner._id);

    const loginType = "app";
    const accessToken = this.generateToken(newOwner, device, loginType);
    const refreshToken =
      rawRefreshToken || this.generateRefreshToken(newOwner, null, loginType);

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
      device: device
        ? {
            installationId: device.installationId,
            status: device.status,
          }
        : null,
    };
  }

  async loginPin({
    nama,
    pin,
    tenantID,
    loginType,
    installationId,
    deviceName,
    appVersion,
    osVersion,
    ipAddress,
  }) {
    // 1. Normalisasi Array loginType
    const normalizedLoginType = Array.isArray(loginType)
      ? loginType
      : loginType
        ? [loginType]
        : [];

    if (normalizedLoginType.length !== 1) {
      throw createError(
        400,
        "loginType saat login harus spesifik satu (web atau app)",
      );
    }

    const resolvedLoginType = normalizedLoginType[0];

    if (!["web", "app"].includes(resolvedLoginType)) {
      throw createError(400, "loginType tidak valid");
    }

    // 2. Autentikasi Kredensial Dasar
    // Melakukan Deep Populate untuk mengambil teks slug 'nama' dari koleksi Permission
    const user = await Pengguna.findOne({ nama, tenantID }).populate([
      {
        path: "roleID",
        select: "namaRole permissions",
        populate: {
          path: "permissions",
          select: "nama",
        },
      },
      {
        path: "tenantID",
        select: "namaToko",
      },
    ]);
    if (!user) throw createError(401, "Nama atau PIN salah.");

    const isMatch = await user.comparePin(pin);
    if (!isMatch) throw createError(401, "Nama atau PIN salah.");

    if (
      !Array.isArray(user.aksesType) ||
      !user.aksesType.includes(resolvedLoginType)
    ) {
      throw createError(403, "Akses tidak diizinkan untuk platform ini.");
    }

    const now = Date.now();
    // CABANG 1: LOGIN WEB (Dashboard / Admin PC
    if (resolvedLoginType === "web") {
      // Login Web tidak perlu Device Binding. Cukup gunakan JWT biasa dan tokenVersion.
      user.tokenVersion = now;
      await user.save();
      // await this.clearCache(tenantID, user._id); // Uncomment jika masih menggunakan Redis untuk cache user

      const accessToken = this.generateToken(user, null, "web");
      const refreshToken = this.generateRefreshToken(user, null, "web");

      // Setelah generate token baru, hapus cache lama
      const cacheKey = `auth:pengguna:${user._id}`;
      await redis.del(cacheKey);

      return {
        status: "success_web",
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
    // CABANG 2: LOGIN APP (Device Binding V1
    if (!installationId) {
      throw createError(
        400,
        "installationId wajib disertakan untuk login App.",
      );
    }

    // Cek apakah device sudah ada di koleksi terpisah
    let device = await Device.findOne({
      penggunaID: user._id,
      installationId,
    });

    if (device) {
      // Skenario A: Device Ditemukan (Sudah Pernah Login)
      if (device.status === DEVICE_STATUS.REVOKED) {
        throw createError(
          401,
          "Akses perangkat ini telah dicabut secara permanen.",
        );
      }

      if (
        device.status === DEVICE_STATUS.EXPIRED ||
        (device.status === DEVICE_STATUS.PENDING &&
          device.pendingExpiresAt < new Date())
      ) {
        // UX: Jika expired, hidupkan kembali menjadi pending (H+7) agar masuk antrean Owner lagi
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        device.status = DEVICE_STATUS.PENDING;
        device.pendingExpiresAt = nextWeek;
        await device.save();

        return { status: DEVICE_STATUS.PENDING, pengguna: user, device };
      }

      if (device.status === DEVICE_STATUS.PENDING) {
        return {
          success: false,
          code: "DEVICE_PENDING_APPROVAL",
          status: DEVICE_STATUS.PENDING,
          pengguna: user,
          device,
        };
      }

      if (device.status === DEVICE_STATUS.TRUSTED) {
        // Device sah. Eksekusi rotasi Refresh Token (Opaque Token HMAC SHA-256)
        if (!process.env.REFRESH_SECRET) {
          throw new Error("REFRESH_SECRET belum dikonfigurasi di Environment.");
        }

        const rawRefreshToken = crypto.randomBytes(40).toString("hex");
        const refreshTokenHash = crypto
          .createHmac("sha256", process.env.REFRESH_SECRET)
          .update(rawRefreshToken)
          .digest("hex");

        // Update Metadata & Hash
        device.refreshTokenHash = refreshTokenHash;
        device.lastSeenAt = new Date();
        device.lastIpAddress = ipAddress;

        await device.save();

        // Terbitkan JWT (Access Token) pendek
        const accessToken = this.generateToken(user, device, "app");

        return {
          status: DEVICE_STATUS.TRUSTED,
          pengguna: {
            id: user._id,
            nama: user.nama,
            aksesType: user.aksesType,
            role: user.roleID?.namaRole || null,
            status: user.status,
          },
          accessToken,
          refreshToken: rawRefreshToken, // Kirim token mentah ke klien, BUKAN hash-nya
          device,
        };
      }
    } else {
      // Skenario B: Device Tidak Ditemukan (Instalasi Baru)
      // Wajib menggunakan MongoDB Transaction untuk mencegah Race Condition.
      const session = await mongoose.startSession();
      session.startTransaction();

      let newDevice, rawRefreshToken, accessToken;

      try {
        const maxDevices = parseInt(process.env.MAX_DEVICES_PER_USER, 10) || 3;

        // Hitung kuota yang aktif secara presisi
        const activeDeviceCount = await Device.countDocuments({
          penggunaID: user._id,
          $or: [
            { status: DEVICE_STATUS.TRUSTED },
            {
              status: DEVICE_STATUS.PENDING,
              pendingExpiresAt: { $gt: new Date() },
            },
          ],
        }).session(session);

        if (activeDeviceCount >= maxDevices) {
          throw createError(
            403,
            `Kuota maksimal perangkat (${maxDevices}) telah penuh. Cabut akses perangkat lama terlebih dahulu.`,
          );
        }

        // LOGIKA BARU V1: DELEGATED TRUST (AUTO-BIND)

        // Jika ini adalah perangkat pertama (count === 0), otomatis berikan status TRUSTED.
        // Jika perangkat kedua dan seterusnya, masuk antrean PENDING.
        const isFirstDevice = activeDeviceCount === 0;

        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);

        newDevice = new Device({
          penggunaID: user._id,
          installationId,
          deviceName,
          platform: "app",
          appVersion,
          osVersion,
          lastIpAddress: ipAddress,
          status: isFirstDevice ? DEVICE_STATUS.TRUSTED : DEVICE_STATUS.PENDING,
          pendingExpiresAt: isFirstDevice ? undefined : nextWeek,
          // Secara implisit menandakan ini disetujui otomatis oleh sistem pada login pertama
          approvedAt: isFirstDevice ? new Date() : undefined,
        });

        // Jika Auto-Bind terjadi, kita wajib menerbitkan Opaque Token saat ini juga
        if (isFirstDevice) {
          if (!process.env.REFRESH_SECRET) {
            throw new Error(
              "REFRESH_SECRET belum dikonfigurasi di Environment.",
            );
          }

          rawRefreshToken = crypto.randomBytes(40).toString("hex");
          const refreshTokenHash = crypto
            .createHmac("sha256", process.env.REFRESH_SECRET)
            .update(rawRefreshToken)
            .digest("hex");

          newDevice.refreshTokenHash = refreshTokenHash;
          newDevice.lastSeenAt = new Date();

          // Terbitkan Access Token
          accessToken = this.generateToken(user, newDevice, "app");
        }

        await newDevice.save({ session });
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession(); // Memastikan pool MongoDB tidak bocor sesuai standar Anda
      }

      // PENGEMBALIAN RESPON SESUAI STATUS (TOFU)
      if (newDevice.status === DEVICE_STATUS.TRUSTED) {
        return {
          status: DEVICE_STATUS.TRUSTED,
          pengguna: {
            id: user._id,
            nama: user.nama,
            aksesType: user.aksesType,
            role: user.roleID?.namaRole || null,
            status: user.status,
          },
          accessToken,
          refreshToken: rawRefreshToken,
          device: newDevice,
        };
      } else {
        return {
          status: DEVICE_STATUS.PENDING,
          pengguna: user,
          device: newDevice,
        };
      }
    }
  }

  // refreshToken (BARU)
  async refreshToken({ token, expiredAccessToken, installationId }) {
    if (installationId) {
      // ALUR APP (Roadmap V1 - Opaque Token)
      if (!token || !expiredAccessToken) {
        throw createError(
          401,
          "Token tidak lengkap untuk perpanjangan sesi App.",
        );
      }

      // 1. Ekstrak userId dari Access Token yang expired
      let decodedAccess;
      try {
        decodedAccess = jwt.verify(
          expiredAccessToken,
          process.env.PENGGUNA_ACCESS_TOKEN,
          { ignoreExpiration: true }, // Lewati cek kedaluwarsa, tapi validasi signature wajib!
        );
      } catch (err) {
        throw createError(401, "Signature Access Token tidak valid.");
      }

      const userId = decodedAccess.id;

      // 2. Pastikan user masih ada & aktif
      const user = await Pengguna.findById(userId).populate({
        path: "roleID",
        select: "namaRole permissions",
        populate: {
          path: "permissions",
          select: "nama",
        },
      });
      if (!user || user.status !== "aktif") {
        throw createError(401, "Pengguna tidak ditemukan atau non-aktif.");
      }

      // 3. Ambil Device & Pastikan Trusted
      const device = await Device.findOne({
        penggunaID: userId,
        installationId,
        status: DEVICE_STATUS.TRUSTED,
      });

      if (!device || !device.refreshTokenHash) {
        throw createError(
          401,
          "SESSION_INVALID: Sesi perangkat tidak valid atau telah dicabut.",
        );
      }

      // 4. Hash Opaque Token dari client & Bandingkan
      const clientHash = crypto
        .createHmac("sha256", process.env.REFRESH_SECRET)
        .update(token)
        .digest("hex");

      if (clientHash !== device.refreshTokenHash) {
        // PERINGATAN AUDIT: Seseorang mencoba refresh menggunakan token yang sudah dirotasi/salah
        throw createError(401, "SESSION_INVALID: Refresh token tidak cocok.");
      }

      // 5. Rotasi Token
      const rawNewRefreshToken = crypto.randomBytes(40).toString("hex");
      const newRefreshTokenHash = crypto
        .createHmac("sha256", process.env.REFRESH_SECRET)
        .update(rawNewRefreshToken)
        .digest("hex");

      device.refreshTokenHash = newRefreshTokenHash;
      device.lastRefreshAt = new Date();
      device.lastSeenAt = new Date();
      await device.save();

      // 6. Terbitkan Access Token baru (15m)
      const accessToken = this.generateToken(user, device, "app");

      return { accessToken, newRefreshToken: rawNewRefreshToken };
    } else {
      // ALUR WEB (JWT Cookie Lama)
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.PENGGUNA_REFRESH_TOKEN);
      } catch (err) {
        throw createError(401, "Refresh token tidak valid atau kedaluwarsa.");
      }

      const user = await Pengguna.findById(decoded.id).populate(
        "roleID",
        "namaRole permissions",
      );
      if (!user) throw createError(401, "Pengguna tidak ditemukan.");

      if (user.tokenVersion !== decoded.version) {
        throw createError(401, "Sesi tidak valid.");
      }

      user.tokenVersion = Date.now();
      await user.save();
      await this.clearCache(user.tenantID, user._id);

      const accessToken = this.generateToken(user, null, "web");
      const newRefreshToken = this.generateRefreshToken(user, null, "web");

      return { accessToken, newRefreshToken };
    }
  }

  // logout (BARU)
  async logout({ token, accessToken, userId, installationId }) {
    if (installationId) {
      // ALUR APP (Roadmap V1)
      if (userId) {
        // 1. Set hash ke null di database Device (Sesi diputus)
        // Kita tidak mengubah status menjadi revoked agar perangkat tetap Trusted
        await Device.findOneAndUpdate(
          { penggunaID: userId, installationId },
          { $set: { refreshTokenHash: null } },
        );

        // 2. Hapus Cache in-memory seketika
        // Asumsi: global.deviceCache adalah instance node-cache Anda
        if (global.deviceCache) {
          global.deviceCache.del(`${userId}:${installationId}`);
        }
      }
    } else {
      // ALUR WEB (JWT Cookie Lama)
      try {
        const decoded = jwt.verify(token, process.env.PENGGUNA_REFRESH_TOKEN);
        const user = await Pengguna.findById(decoded.id);
        if (user) {
          user.tokenVersion = Date.now();
          await user.save();
          await this.clearCache(user.tenantID, user._id);
        }
      } catch (err) {
        // Abaikan error pada refresh token (silent exit)
      }
    }
    // BLACKLIST ACCESS TOKEN (Berlaku untuk Web & App
    if (accessToken) {
      try {
        const decodedAccess = jwt.verify(
          accessToken,
          process.env.PENGGUNA_ACCESS_TOKEN || "pengguna_secret",
          { ignoreExpiration: true }, // Ekstrak untuk mengecek waktu yang tersisa
        );
        const timeRemaining = decodedAccess.exp - Math.floor(Date.now() / 1000);

        if (timeRemaining > 0) {
          // Asumsi 'redis' sudah terdefinisi di scope file service Anda
          await redis.set(
            `bl_${accessToken}`,
            "blacklisted",
            "EX",
            timeRemaining,
          );
        }
      } catch (ignore) {} // Diam-diam abaikan jika token tidak bisa di-decode
    }
  }

  // Cache Helpers (BARU)
  async clearCache(tenantID, id = null) {
    // 1. PEMBERSIHAN REDIS (Data Umum & Sesi Web)
    const keys = [KEY_LIST(tenantID), KEY_LOGIN_LIST(tenantID)];
    if (id) {
      keys.push(KEY_DETAIL(id));
      // Menghapus cache sesi auth milik middleware Web.
      keys.push(`auth:pengguna:${id}`);
    }

    // Eksekusi penghapusan Redis
    await Promise.all(keys.map((key) => redis.del(key)));

    // 2. PEMBERSIHAN IN-MEMORY CACHE (Sesi App/POS)
    // Jika id (userId) dikirimkan, sistem wajib menghancurkan semua sesi
    // perangkat (installationId) yang tertaut pada user ini.
    if (id && global.deviceCache) {
      // Karena node-cache tidak mendukung wildcard (seperti 'id:*'),
      // ambil semua keys, lalu filter yang berawalan userId tersebut.
      const allDeviceKeys = global.deviceCache.keys();
      const userDeviceKeys = allDeviceKeys.filter((key) =>
        key.startsWith(`${id}:`),
      );

      if (userDeviceKeys.length > 0) {
        global.deviceCache.del(userDeviceKeys);
      }
    }
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

  // create (BARU)
  async create(payload, tenantID) {
    // Catatan untuk Tuan: Pastikan fungsi validatePenggunaPayload ini
    // sudah tidak lagi mewajibkan 'deviceID' dan 'deviceType'.
    validatePenggunaPayload(payload);

    const { roleID, aksesType } = payload;

    const existing = await Pengguna.findOne({ tenantID, nama: payload.nama });
    if (existing) throw createError(400, "Nama sudah digunakan.");

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

    // Pembuatan entitas Pengguna yang bersih,
    // tanpa menyinggung skema device lama sama sekali.
    const newUser = new Pengguna({
      ...payload, // Payload dari controller kini hanya berisi: nama, pin, roleID, aksesType
      tenantID,
      tokenVersion: now,
      aksesType: normalizedAksesType,
    });

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

  // update (BARU)
  async update(id, payload, tenantID) {
    if (!payload || Object.keys(payload).length === 0) {
      throw createError(400, "Data update tidak boleh kosong.");
    }

    const user = await Pengguna.findOne({ _id: id, tenantID });
    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    // 1. Validasi Role (Hanya dieksekusi jika roleID diubah)
    if (payload.roleID && String(payload.roleID) !== String(user.roleID)) {
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
      user.roleID = payload.roleID;
    }

    // 2. Proteksi Anti Mass-Assignment (Hanya field ini yang boleh masuk)
    // const allowedFields = ["nama", "nomorHp", "status", "fotoKaryawan"];
    // let isSecurityChanged = false; // Radar Pendeteksi Perubahan Kritis

    // allowedFields.forEach((field) => {
    //   if (payload[field] !== undefined) {
    //     // Jika status diubah (misal dari aktif ke non-aktif), tandai sebagai krisis keamanan
    //     if (field === "status" && payload.status !== user.status) {
    //       isSecurityChanged = true;
    //     }
    //     user[field] = payload[field];
    //   }
    // });

    // 2. Proteksi Anti Mass-Assignment (Eksplisit)
    let isSecurityChanged = false; // Radar Pendeteksi Perubahan Kritis

    if (payload.nama !== undefined) {
      user.nama = payload.nama;
    }

    // Eksekusi pembaruan Nomor HP secara langsung
    if (payload.nomorHp !== undefined) {
      user.nomorHp = payload.nomorHp;
    }

    if (payload.status !== undefined) {
      if (payload.status !== user.status) {
        isSecurityChanged = true;
      }
      user.status = payload.status;
    }

    if (payload.fotoKaryawan !== undefined) {
      user.fotoKaryawan = payload.fotoKaryawan;
    }

    // 3. Penanganan Khusus Array aksesType
    if (payload.aksesType !== undefined) {
      const normalizedAksesType = Array.isArray(payload.aksesType)
        ? payload.aksesType
        : [payload.aksesType];

      user.aksesType = normalizedAksesType;
      isSecurityChanged = true; // Perubahan hak akses wajib mereset sesi
    }

    // 4. Penanganan Khusus PIN
    if (payload.pinBaru && String(payload.pinBaru).trim() !== "") {
      // SKENARIO A: Perubahan dari laman Profil mandiri (Strict Verification)
      if (!payload.pinLama) {
        throw createError(
          400,
          "PIN lama wajib disertakan untuk mengonfirmasi perubahan.",
        );
      }

      const isMatch = await user.comparePin(payload.pinLama);
      if (!isMatch) {
        throw createError(401, "PIN lama yang Anda masukkan tidak sesuai.");
      }

      user.pin = payload.pinBaru; // Mongoose pre-save hook akan meng-hash ini otomatis
      isSecurityChanged = true;
    } else if (payload.pin && String(payload.pin).trim() !== "") {
      // SKENARIO B: Reset PIN oleh Admin / Modul Manajemen Staf (Bypass)
      // *Pastikan penggunaController Anda melindungi jalur ini dari eksploitasi staf biasa
      user.pin = payload.pin;
      isSecurityChanged = true;
    }

    // 5. EKSEKUSI PEMUTUSAN SESI PAKSA (FORCE LOGOUT)
    if (isSecurityChanged) {
      // Putus Sesi Web (JWT)
      user.tokenVersion += 1;

      // Putus Sesi App (Roadmap V1)
      // Kita menghancurkan hash token di database tanpa menghapus fisik perangkatnya.
      // Kasir harus login ulang dan meminta PIN baru jika mereka diubah.
      await Device.updateMany(
        { penggunaID: id },
        { $set: { refreshTokenHash: null } },
      );
    }

    const updated = await user.save();
    await updated.populate("roleID", "namaRole");

    const userObj = updated.toObject({ minimize: false });
    delete userObj.pin; // Memastikan PIN tidak bocor
    delete userObj.__v;
    userObj.role = userObj.roleID.namaRole;
    userObj.roleID = userObj.roleID._id;

    // 6. Sapu bersih In-Memory Cache dan Redis (Memanggil fungsi yang sudah kita perkuat sebelumnya)
    await this.clearCache(tenantID, id);

    return userObj;
  }

  // delete (BARU)
  async delete(id, tenantID) {
    const user = await Pengguna.findOne({ _id: id, tenantID }).populate(
      "roleID",
    );
    if (!user) throw createError(404, "Pengguna tidak ditemukan");

    if (user.roleID.namaRole === "Owner") {
      throw createError(403, "Role Owner tidak dapat dihapus secara parsial.");
    }

    // CASCADE DELETE (ROADMAP V1)
    // Hanguskan seluruh riwayat dan sesi perangkat yang tertaut pada kasir ini.
    // Ini mencegah penumpukan sampah data di MongoDB Atlas kita.
    await Device.deleteMany({ penggunaID: id });

    // Eksekusi penghapusan profil pengguna
    await user.deleteOne();

    // Sapu bersih seluruh sisa cache dan sesi aktif (Web & App)
    await this.clearCache(tenantID, id);

    return true;
  }

  async checkOwnerExists(tenantID) {
    const ownerRole = await Role.findOne({ namaRole: "Owner" });
    if (!ownerRole) return false;
    const owner = await Pengguna.findOne({ tenantID, roleID: ownerRole._id });
    return !!owner;
  }
}

module.exports = new PenggunaService();
