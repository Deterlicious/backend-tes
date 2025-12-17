require("dotenv").config();
const jwt = require("jsonwebtoken");
const Pengguna = require("../models/penggunaModel");
const createError = require("http-errors");

const PENGGUNA_JWT_SECRET = process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw createError(401, "Token Staff tidak ditemukan.");
    }

    const token = authHeader.split(" ")[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, PENGGUNA_JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw createError(401, "Sesi Staff berakhir. Silakan login kembali.");
      }
      throw createError(403, "Token Staff tidak valid.");
    }

    const pengguna = await Pengguna.findById(decoded.id)
      .select("tokenVersion permissions roleID nama") 
      .lean();

    if (!pengguna) {
      throw createError(401, "Data staf tidak ditemukan.");
    }

    if (pengguna.tokenVersion !== decoded.version) {
      throw createError(401, "Sesi tidak valid (Versi Token Berbeda). Silakan login kembali.");
    }

    req.pengguna = pengguna; 
    
    next();
  } catch (err) {
    next(err);
  }
};