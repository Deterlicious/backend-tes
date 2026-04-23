const penggunaService = require("../services/penggunaService");
const createError = require("http-errors");
const Pengguna = require("../models/penggunaModel");

const setRefreshTokenCookie = (res, token) => {
  res.cookie("penggunaRefreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/pengguna",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

class PenggunaController {
  _getRequesterContext(req) {
    if (req.akun)
      return { tenantID: req.akun.tenantID || null, source: "AKUN" };
    if (req.akunContext)
      return { tenantID: req.akunContext.tenantID ?? null, source: "AKUN" };
    if (req.pengguna)
      return { tenantID: req.pengguna.tenantID, source: "PENGGUNA" };
    return null;
  }

  // 1. REGISTER OWNER
  async registerOwner(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      if (!context || context.source !== "AKUN")
        throw createError(403, "Akses ditolak. Gunakan Akun SaaS.");

      const result = await penggunaService.registerOwner(
        req.body,
        context.tenantID,
      );
      setRefreshTokenCookie(res, result.refreshToken);

      res.status(201).json({
        message: "Owner berhasil didaftarkan dengan akses penuh.",
        data: {
          _id: result.user._id,
          nama: result.user.nama,
          role: result.user.role,
        },
        accessToken: result.token,
        refreshToken: result.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // 2. CREATE STAFF (Register Pengguna)
  async create(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const result = await penggunaService.create(req.body, context.tenantID);

      res.status(201).json({
        message: "Pengguna berhasil dibuat.",
        data: {
          _id: result._id,
          nama: result.nama,
          nomorHp: result.nomorHp,
          role: result.roleID?.namaRole || "No Role",
          fotoKaryawan: result.fotoKaryawan,
          status: result.status,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // 3. GET ALL
  async getAll(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const result = await penggunaService.getAll(context.tenantID);

      const formatted = result.map((u) => ({
        _id: u._id,
        nama: u.nama,
        nomorHp: u.nomorHp,
        role: u.roleID?.namaRole || "No Role",
        status: u.status,
      }));

      res.json({
        message: "Daftar pengguna berhasil diambil.",
        total: formatted.length,
        data: formatted,
      });
    } catch (err) {
      next(err);
    }
  }

  // 4. GET BY ID
  async getById(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const u = await penggunaService.getById(req.params.id, context.tenantID);

      res.json({
        message: "Detail pengguna berhasil diambil.",
        data: {
          _id: u._id,
          nama: u.nama,
          nomorHp: u.nomorHp,
          role: u.roleID?.namaRole || "No Role",
          fotoKaryawan: u.fotoKaryawan,
          status: u.status,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // 5. UPDATE
  async update(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const u = await penggunaService.update(
        req.params.id,
        req.body,
        context.tenantID,
      );

      res.json({
        message: "Data pengguna berhasil diperbarui.",
        data: {
          _id: u._id,
          nama: u.nama,
          nomorHp: u.nomorHp,
          role: u.roleID?.namaRole || "No Role",
          fotoKaryawan: u.fotoKaryawan,
          status: u.status,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // 6. LOGIN PIN
  async loginPin(req, res, next) {
    try {
      const { nama, pin } = req.body;
      const result = await penggunaService.login({ nama, pin });
      setRefreshTokenCookie(res, result.refreshToken);

      res.json({
        message: "Login pengguna berhasil.",
        data: {
          _id: result.user._id,
          nama: result.user.nama,
          role: result.user.role,
        },
        accessToken: result.token,
        refreshToken: result.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // 7. GET FOR LOGIN SCREEN
  async getForLoginScreen(req, res, next) {
    try {
      const result = await penggunaService.getForLoginScreen(
        req.params.tenantID,
      );

      const formatted = result.map((u) => ({
        _id: u._id,
        nama: u.nama,
        role: u.roleID?.namaRole,
        fotoKaryawan: u.fotoKaryawan,
      }));

      res.json({
        message: "Daftar pengguna aktif berhasil diambil.",
        data: formatted,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- Fungsi Auth & Maintenance ---

  async checkOwner(req, res, next) {
    try {
      const tenantID = req.akunContext.tenantID;
      const count = await Pengguna.countDocuments({ tenantID });
      res.json({ hasOwner: count > 0 });
    } catch (err) {
      next(err);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const token = req.cookies.penggunaRefreshToken || req.body.refreshToken;
      if (!token) throw createError(401, "Refresh Token tidak ditemukan.");
      const tokens = await penggunaService.refreshToken(token);
      setRefreshTokenCookie(res, tokens.refreshToken);
      res.json({
        message: "Token pengguna diperbarui.",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (err) {
      res.clearCookie("penggunaRefreshToken", { path: "/api/pengguna" });
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      res.clearCookie("penggunaRefreshToken", { path: "/api/pengguna" });
      res.json({ message: "Logout berhasil." });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      await penggunaService.delete(req.params.id, context.tenantID);
      res.json({ message: "Pengguna berhasil dihapus." });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PenggunaController();
