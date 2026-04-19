const sesiBookingService = require("../services/sesiBookingService");
const createError = require("http-errors");

class SesiBookingController {
  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  _getRequesterUserID(req) {
    return req.pengguna?._id || null;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);

      if (!tenantID) {
        throw createError(403, "Akses ditolak. Tenant tidak valid.");
      }

      const tanggal = req.query.tanggal || null;
      const result = await sesiBookingService.getAll(tenantID, tanggal);

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

      const result = await sesiBookingService.getById(req.params.id, tenantID);

      if (!result) {
        throw createError(404, "Booking tidak ditemukan atau beda tenant");
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const userID = this._getRequesterUserID(req);

      if (!tenantID || !userID) {
        throw createError(403, "Akses ditolak.");
      }

      const payload = {
        ...req.body,
        tenantID,
        dataPengguna: userID,
      };

      const result =
        payload.items && Array.isArray(payload.items)
          ? await sesiBookingService.createBatch(payload)
          : await sesiBookingService.create(payload);

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

      const result = await sesiBookingService.update(
        req.params.id,
        req.body,
        tenantID,
      );

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Booking tidak ditemukan");
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

      const result = await sesiBookingService.delete(req.params.id, tenantID);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) {
        throw createError(404, "Booking tidak ditemukan");
      }

      res.json({ data: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SesiBookingController();
