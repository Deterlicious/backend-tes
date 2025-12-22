const kategoriService = require("../services/kategoriService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class KategoriController {
  async _checkPermission(userPermissionIDs, permissionName) {
    const permissionDoc = await Permission.findOne({ nama: permissionName });
    if (!permissionDoc) return false;
    const hasAccess = userPermissionIDs
      .map((id) => id.toString())
      .includes(permissionDoc._id.toString());
    return hasAccess;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = req.pengguna.tenantID;
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-kategori"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola kategori");
      }
      const result = await kategoriService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = req.pengguna;
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-kategori"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola kategori");
      }
      const result = await kategoriService.getById(req.params.id, tenantID);
      if (!result) throw createError(404, "Kategori tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-kategori"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola kategori");
      }
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
      };
      const result = await kategoriService.create(payload);
      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      res
        .status(201)
        .json({ data: result, message: "Kategori berhasil dibuat" });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-kategori"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola kategori");
      }
      const result = await kategoriService.update(req.params.id, req.body);
      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      if (!result) throw createError(404, "Kategori tidak ditemukan");
      res.json({ data: result, message: "Kategori berhasil diperbarui" });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const isAllowed = await this._checkPermission(
        req.pengguna.permissions,
        "kelola-kategori"
      );

      if (!isAllowed) {
        throw createError(403, "Anda tidak memiliki akses kelola kategori");
      }

      const result = await kategoriService.delete(req.params.id);
      if (!result) throw createError(404, "Kategori tidak ditemukan");
      res.json({ message: "Kategori berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new KategoriController();
