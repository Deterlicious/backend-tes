const tarifService = require("../services/tarifService");
const createError = require("http-errors");

class TarifController {
  // Fungsi internal untuk mengambil tenantID dari token
  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) {
        throw createError(403, "Tenant tidak valid.");
      }

      // Pastikan query filter tetap dikirim ke service
      const result = await tarifService.getAll(tenantID, req.query);

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) {
        throw createError(403, "Tenant tidak valid.");
      }

      const result = await tarifService.getById(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Tarif tidak ditemukan");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) {
        throw createError(403, "Tenant tidak valid.");
      }

      // Inject tenantID dari token ke dalam payload body
      const payload = {
        ...req.body,
        tenantID,
      };

      const result = await tarifService.create(payload);

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
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) {
        throw createError(403, "Tenant tidak valid.");
      }

      const result = await tarifService.update(
        req.params.id,
        tenantID,
        req.body
      );

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Tarif tidak ditemukan");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) {
        throw createError(403, "Tenant tidak valid.");
      }

      const result = await tarifService.delete(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Tarif tidak ditemukan");
      }

      res.json({ data: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TarifController();