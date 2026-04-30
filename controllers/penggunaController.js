const penggunaService = require("../services/penggunaService");
const createError = require("http-errors");

// Standardisasi Cookie Mutlak: Nama "refreshToken" dan path "/"
const setRefreshTokenCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

class PenggunaController {
  _getRequesterContext(req) {
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

  // 1. register owner
  // async registerOwner(req, res, next) {
  //   try {
  //     const context = this._getRequesterContext(req);
  //     if (!context || context.source !== "AKUN") {
  //       throw createError(403, "Akses ditolak. Gunakan Akun SaaS.");
  //     }

  //     const tenantID = this._ensureTenant(context);
  //     const result = await penggunaService.registerOwner(req.body, tenantID);

  //     res.status(201).json({
  //       message: "Owner berhasil didaftarkan.",
  //       data: result,
  //       accessToken
  //     });
  //   } catch (err) {
  //     next(err);
  //   }
  // }

  async registerOwner(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      if (!context || context.source !== "AKUN") {
        throw createError(403, "Akses ditolak. Gunakan Akun SaaS.");
      }

      const tenantID = this._ensureTenant(context);

      const { nama, pin, aksesType, deviceID, deviceType } = req.body;

      // Konsisten dengan service (array-based)
      const normalizedAksesType = Array.isArray(aksesType)
        ? aksesType
        : [aksesType || "app"];

      if (normalizedAksesType.includes("app") && !deviceID) {
        throw createError(
          400,
          "Device ID wajib disertakan untuk pendaftaran Owner via aplikasi.",
        );
      }

      const payload = { nama, pin, aksesType, deviceID, deviceType };

      const result = await penggunaService.registerOwner(payload, tenantID);

      setRefreshTokenCookie(res, result.refreshToken);

      res.status(201).json({
        message: "Owner berhasil didaftarkan.",
        data: result.pengguna,
        accessToken: result.accessToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // 2. create pengguna biasa
  async create(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const { nama, pin, roleID, deviceID, deviceType, aksesType } = req.body;

      const payload = { nama, pin, roleID, deviceID, deviceType, aksesType };

      const result = await penggunaService.create(payload, tenantID);

      res.status(201).json({
        message: "Pengguna berhasil dibuat.",
        data: result.pengguna,
      });
    } catch (err) {
      next(err);
    }
  }

  // 3. get all
  async getAll(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const result = await penggunaService.getAll(tenantID);

      res.json({
        message: "Daftar pengguna berhasil diambil.",
        total: result.length,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 4. get by id
  async getById(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const result = await penggunaService.getById(req.params.id, tenantID);

      res.json({
        message: "Detail pengguna berhasil diambil.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 5. update
  async update(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const result = await penggunaService.update(
        req.params.id,
        req.body,
        tenantID,
      );

      res.json({
        message: "Data pengguna berhasil diperbarui.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 6. login pin pengguna
  // async loginPin(req, res, next) {
  //   try {
  //     const { email, password, deviceID, deviceName } = req.body;
  //     const result = await penggunaService.login(email, password, deviceID, deviceName);

  //     setRefreshTokenCookie(res, result.refreshToken);

  //     res.json({
  //       message: "Login berhasil.",
  //       data: {
  //         accessToken: result.accessToken,
  //         pengguna: result.pengguna,
  //       },
  //     });
  //   } catch (err) {
  //     next(err);
  //   }
  // }

  async loginPin(req, res, next) {
    try {
      // FIX: field sesuai schema pengguna, bukan email/password
      const { nama, pin, deviceID, deviceType, aksesType } = req.body;

      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      // FIX: pass sebagai object sesuai signature service.login({ ... })
      const result = await penggunaService.login({
        nama,
        pin,
        tenantID,
        deviceID,
        deviceType,
        aksesType,
      });

      setRefreshTokenCookie(res, result.refreshToken);

      res.json({
        message: "Login berhasil.",
        data: result.pengguna,
        accessToken: result.accessToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // 7. refresh token
  async refreshToken(req, res, next) {
    try {
      // fix: Mencari cookie dengan nama yang benar
      const token = req.cookies.refreshToken || req.body.refreshToken;

      if (!token) {
        throw createError(401, "Refresh token tidak ditemukan.");
      }

      const result = await penggunaService.refreshToken(token);

      setRefreshTokenCookie(res, result.newRefreshToken);

      res.json({
        message: "Token berhasil diperbarui.",
        data: { accessToken: result.accessToken },
      });
    } catch (err) {
      next(err);
    }
  }

  // 8. logout
  async logout(req, res, next) {
    const cookieOptions = { path: "/", httpOnly: true };
    try {
      const token = req.cookies.refreshToken || req.body.refreshToken;

      if (token) {
        await penggunaService.logout(token);
      }

      // fix: Menghapus cookie dengan nama dan path yang konsisten
      res.clearCookie("refreshToken", cookieOptions);
      res.json({ message: "Logout berhasil." });
    } catch (err) {
      // Tindakan Defensif: Tetap hancurkan sesi di browser jika server gagal
      res.clearCookie("refreshToken", cookieOptions);
      next(err);
    }
  }

  // 9. check owner
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

  // 10. delete
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

  // 11. device management
  async addDevice(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);
      const penggunaID = req.params.id;

      const result = await penggunaService.addDevice(
        penggunaID,
        tenantID,
        req.body,
      );

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

      const history = await penggunaService.getDeviceHistory(
        penggunaID,
        tenantID,
      );

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
