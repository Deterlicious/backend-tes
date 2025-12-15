const pelangganService = require("../services/pelangganService");
const createError = require("http-errors");

class PelangganController {
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await pelangganService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await pelangganService.getById(req.params.id);
      if (!result) throw createError(404, "Pelanggan tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await pelangganService.create(req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res
        .status(201)
        .json({ data: result, message: "Pelanggan berhasil ditambahkan" });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await pelangganService.update(req.params.id, req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      if (!result) throw createError(404, "Pelanggan tidak ditemukan");

      res.json({ data: result, message: "Pelanggan berhasil diperbarui" });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await pelangganService.delete(req.params.id);
      if (!result) throw createError(404, "Pelanggan tidak ditemukan");

      res.json({ message: "Pelanggan berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PelangganController();