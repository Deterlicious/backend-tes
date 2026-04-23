const tenantService = require("../services/tenantService");
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

class TenantController {

  // ==========================================
  // 👑 ADMIN - GET ALL TENANT
  // ==========================================
  async getAll(req, res, next) {
    try {
      const tenants = await tenantService.getAll();

      const formatted = tenants.map((t) => ({
        _id: t._id,
        namaToko: t.namaToko,
        emailBisnis: t.emailBisnis,
        nomorTelepon: t.nomorTelepon,
        alamat: t.alamat,
        kota: t.kota,
        kodePos: t.kodePos,
        persenPajak: t.persenPajak,
        tipePajak: t.tipePajak,
        idNPWP: t.idNPWP,
        logoUrl: t.logoUrl,
        footerStruk: t.footerStruk,
        status: t.status,
        isSetupComplete: t.isSetupComplete,
      }));

      res.json({
        message: "Daftar toko berhasil diambil.",
        total: formatted.length,
        data: formatted,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 🔍 GET BY ID (RBAC + ISOLASI TENANT)
  // ==========================================
  async getById(req, res, next) {
    try {
      const tenantID = req.pengguna?.tenantID;
      const targetId = req.params.id;

      if (!tenantID) {
        throw createError(400, "Tenant tidak ditemukan pada pengguna.");
      }

      // 🔥 Isolasi tenant
      if (tenantID.toString() !== targetId) {
        throw createError(403, "Akses ditolak ke tenant ini.");
      }

      const t = await tenantService.getById(targetId);
      if (!t) throw createError(404, "Tenant tidak ditemukan.");

      res.json({
        message: "Detail toko berhasil diambil.",
        data: {
          _id: t._id,
          namaToko: t.namaToko,
          emailBisnis: t.emailBisnis,
          nomorTelepon: t.nomorTelepon,
          alamat: t.alamat,
          kota: t.kota,
          kodePos: t.kodePos,
          persenPajak: t.persenPajak,
          tipePajak: t.tipePajak,
          idNPWP: t.idNPWP,
          logoUrl: t.logoUrl,
          footerStruk: t.footerStruk,
          status: t.status,
          isSetupComplete: t.isSetupComplete,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 🏗️ CREATE TENANT (PAKAI AKUN)
  // ==========================================
  async create(req, res, next) {
    try {
      const userId = req.userDecoded?.id;
      const deviceID = req.userDecoded?.deviceID;

      if (!userId || !deviceID) {
        throw createError(401, "Identitas akun tidak valid.");
      }

      const { tenant, akun } = await tenantService.createWithOwner(
        req.body,
        userId
      );

      const device = akun.device.find((d) => d.deviceID === deviceID);
      if (!device) throw createError(401, "Sesi perangkat tidak valid.");

      // 🔥 regenerate token (biar tenantID masuk)
      const tokens = akunService.generateTokens(akun, device);
      setRefreshTokenCookie(res, tokens.refreshToken);

      res.status(201).json({
        message: "Toko berhasil dibuat.",
        data: {
          _id: tenant._id,
          namaToko: tenant.namaToko,
          emailBisnis: tenant.emailBisnis,
          nomorTelepon: tenant.nomorTelepon,
          alamat: tenant.alamat,
          kota: tenant.kota,
          kodePos: tenant.kodePos,
          persenPajak: tenant.persenPajak,
          tipePajak: tenant.tipePajak,
          idNPWP: tenant.idNPWP,
          logoUrl: tenant.logoUrl,
          footerStruk: tenant.footerStruk,
          status: tenant.status,
          isSetupComplete: tenant.isSetupComplete,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // ✏️ UPDATE TENANT (RBAC + ISOLASI)
  // ==========================================
  async update(req, res, next) {
    try {
      const tenantID = req.pengguna?.tenantID;
      const targetId = req.params.id;

      if (!tenantID) {
        throw createError(400, "Tenant tidak ditemukan pada pengguna.");
      }

      if (tenantID.toString() !== targetId) {
        throw createError(403, "Tidak bisa mengubah tenant lain.");
      }

      const t = await tenantService.update(targetId, req.body);

      if (t?.error) {
        return res.status(400).json({ errors: t.error });
      }

      if (!t) throw createError(404, "Tenant tidak ditemukan.");

      res.json({
        message: "Data toko berhasil diperbarui.",
        data: {
          _id: t._id,
          namaToko: t.namaToko,
          emailBisnis: t.emailBisnis,
          nomorTelepon: t.nomorTelepon,
          alamat: t.alamat,
          kota: t.kota,
          kodePos: t.kodePos,
          persenPajak: t.persenPajak,
          tipePajak: t.tipePajak,
          idNPWP: t.idNPWP,
          logoUrl: t.logoUrl,
          footerStruk: t.footerStruk,
          status: t.status,
          isSetupComplete: t.isSetupComplete,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // 🗑️ DELETE TENANT (PERMISSION)
  // ==========================================
  async delete(req, res, next) {
    try {
      const tenantID = req.pengguna?.tenantID;
      const targetId = req.params.id;

      if (!tenantID) {
        throw createError(400, "Tenant tidak ditemukan pada pengguna.");
      }

      if (tenantID.toString() !== targetId) {
        throw createError(403, "Tidak bisa menghapus tenant lain.");
      }

      await tenantService.forceDelete(targetId);

      res.json({
        message: "Toko berhasil dihapus.",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TenantController();