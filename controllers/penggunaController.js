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
  _getRequesterContext(req) {
    if (req.akun) {
      return {
        akunID: req.akun._id || req.akun.id,
        tenantID: req.akun.tenantID || null,
        roleID: req.akun.roleID || null,
        source: "AKUN",
      };
    }
    if (req.akunContext) {
      return {
        akunID: req.akunContext.akunID,
        tenantID: req.akunContext.tenantID ?? null,
        roleID: req.akunContext.roleID ?? null,
        source: "AKUN",
      };
    }
    if (req.pengguna) {
      return {
        penggunaID: req.pengguna._id,
        tenantID: req.pengguna.tenantID,
        roleID: req.pengguna.roleID,
        source: "PENGGUNA",
      };
    }
    console.log("isi req: ", Object.keys(req));
    
    return null;
  }

  async loginPin(req, res, next) {
    try {
      const { nama, pin } = req.body;
      if (!nama || !pin) {
        throw createError(400, "Nama dan PIN wajib diisi");
      }

      const result = await penggunaService.login({ nama, pin });
      setRefreshTokenCookie(res, result.refreshToken);

      res.json({
        message: "Login pengguna berhasil",
        accessToken: result.token,
        refreshToken: result.refreshToken,
        data: result.user,
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      // ✅ SUMBER CONTEXT TUNGGAL
      const context = this._getRequesterContext(req);

      if (!context?.tenantID) {
        throw createError(403, "Tenant context tidak ditemukan");
      }

      if (!context?.roleID) {
        throw createError(403, "Role context tidak ditemukan");
      }

      // 🔐 SECURITY: Paksa tenant & role dari token
      req.body.tenantID = context.tenantID;
      req.body.roleID = context.roleID;

      const result = await penggunaService.create(req.body, context.tenantID);
      setRefreshTokenCookie(res, result.refreshToken);

      res.status(201).json({
        message: "Pengguna berhasil dibuat",
        accessToken: result.token,
        refreshToken: result.refreshToken,
        data: result.user,
      });
    } catch (err) {
      next(err);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const token = req.cookies.penggunaRefreshToken || req.body.refreshToken;

      if (!token)
        return res
          .status(401)
          .json({ message: "Refresh Token tidak ditemukan" });
      const tokens = await penggunaService.refreshToken(token);
      setRefreshTokenCookie(res, tokens.refreshToken);
      res.json(tokens);
    } catch (err) {
      res.cookie("penggunaRefreshToken", "", {
        maxAge: 0,
        path: "/api/pengguna",
      });
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      await penggunaService.logout();
      res.cookie("penggunaRefreshToken", "", {
        maxAge: 0,
        path: "/api/pengguna",
      });
      res.json({ message: "Logout berhasil" });
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
      res.json({ 
        message: "Daftar pengguna untuk layar login",
        data: result 
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PenggunaController();
