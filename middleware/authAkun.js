require("dotenv").config();
const jwt = require("jsonwebtoken");
const Akun = require("../models/akunModel");
const createError = require("http-errors");

const AKUN_JWT_SECRET = process.env.AKUN_JWT_SECRET || "akun_secret";

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw createError(401, "Akses ditolak. Token Akun tidak ditemukan.");
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, AKUN_JWT_SECRET);
    } catch (err) {
      // Bedakan error Expired vs Invalid/Malformed
      if (err.name === "TokenExpiredError") {
        throw createError(401, "Sesi berakhir (Token Expired). Silakan refresh token.");
      }
      throw createError(403, "Token tidak valid.");
    }

    // Ambil data Akun
    const akun = await Akun.findById(decoded.id).select("device role tenantID");
    if (!akun) throw createError(401, "Akun tidak ditemukan atau telah dihapus.");

    // Cek Device
    const currentDevice = akun.device.find(d => d.deviceID === decoded.deviceID);
    if (!currentDevice) {
      throw createError(401, "Perangkat tidak dikenali. Silakan login ulang.");
    }

    // Cek Token Version (Logout Paksa / Security Breach)
    if (decoded.version !== undefined && currentDevice.tokenVersion !== decoded.version) {
      throw createError(401, "Sesi telah kedaluwarsa di perangkat ini. Silakan login ulang.");
    }

    // Attach ke Request
    req.akun = akun; 
    req.userDecoded = decoded;
    
    next();
  } catch (err) {
    next(err); // Lempar ke Global Error Handler
  }
};