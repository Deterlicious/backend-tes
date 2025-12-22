const pelangganService = require("../services/pelangganService");
const createError = require("http-errors");

class PelangganController {
  _getRequesterTenantID(req) {
    if (req.pengguna && req.pengguna.tenantID) return req.pengguna.tenantID;
    if (req.akun && req.akun.tenantID) return req.akun.tenantID;
    return null;
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) throw createError(403, "Tenant ID tidak teridentifikasi");

      const result = await pelangganService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await pelangganService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Pelanggan tidak ditemukan atau beda tenant");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID) throw createError(403, "Akses ditolak");

      req.body.tenantID = tenantID;

      const result = await pelangganService.create(req.body);
      if (result?.error) return res.status(400).json({ errors: result.error });

      res.status(201).json({
        data: result,
        message: "Pelanggan berhasil ditambahkan"
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await pelangganService.update(req.params.id, req.body, tenantID);

      if (result?.error) return res.status(400).json({ errors: result.error });
      if (!result) throw createError(404, "Pelanggan tidak ditemukan");

      res.json({
        data: result,
        message: "Pelanggan berhasil diperbarui"
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await pelangganService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Pelanggan tidak ditemukan");
      res.json({ message: "Pelanggan berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PelangganController();