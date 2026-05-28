const kategoriService = require("../services/kategoriService");
const createError = require("http-errors");
const Permission = require("../models/permissionModel");

class KategoriController {
  async getAll(req, res, next) {
    try {
      const tenantID = req.pengguna.tenantID;
      const result = await kategoriService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = req.pengguna;
      const result = await kategoriService.getById(req.params.id, tenantID);
      if (!result) throw createError(404, "Kategori tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
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
      const result = await kategoriService.update(
        req.params.id,
        req.body,
        req.pengguna.tenantID, // atau req.user.tenantID, sesuai middleware Sir
      );
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
      const result = await kategoriService.delete(
        req.params.id,
        req.pengguna.tenantID,
      );
      if (!result) throw createError(404, "Kategori tidak ditemukan");
      res.json({ message: "Kategori berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new KategoriController();