const penjualanService = require("../services/penjualanService");
const createError = require("http-errors");

class PenjualanController {
  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  _getRequesterPenggunaID(req) {
    return req.pengguna?._id || req.pengguna?.id || null;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);

      if (!tenantID) {
        throw createError(403, "Tenant tidak valid.");
      }

      const filters = {
        statusBayar: req.query.statusBayar,
        statusPenjualan: req.query.statusPenjualan,
        jenisTransaksi: req.query.jenisTransaksi,
        jenisPenjualan: req.query.jenisPenjualan,
        pelangganID: req.query.pelangganID,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        noReferensi: req.query.noReferensi,
      };

      const result = await penjualanService.getAll(tenantID, filters);

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

      const result = await penjualanService.getById(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Penjualan tidak ditemukan");
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

      const penggunaID = this._getRequesterPenggunaID(req);

      if (!penggunaID) {
        throw createError(401, "Pengguna tidak valid.");
      }

      const payload = {
        ...req.body,
        tenantID,
        penggunaID,
      };

      const result = await penjualanService.create(payload);

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

      const result = await penjualanService.update(
        req.params.id,
        req.body,
        tenantID,
      );

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Penjualan tidak ditemukan");
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

      const ok = await penjualanService.delete(req.params.id, tenantID);

      if (!ok) {
        throw createError(404, "Penjualan tidak ditemukan");
      }

      res.json({ data: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PenjualanController();