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

      res.json({
        message: "Login berhasil.",
        data: result.user, // Mengirim profil user utuh tanpa pemetaan manual
        accessToken: result.accessToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // 4. get profile
  async getProfile(req, res, next) {
    try {
      const userId = req.userDecoded?.id;

      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized: user context missing",
        });
      }
      const result = await akunService.getProfile(userId);

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
      // [JALAN TENGAH]: Karena kita menggunakan authPengguna, req.userDecoded.id adalah ID Karyawan.
      // Kita harus mengambil ID Akun/Tenant dari relasi karyawan tersebut.
      // (Sesuaikan variabel 'tenantID' dengan payload JWT Pengguna Anda)
      const targetAkunId = req.userDecoded?.tenantID || req.akunContext?.akunID; 

      if (!targetAkunId) {
        return res.status(403).json({
          message: "Forbidden: Tidak dapat menemukan referensi Akun dari Pengguna ini.",
        });
      }

      // Sekarang yang dilempar ke database Akun adalah targetAkunId yang benar, bukan ID Kasir
      const result = await akunService.updateProfile(
        targetAkunId,
        req.body,
      );

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

      // [PERBAIKAN]: Ambil Access Token dari header Authorization
      const authHeader = req.headers.authorization;
      const accessToken = authHeader && authHeader.startsWith("Bearer ") 
        ? authHeader.split(" ")[1] 
        : null;

      // [PERBAIKAN]: Pastikan service dieksekusi jika ada salah satu token
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

      await akunService.deleteUserByAdmin(req.params.id, requesterId); // [PERBAIKAN]: Gunakan variabel requesterId
      res.json({ message: "Akun berhasil dihapus oleh admin." });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AkunController();
