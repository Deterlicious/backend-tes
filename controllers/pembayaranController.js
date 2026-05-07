const pembayaranService = require("../services/pembayaranService");
const createError = require("http-errors");

class PembayaranController {
  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await pembayaranService.getAll(tenantID);

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await pembayaranService.getById(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Pembayaran tidak ditemukan");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      req.body.tenantID = this._getRequesterTenantID(req);

      const result = await pembayaranService.create(req.body);

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

      delete req.body.tenantID;
      delete req.body.penjualanID;
      delete req.body.noReferensi;

      const result = await pembayaranService.update(
        req.params.id,
        req.body,
        tenantID,
      );

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Pembayaran tidak ditemukan");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await pembayaranService.delete(req.params.id, tenantID);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Pembayaran tidak ditemukan");
      }

      res.json({ data: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PembayaranController();
