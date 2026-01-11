const penjualanService = require("../services/penjualanService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class PenjualanController {
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

  async create(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-penjualan"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola penjualan");
      }

      const tenantID = this._getRequesterTenantID(req);
      req.body.tenantID = tenantID;

      const result = await penjualanService.create(req.body);

      if (result.error) {
        return res.status(400).json({
          errors: result.error
        });
      }

      res.status(201).json({
        message: "Penjualan berhasil ditambahkan",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getAll(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-penjualan"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola penjualan");
      }

      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak. Tenant tidak valid.");

      const result = await penjualanService.getAll(tenantID);
      res.status(200).json({
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
        "kelola-penjualan"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola penjualan");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await penjualanService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Penjualan tidak ditemukan atau beda tenant");
      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-penjualan"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola penjualan");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await penjualanService.update(req.params.id, req.body, tenantID);

      if (result?.error) {
        return res.status(400).json({
          errors: result.error
        });
      }

      if (!result) throw createError(404, "Penjualan tidak ditemukan");

      res.status(200).json({
        message: "Penjualan berhasil diperbarui",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-penjualan"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola penjualan");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await penjualanService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Penjualan tidak ditemukan");
      res.status(200).json({
        message: "Penjualan berhasil dihapus"
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PenjualanController();