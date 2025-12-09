const penjualanService = require("../services/penjualanService");
const createError = require("http-errors");

class PenjualanController {
  async create(req, res, next) {
    try {
      const result = await penjualanService.create(req.body);

      if (result.error) {
        return res.status(400).json({ errors: result.error });
      }

      res.status(201).json({
        message: "Penjualan berhasil ditambahkan",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await penjualanService.getAll(tenantID);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await penjualanService.getById(req.params.id);
      if (!result) throw createError(404, "Penjualan tidak ditemukan");

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await penjualanService.update(req.params.id, req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) throw createError(404, "Penjualan tidak ditemukan");

      res.status(200).json({
        message: "Penjualan berhasil diperbarui",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await penjualanService.delete(req.params.id);
      if (!result) throw createError(404, "Penjualan tidak ditemukan");

      res.status(200).json({ message: "Penjualan berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PenjualanController();