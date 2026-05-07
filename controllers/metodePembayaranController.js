const metodePembayaranService = require("../services/metodePembayaranService");
const createError = require("http-errors");

class MetodePembayaranController {
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

      const result = await metodePembayaranService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await metodePembayaranService.getById(
        req.params.id,
        tenantID,
      );

      if (!result) {
        throw createError(404, "Metode Pembayaran tidak ditemukan");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      // Menyuntikkan tenantID dari sesi login ke dalam body
      req.body.tenantID = this._getRequesterTenantID(req);

      const result = await metodePembayaranService.create(req.body);

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

      // Keamanan: Jangan biarkan tenantID diubah lewat body
      delete req.body.tenantID;

      const result = await metodePembayaranService.update(
        req.params.id,
        req.body,
        tenantID,
      );

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Metode Pembayaran tidak ditemukan");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await metodePembayaranService.delete(
        req.params.id,
        tenantID,
      );

      if (!result) {
        throw createError(404, "Metode Pembayaran tidak ditemukan");
      }

      res.json({ data: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MetodePembayaranController();
