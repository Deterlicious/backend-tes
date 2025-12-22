const jurnalTransferService = require("../services/jurnalTransferService");
const createError = require("http-errors");

class JurnalTransferController {
  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  _getRequesterUserID(req) {
    return req.pengguna?._id || null;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak. Tenant tidak valid.");

      const result = await jurnalTransferService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await jurnalTransferService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Jurnal tidak ditemukan atau beda tenant");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const userID = this._getRequesterUserID(req);

      req.body.tenantID = tenantID;
      req.body.dicatatOleh = userID;

      const result = await jurnalTransferService.create(req.body);
      if (result?.error) return res.status(400).json({ errors: result.error });

      res.status(201).json({
        data: result,
        message: "Jurnal Transfer berhasil dibuat"
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await jurnalTransferService.update(req.params.id, req.body, tenantID);

      if (result?.error) return res.status(400).json({ errors: result.error });
      if (!result) throw createError(404, "Jurnal tidak ditemukan");

      res.json({
        data: result,
        message: "Jurnal Transfer diperbarui"
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await jurnalTransferService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Jurnal tidak ditemukan");
      res.json({ message: "Jurnal Transfer berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new JurnalTransferController();