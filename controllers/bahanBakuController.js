const bahanBakuService = require("../services/bahanBakuService");
const createError = require("http-errors");

class BahanBakuController {
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await bahanBakuService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await bahanBakuService.getById(req.params.id);
      if (!result) throw createError(404, "Bahan baku tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await bahanBakuService.create(req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res
        .status(201)
        .json({ data: result, message: "Bahan baku berhasil dibuat" });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await bahanBakuService.update(req.params.id, req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      if (!result) throw createError(404, "Bahan baku tidak ditemukan");

      res.json({ data: result, message: "Bahan baku berhasil diperbarui" });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await bahanBakuService.delete(req.params.id);
      if (!result) throw createError(404, "Bahan baku tidak ditemukan");

      res.json({ message: "Bahan baku berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BahanBakuController();
