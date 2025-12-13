const akunService = require("../services/akunService");
const deviceService = require("../services/deviceService");

// Konfigurasi Cookie
const setRefreshTokenCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/akun/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 hari
  });
};

class AkunController {
  
  // AUTH
  async register(req, res, next) {
    try {
      const result = await akunService.register(req.body);
      if (result.error) return res.status(400).json({ errors: result.error });
      res.status(201).json({ message: "Registrasi berhasil", data: result });
    } catch (err) { next(err); }
  }

  async login(req, res, next) {
    try {
      const result = await akunService.login(req.body);
      if (result.error) return res.status(400).json({ errors: result.error });

      setRefreshTokenCookie(res, result.tokens.refreshToken);

      res.json({
        message: result.message,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        data: result.user
      });
    } catch (err) { next(err); }
  }

  async refreshToken(req, res, next) {
    try {
      const token = req.cookies.refreshToken || req.body.refreshToken;
      const tokens = await akunService.refreshToken(token);
      
      setRefreshTokenCookie(res, tokens.refreshToken);
      res.json(tokens);
    } catch (err) { 
      // Clear cookie jika invalid
      res.cookie("refreshToken", "", { maxAge: 0, path: "/api/akun/auth" });
      next(err); 
    }
  }

  async logout(req, res, next) {
    try {
      const token = req.cookies.refreshToken || req.body.refreshToken;
      await akunService.logout(token);
      res.cookie("refreshToken", "", { maxAge: 0, path: "/api/akun/auth" });
      res.json({ message: "Logout berhasil" });
    } catch (err) { next(err); }
  }

  // PROFILE
  async getProfile(req, res, next) {
    try {
      const user = await akunService.getProfile(req.user.id);
      if (!user) return res.status(404).json({ message: "Akun tidak ditemukan" });
      res.json(user);
    } catch (err) { next(err); }
  }

  async updateProfile(req, res, next) {
    try {
      const updated = await akunService.updateProfile(req.user.id, req.body);
      res.json({ message: "Profil diperbarui", data: updated });
    } catch (err) { next(err); }
  }

  async deleteProfile(req, res, next) {
    try {
      res.status(501).json({ message: "Fitur delete akun belum diimplementasi ulang" });
    } catch (err) { next(err); }
  }

  // ADMIN
  async getAllAkun(req, res, next) {
    try {
      const users = await akunService.getAllUsers();
      res.json({ message: "Success", total: users.length, data: users });
    } catch (err) { next(err); }
  }

  // DEVICE
  async getDevice(req, res, next) {
    try {
      // Reuse getProfile biar kena cache
      const user = await akunService.getProfile(req.user.id);
      res.json(user.device);
    } catch (err) { next(err); }
  }

  async addDevice(req, res, next) {
    try {
      const result = await deviceService.addDevice(req.user.id, req.body);
      if (result.error) return res.status(400).json({ errors: result.error });
      res.status(201).json({ message: "Device added", data: result });
    } catch (err) { next(err); }
  }

  async promoteDevice(req, res, next) {
    try {
      const result = await deviceService.promoteDevice(req.user.id, req.body.deviceID);
      if (result.error) return res.status(400).json({ errors: result.error });
      res.json({ message: "Device promoted", data: result });
    } catch (err) { next(err); }
  }

  async demoteDevice(req, res, next) {
    try {
      const result = await deviceService.demoteDevice(req.user.id, req.body.deviceID);
      res.json({ message: "Device demoted", data: result });
    } catch (err) { next(err); }
  }

  async removeDevice(req, res, next) {
    try {
      await deviceService.removeDevice(req.user.id, req.body.deviceID);
      res.json({ message: "Device removed" });
    } catch (err) { next(err); }
  }

  async getDeviceHistory(req, res, next) {
    try {
      const history = await deviceService.getHistory(req.user.id);
      res.json(history);
    } catch (err) { next(err); }
  }
}

module.exports = new AkunController();