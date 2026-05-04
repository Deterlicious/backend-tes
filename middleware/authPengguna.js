require("dotenv").config();
const jwt = require("jsonwebtoken");
const Pengguna = require("../models/penggunaModel");
const redis = require("../config/redis");
const createError = require("http-errors");

const PENGGUNA_JWT_SECRET =
  process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers?.authorization; // FIX: Optional Chaining

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw createError(401, "Akses ditolak. Token pengguna tidak ditemukan.");
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, PENGGUNA_JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw createError(401, "Sesi telah berakhir. Silakan login kembali.");
      }
      throw createError(403, "Token pengguna tidak valid.");
    }

    // STRATEGI REDIS: Cek sesi di cache terlebih dahulu
    const cacheKey = `auth:pengguna:${decoded.id}`;
    let sessionData = await redis.get(cacheKey);

    if (sessionData) {
      sessionData = JSON.parse(sessionData);
    } else {
      // CACHE MISS: Ambil dari MongoDB jika tidak ada di Redis
      const dbPengguna = await Pengguna.findById(decoded.id)
        .select("tokenVersion roleID nama tenantID aksesType device")
        .populate({
          path: "roleID",
          select: "namaRole permissions",
          populate: {
            path: "permissions",
            select: "nama",
          },
        })
        .lean();

      if (!dbPengguna || !dbPengguna.roleID) {
        throw createError(401, "Sesi tidak valid atau role telah dihapus."); // FIX 401
      }

      // Transformasi data agar ringan disimpan di Redis
      sessionData = {
        _id: dbPengguna._id,
        nama: dbPengguna.nama,
        tenantID: dbPengguna.tenantID,
        aksesType: dbPengguna.aksesType,
        tokenVersion: dbPengguna.tokenVersion,
        device: dbPengguna.device || [],
        permissions: dbPengguna.roleID.permissions.map((p) => p.nama),
      };

      // Simpan ke Redis (Expire dalam 1 jam)
      await redis.set(cacheKey, JSON.stringify(sessionData), "EX", 3600);
    }

    // VALIDASI SESI (Multi-Device & Revocation)
    // if (Array.isArray(sessionData.aksesType) && sessionData.aksesType.includes("app")) {
    //   if (!decoded.deviceID) {
    //     throw createError(
    //       401,
    //       "Device ID tidak ditemukan pada token. Silakan login ulang.",
    //     );
    //   }

    //   const currentDevice = sessionData.device.find(
    //     (d) => d.deviceID === decoded.deviceID,
    //   );

    //   if (!currentDevice) {
    //     throw createError(
    //       401,
    //       "Perangkat tidak dikenali. Silakan login ulang.",
    //     );
    //   }

    //   if (
    //     decoded.version === undefined ||
    //     currentDevice.tokenVersion !== decoded.version
    //   ) {
    //     throw createError(
    //       401,
    //       "Sesi telah berakhir di perangkat ini. Silakan login ulang.",
    //     );
    //   }
    // } else {
    //   // Validasi web
    //   if (sessionData.tokenVersion !== decoded.version) {
    //     throw createError(401, "Sesi tidak valid. Silakan login kembali.");
    //   }
    // }

    if (decoded.loginType === "app") {
      if (!decoded.deviceID) {
        throw createError(
          401,
          "Device ID tidak ditemukan pada token. Silakan login ulang.",
        );
      }

      const currentDevice = sessionData.device.find(
        (d) => d.deviceID === decoded.deviceID,
      );

      if (!currentDevice) {
        throw createError(
          401,
          "Perangkat tidak dikenali. Silakan login ulang.",
        );
      }

      if (
        decoded.version === undefined ||
        currentDevice.tokenVersion !== decoded.version
      ) {
        throw createError(
          401,
          "Sesi telah berakhir di perangkat ini. Silakan login ulang.",
        );
      }
    } else {
      // WEB
      if (sessionData.tokenVersion !== decoded.version) {
        throw createError(401, "Sesi tidak valid. Silakan login kembali.");
      }
    }

    req.pengguna = sessionData;
    req.userDecoded = sessionData; // supaya controller bisa baca tenantID
    next();
  } catch (err) {
    next(err);
  }
};
