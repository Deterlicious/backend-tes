const tenantService = require("../services/tenantService");
const createError = require("http-errors");

class TenantController {
  async getAll(req, res, next) {
    try {
      const tenants = await tenantService.getAll();
      res.json({ data: tenants });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenant = await tenantService.getById(req.params.id);
      if (!tenant) throw createError(404, "Tenant tidak ditemukan");

      res.json({ data: tenant });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      // Kirim req.user.id (didapat dari middleware auth) ke service
      const userId = req.user ? req.user.id : null;

      const result = await tenantService.create(req.body, userId);

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
      const result = await tenantService.update(req.params.id, req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) throw createError(404, "Tenant tidak ditemukan");

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const deleted = await tenantService.delete(req.params.id);
      if (!deleted) throw createError(404, "Tenant tidak ditemukan");

      res.json({ message: "Berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TenantController();
