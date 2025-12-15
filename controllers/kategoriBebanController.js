const kategoriBebanService = require("../services/kategoriBebanService");
const createError = require("http-errors");

class KategoriBebanController {
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await kategoriBebanService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await kategoriBebanService.getById(req.params.id);
      if (!result) throw createError(404, "Kategori beban tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await kategoriBebanService.create(req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res
        .status(201)
        .json({ data: result, message: "Kategori beban berhasil dibuat" });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await kategoriBebanService.update(req.params.id, req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      if (!result) throw createError(404, "Kategori beban tidak ditemukan");

      res.json({ data: result, message: "Kategori beban berhasil diperbarui" });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await kategoriBebanService.delete(req.params.id);
      if (!result) throw createError(404, "Kategori beban tidak ditemukan");

      res.json({ message: "Kategori beban berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new KategoriBebanController();