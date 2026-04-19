const akunService = require("../services/akunService");
const deviceService = require("../services/deviceService");
const createError = require("http-errors");

// Helper cookie refresh token
const setRefreshTokenCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/akun/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

class AkunController {
  // ==========================================
  // 🔓 REGISTER
  // ==========================================
  async register(req, res, next) {
    try {
      const result = await akunService.register(req.body);

      res.status(201).json({
        message: "Registrasi berhasil.",
        data: {
          _id: result._id,
          tenantID: result.tenantID,
          username: result.username,
          email: result.email,
          role: result.role,
          maxPrimaryDevice: result.maxPrimaryDevice,
          maxDevice: result.maxDevice,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 🔐 LOGIN (AKUN)
  // ==========================================
  async login(req, res, next) {
    try {
      const { email, password, deviceID } = req.body;

      if (!email || !password || !deviceID) {
        throw createError(400, "Email, password, dan Device ID wajib diisi.");
      }

      const result = await akunService.login(req.body);

      setRefreshTokenCookie(res, result.tokens.refreshToken);

      res.json({
        message: result.message,
        data: {
          _id: result.id,
          tenantID: result.tenantID,
          username: result.username,
          email: result.email,
          role: result.role,
          currentDevice: result.currentDevice,
        },
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 🔐 GET PROFILE (BERBASIS PENGGUNA + PERMISSION)
  // ==========================================
  async getProfile(req, res, next) {
    try {
      // 🔥 Ambil akunID dari pengguna (RBAC)
      const akunID = req.pengguna?.akunID;

      if (!akunID) {
        throw createError(400, "Relasi akun tidak ditemukan pada pengguna.");
      }

      const user = await akunService.getProfile(akunID);
      if (!user) throw createError(404, "Akun tidak ditemukan.");

      res.json({
        message: "Profil berhasil diambil.",
        data: {
          _id: user._id,
          tenantID: user.tenantID,
          username: user.username,
          email: user.email,
          role: user.role,
          maxPrimaryDevice: user.maxPrimaryDevice,
          maxDevice: user.maxDevice,
          device: (user.device || []).map((d) => ({
            deviceID: d.deviceID,
            type: d.type,
            tokenVersion: d.tokenVersion,
            lastUsed: d.lastUsed,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // ✏️ UPDATE PROFILE (BERBASIS PERMISSION)
  // ==========================================
  async updateProfile(req, res, next) {
    try {
      const akunID = req.pengguna?.akunID;

      if (!akunID) {
        throw createError(400, "Relasi akun tidak ditemukan pada pengguna.");
      }

      const updated = await akunService.updateProfile(akunID, req.body);

      res.json({
        message: "Profil berhasil diperbarui.",
        data: {
          _id: updated._id,
          tenantID: updated.tenantID,
          username: updated.username,
          email: updated.email,
          role: updated.role,
          maxPrimaryDevice: updated.maxPrimaryDevice,
          maxDevice: updated.maxDevice,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 👑 ADMIN GET ALL AKUN
  // ==========================================
  async getAllAkun(req, res, next) {
    try {
      const users = await akunService.getAllUsers();

      const formattedUsers = users.map((user) => ({
        _id: user._id,
        tenantID: user.tenantID,
        username: user.username,
        email: user.email,
        role: user.role,
        maxDevice: user.maxDevice,
        deviceCount: user.device ? user.device.length : 0,
      }));

      res.json({
        message: "Daftar akun berhasil diambil.",
        total: formattedUsers.length,
        data: formattedUsers,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 📱 DEVICE (PAKAI AKUN TOKEN)
  // ==========================================
  async getDevice(req, res, next) {
    try {
      const devices = (req.akun?.device || []).map((d) => ({
        deviceID: d.deviceID,
        type: d.type,
        tokenVersion: d.tokenVersion,
        lastUsed: d.lastUsed,
      }));

      res.json({
        message: "Daftar perangkat berhasil diambil.",
        data: devices,
      });
    } catch (err) {
      next(err);
    }
  }

  async getDeviceHistory(req, res, next) {
    try {
      const userId = req.userDecoded.id;
      const history = await deviceService.getHistory(userId);

      res.json({
        message: "Riwayat perangkat berhasil diambil.",
        data: history,
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
      const token = req.cookies.refreshToken || req.body.refreshToken;
      if (!token) throw createError(401, "Refresh token tidak ditemukan.");

      const tokens = await akunService.refreshToken(token);
      setRefreshTokenCookie(res, tokens.refreshToken);

      res.json({
        message: "Token berhasil diperbarui.",
        ...tokens,
      });
    } catch (err) {
      res.cookie("refreshToken", "", {
        maxAge: 0,
        path: "/api/akun/auth",
      });
      next(err);
    }
  }

  // ==========================================
  // 🚪 LOGOUT
  // ==========================================
  async logout(req, res, next) {
    try {
      const token = req.cookies.refreshToken || req.body.refreshToken;

      await akunService.logout(token);

      res.cookie("refreshToken", "", {
        maxAge: 0,
        path: "/api/akun/auth",
      });

      res.json({ message: "Logout berhasil." });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 🗑️ DELETE USER BY ADMIN
  // ==========================================
  async deleteUserByAdmin(req, res, next) {
    try {
      await akunService.deleteUserByAdmin(
        req.params.id,
        req.userDecoded.id
      );

      res.json({
        message: "Akun berhasil dihapus oleh admin.",
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 📱 DEVICE MANAGEMENT
  // ==========================================
  async addDevice(req, res, next) {
    try {
      const result = await deviceService.addDevice(
        req.userDecoded.id,
        req.body
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
      const result = await deviceService.promoteDevice(
        req.userDecoded.id,
        req.body.deviceID
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
      const result = await deviceService.demoteDevice(
        req.userDecoded.id,
        req.body.deviceID
      );

      res.json({
        message: "Perangkat utama berhasil diturunkan.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async removeDevice(req, res, next) {
    try {
      await deviceService.removeDevice(
        req.userDecoded.id,
        req.body.deviceID
      );

      res.json({
        message: "Perangkat berhasil dihapus.",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AkunController();