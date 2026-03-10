const asetService = require("../services/asetService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class AsetController {
  async _checkPermission(userPermissionIDs, permissionName) {
    const permissionDoc = await Permission.findOne({ nama: permissionName });

    if (!permissionDoc) return false;

    return userPermissionIDs
      .map((id) => id.toString())
      .includes(permissionDoc._id.toString());
  }

  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  async getAll(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-aset"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola aset");
      }

      const tenantID = this._getRequesterTenantID(req);

      if (!tenantID) {
        throw createError(403, "Akses ditolak. Tenant tidak valid.");
      }

      const result = await asetService.getAll(tenantID, req.query);

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-aset"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola aset");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await asetService.getById(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Aset tidak ditemukan atau beda tenant");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-aset"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola aset");
      }

      const tenantID = this._getRequesterTenantID(req);

      const payload = {
        ...req.body,
        tenantID,
      };

      const result = await asetService.create(payload);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-aset"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola aset");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await asetService.update(
        req.params.id,
        req.body,
        tenantID
      );

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Aset tidak ditemukan");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-aset"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola aset");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await asetService.delete(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Aset tidak ditemukan");
      }

      res.json({ data: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AsetController();