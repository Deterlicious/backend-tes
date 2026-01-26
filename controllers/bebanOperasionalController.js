const bebanOperasionalService = require("../services/bebanOperasionalService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class BebanOperasionalController {
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

  _getRequesterUserID(req) {
    return req.pengguna?._id || null;
  }

  async getAll(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-beban-operasional"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola beban operasional");
      }

      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak. Tenant tidak valid.");

      const result = await bebanOperasionalService.getAll(tenantID);
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
        "kelola-beban-operasional"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola beban operasional");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await bebanOperasionalService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Beban tidak ditemukan atau beda tenant");
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
        "kelola-beban-operasional"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola beban operasional");
      }

      const tenantID = this._getRequesterTenantID(req);
      const userID = this._getRequesterUserID(req);

      const payload = {
        ...req.body,
        tenantID: tenantID,
        dicatatOleh: userID,
      };

      const result = await bebanOperasionalService.create(payload);

      if (result?.error) {
        return res.status(400).json({
          errors: result.error,
        });
      }

      res.status(201).json({
        data: result,
        message: "Beban Operasional berhasil dibuat",
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-beban-operasional"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola beban operasional");
      }

      const tenantID = this._getRequesterTenantID(req);
      const payload = req.body;
      const result = await bebanOperasionalService.update(req.params.id, payload, tenantID);

      if (result?.error) return res.status(400).json({
        errors: result.error
      });
      if (!result) throw createError(404, "Beban tidak ditemukan");

      res.json({
        data: result,
        message: "Beban Operasional diperbarui",
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-beban-operasional"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola beban operasional");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await bebanOperasionalService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Beban tidak ditemukan");
      res.json({
        message: "Beban Operasional berhasil dihapus",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BebanOperasionalController();