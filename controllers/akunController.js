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
  async refreshToken(req, res, next) {
    try {
      // FIX MUTLAK: Ekstraksi aman dengan objek fallback
      const cookies = req.cookies || {};
      const body = req.body || {};
      const token = cookies.refreshToken || body.refreshToken;

      if (!token) {
        throw createError(
          401,
          "Refresh token tidak ditemukan. Silakan login kembali.",
        );
      }

      // Memanggil service
      const tokens = await akunService.refreshToken(token);

      // Memanggil helper function
      setRefreshTokenCookie(res, tokens.refreshToken);

      res.json({
        message: "Token berhasil diperbarui.",
        ...tokens,
      });
    } catch (err) {
      // Jika error, hapus cookie (maxAge: 0) dan teruskan error ke errorHandler
      res.cookie("refreshToken", "", {
        maxAge: 0,
        path: "/api/akun/auth",
      });
      next(err);
    }
  }

  // register
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
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // login (akun)
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw createError(400, "Email dan password wajib diisi.");
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
        },
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // get profile
  async getProfile(req, res, next) {
    try {
      const akunID = req.userDecoded?.id;

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
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // update profile
  async updateProfile(req, res, next) {
    try {
      const akunID = req.userDecoded?.id;

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
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // admin get all akun
  async getAllAkun(req, res, next) {
    try {
      const users = await akunService.getAllUsers();

      const formattedUsers = users.map((user) => ({
        _id: user._id,
        tenantID: user.tenantID,
        username: user.username,
        email: user.email,
        role: user.role,
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

  // refresh token
  // async refreshToken(req, res, next) {
  //   try {
  //     const token = req.cookies.refreshToken || req.body.refreshToken;
  //     if (!token) throw createError(401, "Refresh token tidak ditemukan.");

  //     const tokens = await akunService.refreshToken(token);
  //     setRefreshTokenCookie(res, tokens.refreshToken);

  //     res.json({
  //       message: "Token berhasil diperbarui.",
  //       ...tokens,
  //     });
  //   } catch (err) {
  //     res.cookie("refreshToken", "", {
  //       maxAge: 0,
  //       path: "/api/akun/auth",
  //     });
  //     next(err);
  //   }
  // }

  // logout
  async logout(req, res, next) {
    try {
      // FIX MUTLAK: Terapkan pengamanan yang sama persis di logout
      const cookies = req.cookies || {};
      const body = req.body || {};
      const token = cookies.refreshToken || body.refreshToken;

      // Hanya proses logout di service jika token memang ada
      if (token) {
        await akunService.logout(token);
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
  
  // delete user by admin
  async deleteUserByAdmin(req, res, next) {
    try {
      await akunService.deleteUserByAdmin(req.params.id, req.userDecoded.id);

      res.json({
        message: "Akun berhasil dihapus oleh admin.",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AkunController();
