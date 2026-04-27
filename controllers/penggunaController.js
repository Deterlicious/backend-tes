const penggunaService = require("../services/penggunaService");
const createError = require("http-errors");

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

  _ensureTenant(context) {
    if (!context || !context.tenantID) {
      throw createError(400, "Tenant tidak ditemukan.");
    }
    return context.tenantID;
  }

  // ==========================================
  // 1. REGISTER OWNER
  // ==========================================
  async registerOwner(req, res, next) {
    try {
      const context = this._getRequesterContext(req);

      if (!context || context.source !== "AKUN") {
        throw createError(403, "Akses ditolak. Gunakan Akun SaaS.");
      }

      const tenantID = this._ensureTenant(context);

      const result = await penggunaService.registerOwner(req.body, tenantID);
      setRefreshTokenCookie(res, result.refreshToken);

      res.status(201).json({
        message: "Owner berhasil didaftarkan dengan akses penuh.",
        data: {
          _id: result.user._id,
          nama: result.user.nama,
          role: result.user.role,
          aksesType: result.user.aksesType,
        },
        accessToken: result.token,
        refreshToken: result.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 2. CREATE STAFF
  // ==========================================
  async create(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const result = await penggunaService.create(req.body, tenantID);

      res.status(201).json({
        message: "Pengguna berhasil dibuat.",
        data: {
          _id: result._id,
          nama: result.nama,
          nomorHp: result.nomorHp,
          role: result.roleID?.namaRole || "No Role",
          fotoKaryawan: result.fotoKaryawan,
          status: result.status,
          aksesType: result.aksesType,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 3. GET ALL
  // ==========================================
  async getAll(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const result = await penggunaService.getAll(tenantID);

      // FIX: hapus duplikasi field status dan data
      const formatted = result.map((u) => ({
        _id: u._id,
        nama: u.nama,
        nomorHp: u.nomorHp,
        role: u.roleID?.namaRole || "No Role",
        status: u.status,
        aksesType: u.aksesType,
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

  // ==========================================
  // 4. GET BY ID
  // ==========================================
  async getById(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const u = await penggunaService.getById(req.params.id, tenantID);

      res.json({
        message: "Detail pengguna berhasil diambil.",
        data: {
          _id: u._id,
          nama: u.nama,
          nomorHp: u.nomorHp,
          role: u.roleID?.namaRole || "No Role",
          fotoKaryawan: u.fotoKaryawan,
          status: u.status,
          aksesType: u.aksesType,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 5. UPDATE
  // ==========================================
  async update(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const u = await penggunaService.update(req.params.id, req.body, tenantID);

      res.json({
        message: "Data pengguna berhasil diperbarui.",
        data: {
          _id: u._id,
          nama: u.nama,
          nomorHp: u.nomorHp,
          role: u.roleID?.namaRole || "No Role",
          fotoKaryawan: u.fotoKaryawan,
          status: u.status,
          aksesType: u.aksesType,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 6. LOGIN PIN
  // ==========================================
  async loginPin(req, res, next) {
    try {
      // FIX: tambah deviceID dan deviceType untuk pengguna aksesType "app"
      const { nama, pin, deviceID, deviceType } = req.body;

      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const result = await penggunaService.login({
        nama,
        pin,
        tenantID,
        deviceID,
        deviceType,
      });

      setRefreshTokenCookie(res, result.refreshToken);

      // FIX: hapus duplikasi field role
      res.json({
        message: "Login pengguna berhasil.",
        data: {
          _id: result.user._id,
          nama: result.user.nama,
          role: result.user.role,
          aksesType: result.user.aksesType,
        },
        accessToken: result.token,
        refreshToken: result.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 🔄 REFRESH TOKEN
  // ==========================================
  async refreshToken(req, res, next) {
    try {
      const token = req.cookies.penggunaRefreshToken || req.body.refreshToken;

      if (!token) {
        throw createError(401, "Refresh Token tidak ditemukan.");
      }

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

  // ==========================================
  // 🚪 LOGOUT
  // ==========================================
  async logout(req, res, next) {
    try {
      res.clearCookie("penggunaRefreshToken", { path: "/api/pengguna" });
      res.json({ message: "Logout berhasil." });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // CHECK OWNER
  // ==========================================
  async checkOwner(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      if (!context || context.source !== "AKUN") {
        throw createError(403, "Akses ditolak.");
      }
      const tenantID = this._ensureTenant(context);

      const hasOwner = await penggunaService.checkOwnerExists(tenantID);

      res.json({
        message: "Status owner berhasil diperiksa.",
        data: { hasOwner },
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 🗑️ DELETE
  // ==========================================
  async delete(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      await penggunaService.delete(req.params.id, tenantID);

      res.json({ message: "Pengguna berhasil dihapus." });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 📱 DEVICE MANAGEMENT
  // ==========================================
  async addDevice(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);
      const penggunaID = req.params.id;

      const result = await penggunaService.addDevice(penggunaID, tenantID, req.body);

      res.status(201).json({
        message: "Perangkat berhasil ditambahkan.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async promoteDevice(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);
      const penggunaID = req.params.id;

      const result = await penggunaService.promoteDevice(
        penggunaID,
        tenantID,
        req.body.deviceID,
      );

      res.json({
        message: "Perangkat berhasil dijadikan utama.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async demoteDevice(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);
      const penggunaID = req.params.id;

      const result = await penggunaService.demoteDevice(
        penggunaID,
        tenantID,
        req.body.deviceID,
      );

      res.json({
        message: "Perangkat berhasil diturunkan.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async removeDevice(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);
      const penggunaID = req.params.id;

      await penggunaService.removeDevice(
        penggunaID,
        tenantID,
        req.body.deviceID,
      );

      res.json({ message: "Perangkat berhasil dihapus." });
    } catch (err) {
      next(err);
    }
  }

  async getDeviceHistory(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);
      const penggunaID = req.params.id;

      const history = await penggunaService.getDeviceHistory(penggunaID, tenantID);

      res.json({
        message: "Riwayat perangkat berhasil diambil.",
        data: history,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PenggunaController();