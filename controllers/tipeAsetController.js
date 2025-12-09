const tipeAsetService = require("../services/tipeAsetService");
const createError = require("http-errors");

class TipeAsetController {
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await tipeAsetService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { tenantID } = req.query;
      if (!tenantID)
        return res.status(400).json({ message: "tenantID required" });

      const result = await tipeAsetService.getById(req.params.id, tenantID);
      if (!result) throw createError(404, "Tipe Aset tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await tipeAsetService.create(req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res
        .status(201)
        .json({ message: "Tipe Aset berhasil dibuat", data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { tenantID } = req.query;
      if (!tenantID)
        return res.status(400).json({ message: "tenantID required" });

      const result = await tipeAsetService.update(
        req.params.id,
        tenantID,
        req.body
      );

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      if (!result) throw createError(404, "Tipe Aset tidak ditemukan");

      res.json({ message: "Tipe Aset berhasil diperbarui", data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { tenantID } = req.query;
      if (!tenantID)
        return res.status(400).json({ message: "tenantID required" });

      const result = await tipeAsetService.delete(req.params.id, tenantID);
      if (!result) throw createError(404, "Tipe Aset tidak ditemukan");

      res.json({ message: "Tipe Aset berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TipeAsetController();
