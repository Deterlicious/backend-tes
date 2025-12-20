const penggunaService = require("../services/penggunaService");
const createError = require("http-errors");

const setRefreshTokenCookie = (res, token) => {
  res.cookie("penggunaRefreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/pengguna",
    maxAge: 12 * 60 * 60 * 1000,
  });
};

class PenggunaController {

  // ⚠️ Tetap dipertahankan untuk backward compatibility
  _getRequesterContext(req) {
    if (req.akun) {
      return {
        tenantID: req.akun.tenantID,
        roleID: req.akun.roleID,
        type: "AKUN",
      };
    }

    if (req.pengguna) {
      return {
        tenantID: req.pengguna.tenantID,
        roleID: req.pengguna.roleID,
        type: "PENGGUNA",
      };
    }

    return null;
  }

  async loginPin(req, res, next) {
    try {
      const { nama, pin } = req.body;
      if (!nama || !pin) {
        throw createError(400, "Nama dan PIN wajib diisi");
      }

      const result = await penggunaService.login({ nama, pin });

      res.json({
        message: "Login pengguna berhasil",
        accessToken: result.token,
        data: result.user,
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      // ✅ SUMBER CONTEXT TUNGGAL
      const context = req.akunContext;

      if (!context?.tenantID) {
        throw createError(403, "Tenant context tidak ditemukan");
      }

      if (!context?.roleID) {
        throw createError(403, "Role context tidak ditemukan");
      }

      // 🔐 SECURITY: Paksa tenant & role dari token
      req.body.tenantID = context.tenantID;
      req.body.roleID = context.roleID;

      const result = await penggunaService.create(
        req.body,
        context.tenantID
      );

      res.status(201).json({
        message: "Pengguna berhasil dibuat",
        data: {
          id: result._id,
          nama: result.nama,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getAll(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      if (!context?.tenantID) {
        throw createError(403, "Unauthorized tenant access");
      }

      const result = await penggunaService.getAll(context.tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const result = await penggunaService.getById(
        req.params.id,
        context.tenantID
      );

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const context = this._getRequesterContext(req);

      const result = await penggunaService.update(
        req.params.id,
        req.body,
        context.tenantID
      );

      res.json({
        message: "Pengguna diperbarui",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const context = this._getRequesterContext(req);

      await penggunaService.delete(req.params.id, context.tenantID);

      res.json({ message: "Pengguna dihapus" });
    } catch (err) {
      next(err);
    }
  }

  async getForLoginScreen(req, res, next) {
    try {
      const tenantID = req.params.tenantID;
      const result = await penggunaService.getForLoginScreen(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PenggunaController();
