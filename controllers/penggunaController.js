const penggunaService = require("../services/penggunaService");
const authService = require("../services/authService");
const createError = require("http-errors");

class PenggunaController {

  async loginPin(req, res, next) {
    try {
      const { tenantID, pin } = req.body;
      const result = await authService.loginPin(tenantID, pin);

      if (result.error) return res.status(400).json({ errors: result.error });

      res.cookie("penggunaRefreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/pengguna",
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });

      res.json({
        message: "Login berhasil",
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        data: {
          id: result.user._id,
          nama: result.user.nama,
          roleID: result.user.roleID,
          permissions: result.permissions
        }
      });
    } catch (err) { next(err); }
  }

  async refreshToken(req, res, next) {
    try {
      const token = req.cookies.penggunaRefreshToken || req.body.refreshToken;
      const result = await authService.refreshToken(token);

      res.cookie("penggunaRefreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/pengguna",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json(result);
    } catch (err) { next(err); }
  }

  async logout(req, res, next) {
    try {
      // Pastikan req.pengguna ada (middleware authPengguna harus jalan)
      if (req.pengguna?.id) {
        await authService.logout(req.pengguna.id);
      }
      res.cookie("penggunaRefreshToken", "", { maxAge: 0 });
      res.json({ message: "Logout berhasil" });
    } catch (err) { next(err); }
  }

  // Helper Private untuk mendapatkan Tenant ID dari Token (Akun atau Pengguna)
  _getRequesterTenantID(req) {
    // Prioritas 1: Owner (Akun)
    if (req.akun && req.akun.tenantID) return req.akun.tenantID;
    // Prioritas 2: Manager/Staff (Pengguna)
    if (req.pengguna && req.pengguna.tenantID) return req.pengguna.tenantID;
    
    return null;
  }

  async create(req, res, next) {
    try {
      const requesterTenantID = this._getRequesterTenantID(req);
      
      if (!requesterTenantID) {
        throw createError(403, "Akses ditolak. Tenant ID tidak teridentifikasi.");
      }

      // SECURITY FORCE: Timpa tenantID di body dengan ID dari token requester
      // Jangan biarkan user kirim tenantID sembarangan di body
      req.body.tenantID = requesterTenantID;

      const result = await penggunaService.create(req.body);
      
      if (result?.error) return res.status(400).json({ errors: result.error });

      res.status(201).json({ 
        message: "Pengguna berhasil dibuat", 
        data: { id: result._id, nama: result.nama } 
      });
    } catch (err) { next(err); }
  }

  async getAll(req, res, next) {
    try {
      // Jangan ambil dari req.query.tenantID
      const requesterTenantID = this._getRequesterTenantID(req);
      
      if (!requesterTenantID) throw createError(403, "Unauthorized Tenant Access");

      const result = await penggunaService.getAll(requesterTenantID);
      res.json({ data: result });
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      // Kirim requesterTenantID ke service
      const requesterTenantID = this._getRequesterTenantID(req);
      
      const result = await penggunaService.getById(req.params.id, requesterTenantID);
      
      if (!result) throw createError(404, "User tidak ditemukan (atau beda tenant)");
      res.json({ data: result });
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      // Kirim requesterTenantID ke service untuk filter update
      const requesterTenantID = this._getRequesterTenantID(req);

      const result = await penggunaService.update(req.params.id, req.body, requesterTenantID);
      
      if (result?.error) return res.status(400).json({ errors: result.error });
      if (!result) throw createError(404, "User tidak ditemukan");

      res.json({ message: "User updated", data: result });
    } catch (err) { next(err); }
  }

  async delete(req, res, next) {
    try {
      // Kirim requesterTenantID ke service untuk filter delete
      const requesterTenantID = this._getRequesterTenantID(req);

      const result = await penggunaService.delete(req.params.id, requesterTenantID);
      if (!result) throw createError(404, "User tidak ditemukan");
      res.json({ message: "User deleted" });
    } catch (err) { next(err); }
  }

  // Khusus ini boleh Public (tergantung use case), tapi biasanya butuh tenantID di URL
  async getForLoginScreen(req, res, next) {
    try {
      // Ambil dari params URL (Public Route untuk Layar Login POS)
      const tenantID = req.params.tenantID; 
      const result = await penggunaService.getForLoginScreen(tenantID);
      res.json({ data: result });
    } catch (err) { next(err); }
  }
}

module.exports = new PenggunaController();