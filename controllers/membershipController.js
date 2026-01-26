const membershipService = require("../services/membershipService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class MembershipController {
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
        "kelola-membership"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola membership");
      }

      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak. Tenant tidak valid.");

      const result = await membershipService.getAll(tenantID);
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
        "kelola-membership"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola membership");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await membershipService.getById(req.params.id, tenantID);

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
        "kelola-membership"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola membership");
      }

      const tenantID = this._getRequesterTenantID(req);

      const payload = {
        ...req.body,
        tenantID: tenantID,
      };

      const result = await membershipService.create(payload);

      if (result?.error) {
        return res.status(400).json({
          errors: result.error,
        });
      }

      res.status(201).json({
        data: result,
        message: "Membership berhasil ditambahkan",
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-membership"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola membership");
      }

      const tenantID = this._getRequesterTenantID(req);
      const payload = req.body;
      const result = await membershipService.update(req.params.id, payload, tenantID);

      if (result?.error) return res.status(400).json({
        errors: result.error
      });
      if (!result) throw createError(404, "Data tidak ditemukan");

      res.json({
        data: result,
        message: "Membership berhasil diperbarui",
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-membership"
      );
      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola membership");
      }

      const tenantID = this._getRequesterTenantID(req);
      const result = await membershipService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Data tidak ditemukan");
      res.json({
        message: "Membership berhasil dihapus",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MembershipController();