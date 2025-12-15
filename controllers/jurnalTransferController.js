const jurnalTransferService = require("../services/jurnalTransferService");
const createError = require("http-errors");

class JurnalTransferController {
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await jurnalTransferService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await jurnalTransferService.getById(req.params.id);
      if (!result) throw createError(404, "Jurnal transfer tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await jurnalTransferService.create(req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res
        .status(201)
        .json({ data: result, message: "Jurnal Transfer berhasil dibuat" });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await jurnalTransferService.update(req.params.id, req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }
      if (!result) throw createError(404, "Jurnal transfer tidak ditemukan");

      res.json({ data: result, message: "Jurnal Transfer berhasil diperbarui" });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await jurnalTransferService.delete(req.params.id);
      if (!result) throw createError(404, "Jurnal transfer tidak ditemukan");

      res.json({ message: "Jurnal Transfer berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new JurnalTransferController();