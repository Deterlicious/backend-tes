const pembelianStokService = require("../services/pembelianStokService");
const createError = require("http-errors");

class PembelianStokController {
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

      const result = await pembelianStokService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await pembelianStokService.getById(req.params.id, tenantID);

      if (!result) throw createError(404, "Pembelian stok tidak ditemukan");
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

      const result = await pembelianStokService.create(req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res.status(201).json({
        data: result,
        message: "Pembelian stok berhasil dicatat"
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await pembelianStokService.update(req.params.id, req.body, tenantID);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) throw createError(404, "Pembelian stok tidak ditemukan");

      res.json({
        data: result,
        message: "Pembelian stok berhasil diperbarui"
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await pembelianStokService.delete(req.params.id, tenantID);

      if (!result) throw createError(404, "Pembelian stok tidak ditemukan");
      res.json({ message: "Pembelian stok berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PembelianStokController();