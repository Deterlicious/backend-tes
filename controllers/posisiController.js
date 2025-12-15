const posisiService = require("../services/posisiService");
const createError = require("http-errors");

class PosisiController {
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await posisiService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await posisiService.getById(req.params.id);
      if (!result) throw createError(404, "Posisi tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await posisiService.create(req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res
        .status(201)
        .json({ data: result, message: "Posisi berhasil dibuat" });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await posisiService.update(req.params.id, req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      if (!result) throw createError(404, "Posisi tidak ditemukan");

      res.json({ data: result, message: "Posisi berhasil diperbarui" });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await posisiService.delete(req.params.id);
      if (!result) throw createError(404, "Posisi tidak ditemukan");

      res.json({ message: "Posisi berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PosisiController();