const rolePermissionService = require("../services/rolePermissionService");
const createError = require("http-errors");

class RolePermissionController {
  async assignPermission(req, res, next) {
    try {
      const result = await rolePermissionService.assign(req.body);

      if (result?.error) {
        return res
          .status(409)
          .json({ message: "Konflik data", errors: result.error });
      }

      res.status(201).json({
        message: "Permission berhasil ditambahkan ke role",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getPermissionsByRole(req, res, next) {
    try {
      const { roleId } = req.params;
      const result = await rolePermissionService.getByRole(roleId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getAllRolePermissions(req, res, next) {
    try {
      const result = await rolePermissionService.getAll();
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async removePermission(req, res, next) {
    try {
      const { id } = req.params; // ID dari dokumen RolePermission (Relasi)
      const result = await rolePermissionService.remove(id);

      if (!result) throw createError(404, "Data relasi tidak ditemukan");

      res.json({ message: "Permission berhasil dihapus dari role" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RolePermissionController();
