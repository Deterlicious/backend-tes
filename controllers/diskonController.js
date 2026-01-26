const diskonService = require("../services/diskonService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class DiskonController {
  async _checkPermission(userPermissionIDs, permissionName) {
    const permissionDoc = await Permission.findOne({
      nama: permissionName,
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
        "kelola-diskon"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola diskon");
      }

      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak. Tenant tidak valid.");

      const result = await diskonService.getAll(tenantID);
      res.json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-diskon"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola diskon");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await diskonService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Diskon tidak ditemukan atau beda tenant");
      res.json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-diskon"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola diskon");
      }

      const tenantID = this._getRequesterTenantID(req);

      const payload = {
        ...req.body,
        tenantID: tenantID,
      };

      const result = await diskonService.create(payload);

      if (result?.error) {
        return res.status(400).json({
          errors: result.error,
        });
      }

      res.status(201).json({
        data: result,
        message: "Diskon berhasil dibuat",
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-diskon"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola diskon");
      }

      const tenantID = this._getRequesterTenantID(req);
      const payload = req.body;
      const result = await diskonService.update(req.params.id, payload, tenantID);

      if (result?.error) return res.status(400).json({
        errors: result.error
      });
      if (!result) throw createError(404, "Diskon tidak ditemukan");

      res.json({
        data: result,
        message: "Diskon diperbarui",
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-diskon"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola diskon");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await diskonService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Diskon tidak ditemukan");
      res.json({
        message: "Diskon berhasil dihapus",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DiskonController();