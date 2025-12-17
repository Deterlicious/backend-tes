const akunService = require("../services/akunService");
const deviceService = require("../services/deviceService");
const Akun = require("../models/akunModel");
const createError = require("http-errors");

const setRefreshTokenCookie = (res, token) => {
    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/akun/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });
  };

class AkunController {

  async register(req, res, next) {
    try {
      const result = await akunService.register(req.body);
      if (result.error) return res.status(400).json({ errors: result.error });
      res.status(201).json({ message: "Registrasi berhasil", data: result });
    } catch (err) { next(err); }
  }

  async login(req, res, next) {
    try {
      const { email, password, deviceID } = req.body;
      if (!email || !password || !deviceID) {
        return res.status(400).json({ message: "Email, Password, dan Device ID wajib diisi." });
      }
      const result = await akunService.login(req.body);
      if (result.error) return res.status(400).json({ message: result.error });

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
      if (!token) return res.status(401).json({ message: "Refresh Token tidak ditemukan" });
      const tokens = await akunService.refreshToken(token);
      setRefreshTokenCookie(res, tokens.refreshToken);
      res.json(tokens);
    } catch (err) { 
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
  
  async getProfile(req, res, next) {
    try {
      // Client boleh lihat profil sendiri
      const userId = req.userDecoded.id; 
      const user = await akunService.getProfile(userId);
      if (!user) return res.status(404).json({ message: "Akun tidak ditemukan" });
      res.json(user);
    } catch (err) { next(err); }
  }

  async updateProfile(req, res, next) {
    try {
      // Client boleh update profil sendiri (username/email), TAPI tidak bisa ubah Role (dijaga di Service)
      const userId = req.userDecoded.id;
      const updated = await akunService.updateProfile(userId, req.body);
      res.json({ message: "Profil diperbarui", data: updated });
    } catch (err) { next(err); }
  }

  async getAllAkun(req, res, next) {
    try {
      // Role check sudah dilakukan di middleware route
      const users = await akunService.getAllUsers();
      res.json({ message: "Success", total: users.length, data: users });
    } catch (err) { next(err); }
  }

  async deleteUserByAdmin(req, res, next) {
    try {
      const targetUserId = req.params.id;
      
      // Proteksi: Admin tidak boleh menghapus dirinya sendiri lewat route ini (opsional)
      if (targetUserId === req.userDecoded.id) {
          return res.status(400).json({ message: "Tidak dapat menghapus akun sendiri via Admin Route." });
      }

      const deleted = await Akun.findByIdAndDelete(targetUserId);
      if (!deleted) return res.status(404).json({ message: "User tidak ditemukan" });

      // Hapus cache terkait
      await akunService.clearCache(targetUserId);

      res.json({ message: "Akun berhasil dihapus oleh Super Admin" });
    } catch (err) { next(err); }
  }

  async getDevice(req, res, next) {
    try {
      const devices = req.akun.device; 
      res.json(devices);
    } catch (err) { next(err); }
  }

  async addDevice(req, res, next) {
    try {
      const userId = req.userDecoded.id;
      const result = await deviceService.addDevice(userId, req.body);
      if (result.error) return res.status(400).json({ errors: result.error });
      res.status(201).json({ message: "Device added", data: result });
    } catch (err) { next(err); }
  }

  async promoteDevice(req, res, next) {
    try {
      const userId = req.userDecoded.id;
      const result = await deviceService.promoteDevice(userId, req.body.deviceID);
      if (result.error) return res.status(400).json({ errors: result.error });
      res.json({ message: "Device promoted", data: result });
    } catch (err) { next(err); }
  }

  async demoteDevice(req, res, next) {
    try {
      const userId = req.userDecoded.id;
      const result = await deviceService.demoteDevice(userId, req.body.deviceID);
      res.json({ message: "Device demoted", data: result });
    } catch (err) { next(err); }
  }

  async removeDevice(req, res, next) {
    try {
      const userId = req.userDecoded.id;
      await deviceService.removeDevice(userId, req.body.deviceID);
      res.json({ message: "Device removed" });
    } catch (err) { next(err); }
  }

  async getDeviceHistory(req, res, next) {
    try {
      const userId = req.userDecoded.id;
      const history = await deviceService.getHistory(userId);
      res.json(history);
    } catch (err) { next(err); }
  }
}

module.exports = new AkunController();