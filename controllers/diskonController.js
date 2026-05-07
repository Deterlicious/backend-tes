const diskonService = require("../services/diskonService");
const createError = require("http-errors");

class DiskonController {
  // Mengambil Tenant ID dari middleware autentikasi
  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);

      if (!tenantID) {
        throw createError(403, "Akses ditolak. Tenant tidak valid.");
      }

      const result = await diskonService.getAll(tenantID, req.query);

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await diskonService.getById(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Diskon tidak ditemukan atau beda tenant");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);

      const payload = {
        ...req.body,
        tenantID,
      };

      const result = await diskonService.create(payload);

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

      // Keamanan: Pastikan tenantID tidak bisa diubah dari body
      delete req.body.tenantID;

      const result = await diskonService.update(
        req.params.id,
        req.body,
        tenantID,
      );

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Diskon tidak ditemukan");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await diskonService.delete(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Diskon tidak ditemukan");
      }

      res.json({ data: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DiskonController();
