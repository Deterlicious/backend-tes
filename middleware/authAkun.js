require("dotenv").config();
const jwt = require("jsonwebtoken");
const Akun = require("../models/akunModel");
const createError = require("http-errors");

const AKUN_JWT_SECRET = process.env.AKUN_JWT_SECRET || "akun_secret";

async function authAkun(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw createError(401, "Akses ditolak. Token akun tidak ditemukan.");
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, AKUN_JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw createError(
          401,
          "Sesi berakhir (Token expired). Silakan login ulang."
        );
      }
      throw createError(403, "Token tidak valid.");
    }

    // Ambil data akun (roleID sudah dihapus dari select)
    const akun = await Akun.findById(decoded.id)
      .select("device role tenantID")
      .lean();

    if (!akun) {
      throw createError(401, "Akun tidak ditemukan atau telah dihapus.");
    }

    // Validasi device (jika deviceID ada di token)
    if (decoded.deviceID) {
      const currentDevice = akun.device?.find(
        (d) => d.deviceID === decoded.deviceID
      );

      if (!currentDevice) {
        throw createError(
          401,
          "Perangkat tidak dikenali. Silakan login ulang."
        );
      }

      // Validasi token version (logout paksa / revoke)
      if (
        decoded.version !== undefined &&
        currentDevice.tokenVersion !== decoded.version
      ) {
        throw createError(
          401,
          "Sesi telah berakhir di perangkat ini. Silakan login ulang."
        );
      }
    }

    // Context Akun (roleID sudah dihapus)
    req.akunContext = {
      akunID: akun._id,
      roleAkun: akun.role,
      tenantID: decoded.tenantID || null,
    };

    req.userDecoded = decoded;

    next();
  } catch (err) {
    next(err);
  }
}

// Middleware untuk memastikan akun sudah punya toko
authAkun.requireTenant = function (req, res, next) {
  if (!req.akunContext?.tenantID) {
    return next(createError(403, "Akun belum terikat tenant."));
  }
  next();
};

module.exports = authAkun;