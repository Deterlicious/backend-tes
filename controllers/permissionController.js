const permissionService = require("../services/permissionService");
const createError = require("http-errors");

class PermissionController {
  async getAll(req, res, next) {
    try {
      const result = await permissionService.getAll();
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getGrouped(req, res, next) {
    try {
      const result = await permissionService.getGrouped();
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await permissionService.create(req.body);
      
      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res.status(201).json({ 
        message: "Permission berhasil dibuat", 
        data: result 
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await permissionService.delete(req.params.id);
      if (!result) throw createError(404, "Permission tidak ditemukan");

      res.json({ message: "Permission berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PermissionController();