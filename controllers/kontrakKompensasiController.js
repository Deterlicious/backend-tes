const kontrakService = require("../services/kontrakKompensasiService");
const createError = require("http-errors");

class KontrakKompensasiController {
  _getTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak");

      const result = await kontrakService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getTenantID(req);
      const result = await kontrakService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Kontrak tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const tenantID = this._getTenantID(req);
      req.body.tenantID = tenantID;

      const result = await kontrakService.create(req.body);
      if (result?.error) return res.status(400).json({ errors: result.error });

      res.status(201).json({
        data: result,
        message: "Kontrak kerja berhasil dibuat"
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const tenantID = this._getTenantID(req);
      const result = await kontrakService.update(req.params.id, req.body, tenantID);

      if (result?.error) return res.status(400).json({ errors: result.error });
      if (!result) throw createError(404, "Kontrak tidak ditemukan");

      res.json({
        data: result,
        message: "Kontrak berhasil diperbarui"
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantID = this._getTenantID(req);
      const result = await kontrakService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Kontrak tidak ditemukan");
      res.json({ message: "Kontrak berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new KontrakKompensasiController();