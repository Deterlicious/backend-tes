require("dotenv").config();
const jwt = require("jsonwebtoken");
const Pengguna = require("../models/penggunaModel");
const createError = require("http-errors");

const PENGGUNA_JWT_SECRET = process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

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

    // Ambil data pengguna — include aksesType dan device untuk validasi
    const pengguna = await Pengguna.findById(decoded.id)
      .select("tokenVersion roleID nama tenantID aksesType device")
      .populate({
        path: "roleID",
        select: "namaRole permissions",
        populate: {
          path: "permissions",
          select: "nama grup",
        },
      })
      .lean();

    if (!pengguna) {
      throw createError(401, "Data pengguna tidak ditemukan.");
    }

    if (!pengguna.roleID) {
      throw createError(403, "Role pengguna tidak valid atau telah dihapus.");
    }

    // Validasi sesi berdasarkan aksesType
    if (pengguna.aksesType === "app") {
      // Pengguna app wajib ada deviceID di token dan harus cocok di DB
      if (!decoded.deviceID) {
        throw createError(401, "Device ID tidak ditemukan pada token. Silakan login ulang.");
      }

      const currentDevice = pengguna.device?.find(
        (d) => d.deviceID === decoded.deviceID
      );

      if (!currentDevice) {
        throw createError(401, "Perangkat tidak dikenali. Silakan login ulang.");
      }

      // Validasi tokenVersion per device
      if (decoded.version === undefined || currentDevice.tokenVersion !== decoded.version) {
        throw createError(401, "Sesi telah berakhir di perangkat ini. Silakan login ulang.");
      }

    } else {
      // Pengguna web validasi tokenVersion di root
      if (pengguna.tokenVersion !== decoded.version) {
        throw createError(401, "Sesi tidak valid. Silakan login kembali.");
      }
    }

    // Ambil daftar permission
    const permissionList = pengguna.roleID.permissions || [];
    pengguna.permissions = permissionList.map((p) => p.nama);

    req.pengguna = pengguna;
    req.userDecoded = decoded;

    next();
  } catch (err) {
    next(err);
  }
};