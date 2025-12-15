const pembayaranService = require("../services/pembayaranService");
const createError = require("http-errors");

class PembayaranController {
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await pembayaranService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await pembayaranService.getById(req.params.id);
      if (!result) throw createError(404, "Pembayaran tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await pembayaranService.create(req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res
        .status(201)
        .json({ data: result, message: "Pembayaran berhasil dicatat" });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await pembayaranService.update(req.params.id, req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      if (!result) throw createError(404, "Pembayaran tidak ditemukan");

      res.json({ data: result, message: "Pembayaran berhasil diperbarui" });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await pembayaranService.delete(req.params.id);
      if (!result) throw createError(404, "Pembayaran tidak ditemukan");

      res.json({ message: "Pembayaran berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PembayaranController();