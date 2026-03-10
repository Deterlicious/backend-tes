const metodePembayaranService = require("../services/metodePembayaranService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class MetodePembayaranController {
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
        "kelola-metode-pembayaran"
      );

      if (!isAllowed) {
        throw createError(
          403,
          "Akses ditolak. Anda tidak memiliki izin kelola metode pembayaran."
        );
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await metodePembayaranService.getAll(tenantID);

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-metode-pembayaran"
      );

      if (!isAllowed) {
        throw createError(
          403,
          "Akses ditolak. Anda tidak memiliki izin kelola metode pembayaran."
        );
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await metodePembayaranService.getById(
        req.params.id,
        tenantID
      );

      if (!result) {
        throw createError(404, "Metode Pembayaran tidak ditemukan");
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
        "kelola-metode-pembayaran"
      );

      if (!isAllowed) {
        throw createError(
          403,
          "Akses ditolak. Anda tidak memiliki izin kelola metode pembayaran."
        );
      }

      req.body.tenantID = this._getRequesterTenantID(req);

      const result = await metodePembayaranService.create(req.body);

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
        "kelola-metode-pembayaran"
      );

      if (!isAllowed) {
        throw createError(
          403,
          "Akses ditolak. Anda tidak memiliki izin kelola metode pembayaran."
        );
      }

      const tenantID = this._getRequesterTenantID(req);

      delete req.body.tenantID;

      const result = await metodePembayaranService.update(
        req.params.id,
        req.body,
        tenantID
      );

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Metode Pembayaran tidak ditemukan");
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
        "kelola-metode-pembayaran"
      );

      if (!isAllowed) {
        throw createError(
          403,
          "Akses ditolak. Anda tidak memiliki izin kelola metode pembayaran."
        );
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await metodePembayaranService.delete(
        req.params.id,
        tenantID
      );

      if (!result) {
        throw createError(404, "Metode Pembayaran tidak ditemukan");
      }

      res.json({ data: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MetodePembayaranController();