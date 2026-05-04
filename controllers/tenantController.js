const tenantService = require("../services/tenantService");
const akunService = require("../services/akunService");
const createError = require("http-errors");
const mongoose = require("mongoose");

// perbaikan: path diubah ke root agar konsisten dengan middleware lainnya
const setRefreshTokenCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

class TenantController {
  // mengambil semua daftar tenant
  async getAll(req, res, next) {
    try {
      const tenants = await tenantService.getAll();

      // perbaikan: langsung mengirim data dari service tanpa pemetaan manual yang berulang
      res.json({
        message: "Daftar toko berhasil diambil.",
        total: tenants.length,
        data: tenants,
      });
    } catch (err) {
      next(err);
    }
  }

  // mengambil tenant berdasarkan id
  async getById(req, res, next) {
    try {
      const tenantID = req.userDecoded?.tenantID;
      const targetId = req.params.id;

      // Validasi format ID dulu
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        throw createError(400, "ID tenant tidak valid.");
      }

      // Isolasi tenant — hanya bisa lihat tenant sendiri
      if (String(tenantID) !== String(targetId)) {
        throw createError(403, "Akses ditolak ke tenant ini.");
      }
      const tenant = await tenantService.getById(req.params.id);
      if (!tenant) throw createError(404, "Tenant tidak ditemukan.");

      // perbaikan: mempermudah pengiriman data tanpa hardcoding field
      res.json({
        message: "Detail toko berhasil diambil.",
        data: tenant,
      });
    } catch (err) {
      next(err);
    }
  }

  // membuat tenant baru sekaligus registrasi owner
  async createWithOwner(req, res, next) {
    try {
      // perbaikan: mengambil id dari akunContext sesuai middleware terbaru
      const akunID = req.userDecoded?.id;
      if (!akunID) throw createError(401, "Sesi akun tidak valid.");

      const result = await tenantService.createWithOwner(req.body, akunID);

      const { accessToken, refreshToken } = akunService.generateTokens(
        result.akun,
      );
      setRefreshTokenCookie(res, refreshToken);

      res.status(201).json({
        message: "Registrasi toko dan owner berhasil.",
        data: {
          tenant: result.tenant,
          owner: {
            id: result.akun._id,
            email: result.akun.email,
          },
          accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // memperbarui data tenant
  async update(req, res, next) {
    try {
      const extractedTenantID = req.userDecoded?.tenantID;

      const targetId = req.params.id;

      // VALIDASI ID dulu (penting)
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        throw createError(400, "ID tenant tidak valid.");
      }

      if (!extractedTenantID) {
        throw createError(
          403,
          "Akses ditolak. Tidak dapat mengidentifikasi asal toko Anda.",
        );
      }

      // Pastikan hanya bisa update tenant sendiri
      if (String(extractedTenantID) !== String(targetId)) {
        throw createError(
          403,
          "Anda tidak memiliki izin untuk mengubah data toko ini.",
        );
      }

      const t = await tenantService.update(targetId, req.body);

      if (!t) throw createError(404, "Tenant tidak ditemukan.");

      res.json({
        message: "Data toko berhasil diperbarui.",
        data: t,
      });
    } catch (err) {
      next(err);
    }
  }

  // menghapus tenant secara permanen
  async delete(req, res, next) {
    try {
      const extractedTenantID = req.userDecoded?.tenantID;
      const targetId = req.params.id;

      // VALIDASI ID dulu (penting)
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        throw createError(400, "ID tenant tidak valid.");
      }

      if (!extractedTenantID) {
        throw createError(
          403,
          "Akses ditolak. Tidak dapat mengidentifikasi asal toko Anda.",
        );
      }

      // Pastikan hanya bisa update tenant sendiri
      if (String(extractedTenantID) !== String(targetId)) {
        throw createError(
          403,
          "Anda tidak memiliki izin untuk menghapus data toko ini.",
        );
      }

      await tenantService.delete(targetId);

      res.json({
        message:
          "Tenant dan seluruh data terkait berhasil dihapus secara permanen.",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TenantController();
