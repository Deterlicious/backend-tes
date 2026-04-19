const tipeAsetService = require("../services/tipeAsetService");
const createError = require("http-errors");

class TipeAsetController {
  // Fungsi bantuan untuk mengambil tenantID dari token
  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) {
        throw createError(403, "Akses ditolak. Tenant tidak valid.");
      }

      const result = await tipeAsetService.getAll(tenantID, req.query);

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) {
        throw createError(403, "Akses ditolak. Tenant tidak valid.");
      }

      const result = await tipeAsetService.getById(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Tipe Aset tidak ditemukan");
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
        throw createError(403, "Akses ditolak. Tenant tidak valid.");
      }

      // Gabungkan body dari request dengan tenantID dari token
      const payload = {
        ...req.body,
        tenantID,
      };

      const result = await tipeAsetService.create(payload);

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
        throw createError(403, "Akses ditolak. Tenant tidak valid.");
      }

      const result = await tipeAsetService.update(
        req.params.id,
        tenantID,
        req.body
      );

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Tipe Aset tidak ditemukan");
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
        throw createError(403, "Akses ditolak. Tenant tidak valid.");
      }

      const result = await tipeAsetService.delete(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Tipe Aset tidak ditemukan");
      }

      res.json({ data: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TipeAsetController();