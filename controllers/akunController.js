const akunService = require("../services/akunService");
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
  // 1. refresh token
  async refreshToken(req, res, next) {
    try {
      const cookies = req.cookies || {};
      const body = req.body || {};
      const token = cookies.refreshToken || body.refreshToken;

      if (!token) {
        throw createError(
          401,
          "Refresh token tidak ditemukan. Silakan login kembali.",
        );
      }

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

  // 2. register
  async register(req, res, next) {
    try {
      const result = await akunService.register(req.body);

      res.status(201).json({
        message: "Registrasi berhasil.",
        data: result, // Mengirim objek utuh dari service
      });
    } catch (err) {
      next(err);
    }
  }

  // 3. login
  async login(req, res, next) {
    try {
      const result = await akunService.login(req.body);

      setRefreshTokenCookie(res, result.refreshToken);

      // Menyesuaikan pesan berdasarkan evaluasi dinamis dari Service
      const responseMessage = result.needsSetup
        ? "Login berhasil. Anda belum melakukan setup toko, silakan setup di /api/tenant."
        : "Login berhasil.";

      res.json({
        message: responseMessage,
        data: result.user, // Mengirim profil user utuh tanpa pemetaan manual
        accessToken: result.accessToken,
        requireSetup: result.needsSetup, // Flag boolean ini yang akan ditangkap oleh Flutter
      });
    } catch (err) {
      next(err);
    }
  }

  // 4. get profile
  async getProfile(req, res, next) {
    try {
      const tenantID = req.userDecoded?.tenantID; // ✅ konsisten dengan updateProfile

      if (!tenantID) {
        return res.status(401).json({
          message: "Unauthorized: tenant context missing",
        });
      }

      const result = await akunService.getProfile(tenantID);

      res.json({
        message: "Profil berhasil diambil.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 5. update profile
  async updateProfile(req, res, next) {
    try {
      const tenantID = req.userDecoded?.tenantID;

      if (!tenantID) {
        return res.status(403).json({
          message: "Forbidden: Tenant tidak ditemukan.",
        });
      }

      const result = await akunService.updateProfile(tenantID, req.body);

      res.json({
        message: "Profil berhasil diperbarui.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 6. logout
  async logout(req, res, next) {
    try {
      const cookies = req.cookies || {};
      const body = req.body || {};

      const token = cookies.refreshToken || body.refreshToken;

      // perbaikan: Ambil Access Token dari header Authorization
      const authHeader = req.headers.authorization;
      const accessToken =
        authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.split(" ")[1]
          : null;

      // perbaikan: Pastikan service dieksekusi jika ada salah satu token
      if (token || accessToken) {
        await akunService.logout(token, accessToken); // Mengirim parameter kedua
      }

      res.cookie("refreshToken", "", {
        maxAge: 0,
        path: "/api/akun/auth",
      });

      res.json({ message: "Logout berhasil." });
    } catch (err) {
      next(err);
    }
  }

  // 7. admin only: get all akun
  async getAllAkun(req, res, next) {
    try {
      const requesterId = req.userDecoded?.id;

      if (!requesterId) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

      const result = await akunService.getAllAkun(requesterId);

      res.json({
        message: "Semua akun berhasil diambil.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 8. admin only: delete user
  async deleteUserByAdmin(req, res, next) {
    try {
      const requesterId = req.userDecoded?.id;
      if (!requesterId) {
        return res.status(401).json({
          message: "Unauthorized: admin context missing",
        });
      }

      await akunService.deleteUserByAdmin(req.params.id, requesterId); // perbaikan: Gunakan variabel requesterId
      res.json({ message: "Akun berhasil dihapus oleh admin." });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AkunController();
