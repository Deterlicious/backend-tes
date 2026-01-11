const kontrakKompensasiService = require("../services/kontrakKompensasiService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class KontrakKompensasiController {
  async _checkPermission(userPermissionIDs, permissionName) {
    const permissionDoc = await Permission.findOne({
      nama: permissionName
    });
    if (!permissionDoc) return false;

    const hasAccess = userPermissionIDs
      .map((id) => id.toString())
      .includes(permissionDoc._id.toString());

    return hasAccess;
  }

  _getTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  async getAll(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-kontrak-kompensasi"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola kontrak kompensasi");
      }

      const tenantID = this._getTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak. Tenant tidak valid.");

      const result = await kontrakKompensasiService.getAll(tenantID);
      res.json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-kontrak-kompensasi"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola kontrak kompensasi");
      }

      const tenantID = this._getTenantID(req);
      const result = await kontrakKompensasiService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Kontrak tidak ditemukan");
      res.json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-kontrak-kompensasi"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola kontrak kompensasi");
      }

      const tenantID = this._getTenantID(req);
      req.body.tenantID = tenantID;

      const result = await kontrakKompensasiService.create(req.body);
      if (result?.error) return res.status(400).json({
        errors: result.error
      });

      res.status(201).json({
        data: result,
        message: "Kontrak kerja berhasil dibuat"
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-kontrak-kompensasi"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola kontrak kompensasi");
      }

      const tenantID = this._getTenantID(req);
      const result = await kontrakKompensasiService.update(req.params.id, req.body, tenantID);

      if (result?.error) return res.status(400).json({
        errors: result.error
      });
      if (!result) throw createError(404, "Kontrak tidak ditemukan");

      res.json({
        data: result,
        message: "Kontrak berhasil diperbarui"
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-kontrak-kompensasi"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola kontrak kompensasi");
      }

      const tenantID = this._getTenantID(req);
      const result = await kontrakKompensasiService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Kontrak tidak ditemukan");
      res.json({
        message: "Kontrak berhasil dihapus"
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new KontrakKompensasiController();