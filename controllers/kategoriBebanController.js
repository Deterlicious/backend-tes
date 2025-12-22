const kategoriBebanService = require("../services/kategoriBebanService");
const createError = require("http-errors");

class KategoriBebanController {
  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak");

      const result = await kategoriBebanService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await kategoriBebanService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Kategori beban tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      req.body.tenantID = tenantID;

      const result = await kategoriBebanService.create(req.body);
      if (result?.error) return res.status(400).json({ errors: result.error });

      res.status(201).json({
        data: result,
        message: "Kategori beban berhasil dibuat"
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await kategoriBebanService.update(req.params.id, req.body, tenantID);

      if (result?.error) return res.status(400).json({ errors: result.error });
      if (!result) throw createError(404, "Kategori beban tidak ditemukan");

      res.json({
        data: result,
        message: "Kategori beban berhasil diperbarui"
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await kategoriBebanService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Kategori beban tidak ditemukan");
      res.json({ message: "Kategori beban berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new KategoriBebanController();