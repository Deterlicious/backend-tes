const jurnalStokService = require("../services/jurnalStokService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class JurnalStokController {
  async _checkPermission(userPermissionIDs, permissionName) {
    const permissions = userPermissionIDs || [];

    if (permissions.includes(permissionName)) return true;

    const permissionDoc = await Permission.findOne({
      nama: permissionName,
    });
    if (!permissionDoc) return false;

    const hasAccess = permissions
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
        "read-jurnal-stok"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses melihat jurnal stok");
      }

      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak. Tenant tidak valid.");

      const result = await jurnalStokService.getAll(tenantID);
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
        "read-jurnal-stok"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses melihat jurnal stok");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await jurnalStokService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Data tidak ditemukan atau beda tenant");
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
        "kelola-jurnal-stok"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola jurnal stok");
      }

      const tenantID = this._getRequesterTenantID(req);
      const userID = this._getRequesterUserID(req);
      const pencatat = req.body.dicatatOleh || userID;

      const payload = {
        ...req.body,
        tenantID: tenantID,
        dicatatOleh: pencatat,
      };

      const result = await jurnalStokService.create(payload);

      if (result?.error) {
        return res.status(400).json({
          errors: result.error,
        });
      }

      res.status(201).json({
        data: result,
        message: "Jurnal Stok berhasil ditambahkan",
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-jurnal-stok"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola jurnal stok");
      }

      const tenantID = this._getRequesterTenantID(req);
      const payload = req.body;
      const result = await jurnalStokService.update(req.params.id, payload, tenantID);

      if (result?.error) return res.status(400).json({
        errors: result.error
      });
      if (!result) throw createError(404, "Data tidak ditemukan");

      res.json({
        data: result,
        message: "Jurnal Stok berhasil diperbarui",
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-jurnal-stok"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola jurnal stok");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await jurnalStokService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Data tidak ditemukan");
      res.json({
        message: "Jurnal Stok berhasil dihapus",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new JurnalStokController();
