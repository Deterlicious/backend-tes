const permissionService = require("../services/permissionService");

class PermissionController {

  // =========================
  // 1. GET ALL
  // =========================
  async getAll(req, res, next) {
    try {
      const result = await permissionService.getAll();

      res.json({
        message: "Daftar permission berhasil diambil.",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================
  // 2. GET GROUPED (UNTUK UI)
  // =========================
  async getGrouped(req, res, next) {
    try {
      const result = await permissionService.getGrouped();

      res.json({
        message: "Daftar permission berhasil diambil (grouped).",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================
  // 3. CREATE
  // =========================
  async create(req, res, next) {
    try {
      const result = await permissionService.create(req.body);

      res.status(201).json({
        message: "Permission berhasil dibuat.",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================
  // 4. UPDATE
  // =========================
  async update(req, res, next) {
    try {
      const result = await permissionService.update(req.params.id, req.body);

      res.json({
        message: "Permission berhasil diperbarui.",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================
  // 5. DELETE
  // =========================
  async delete(req, res, next) {
    try {
      await permissionService.delete(req.params.id);

      res.json({
        message: "Permission berhasil dihapus."
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PermissionController();