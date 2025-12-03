const roleService = require("../services/roleService");
const createError = require("http-errors");

class RoleController {
  
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await roleService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await roleService.getById(req.params.id);
      if (!result) throw createError(404, "Role tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await roleService.create(req.body);
      
      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res.status(201).json({ message: "Role berhasil dibuat", data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await roleService.update(req.params.id, req.body);
      
      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      if (!result) throw createError(404, "Role tidak ditemukan");

      res.json({ message: "Role berhasil diperbarui", data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await roleService.delete(req.params.id);
      if (!result) throw createError(404, "Role tidak ditemukan");
      res.json({ message: "Role berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RoleController();