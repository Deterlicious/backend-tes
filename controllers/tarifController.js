const tarifService = require("../services/tarifService");
const createError = require("http-errors");

class TarifController {
  
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await tarifService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { tenantID } = req.query; // Wajib kirim tenantID demi security & cache key
      if (!tenantID) return res.status(400).json({ message: "tenantID required" });

      const result = await tarifService.getById(req.params.id, tenantID);
      if (!result) throw createError(404, "Tarif tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const result = await tarifService.create(req.body);
      if (result?.error) return res.status(400).json({ errors: result.error });
      res.status(201).json({ message: "Tarif dibuat", data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { tenantID } = req.query;
      if (!tenantID) return res.status(400).json({ message: "tenantID required" });

      const result = await tarifService.update(req.params.id, tenantID, req.body);
      
      if (result?.error) return res.status(400).json({ errors: result.error });
      if (!result) throw createError(404, "Tarif tidak ditemukan");

      res.json({ message: "Tarif diperbarui", data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { tenantID } = req.query;
      if (!tenantID) return res.status(400).json({ message: "tenantID required" });

      const result = await tarifService.delete(req.params.id, tenantID);
      if (!result) throw createError(404, "Tarif tidak ditemukan");

      res.json({ message: "Tarif dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TarifController();