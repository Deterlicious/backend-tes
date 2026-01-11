const pembayaranService = require("../services/pembayaranService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class PembayaranController {
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

  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  async getAll(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-pembayaran"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola pembayaran");
      }

      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak. Tenant tidak valid.");

      const result = await pembayaranService.getAll(tenantID);
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
        "kelola-pembayaran"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola pembayaran");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await pembayaranService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Pembayaran tidak ditemukan");
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
        "kelola-pembayaran"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola pembayaran");
      }

      const tenantID = this._getRequesterTenantID(req);
      req.body.tenantID = tenantID;

      const result = await pembayaranService.create(req.body);

      if (result?.error) {
        return res.status(400).json({
          errors: result.error
        });
      }

      res.status(201).json({
        data: result,
        message: "Pembayaran berhasil dicatat"
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-pembayaran"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola pembayaran");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await pembayaranService.update(req.params.id, req.body, tenantID);

      if (result?.error) {
        return res.status(400).json({
          errors: result.error
        });
      }

      if (!result) throw createError(404, "Pembayaran tidak ditemukan");

      res.json({
        data: result,
        message: "Pembayaran berhasil diperbarui"
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-pembayaran"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola pembayaran");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await pembayaranService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Pembayaran tidak ditemukan");
      res.json({
        message: "Pembayaran berhasil dihapus"
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PembayaranController();