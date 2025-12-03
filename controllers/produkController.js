const produkService = require("../services/produkService");

const createError = require("http-errors");

class ProdukController {
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await produkService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await produkService.getById(req.params.id);
      if (!result) throw createError(404, "Produk tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await produkService.create(req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res.status(201).json({ data: result, message: "Produk berhasil dibuat" });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await produkService.update(req.params.id, req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      if (!result) throw createError(404, "Produk tidak ditemukan");

      res.json({ data: result, message: "Produk berhasil diperbarui" });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await produkService.delete(req.params.id);
      if (!result) throw createError(404, "Produk tidak ditemukan");

      res.json({ message: "Produk berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProdukController();
