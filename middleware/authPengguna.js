require("dotenv").config();
const jwt = require("jsonwebtoken");
const Pengguna = require("../models/penggunaModel");

const PENGGUNA_JWT_SECRET = process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Token tidak ditemukan atau format salah" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, PENGGUNA_JWT_SECRET);

    const pengguna = await Pengguna.findById(decoded.id).select("tokenVersion");
    if (!pengguna || pengguna.tokenVersion !== decoded.version) {
      return res
        .status(401)
        .json({ message: "Sesi tidak valid. Silakan login kembali." });
    }

    req.pengguna = decoded;
    next();
  } catch (err) {
    return res
      .status(403)
      .json({ message: "Token tidak valid atau sudah kedaluwarsa" });
  }
};