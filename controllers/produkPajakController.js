const produkPajakService = require("../services/produkPajakService");
const { validateProdukPajakPayload } = require("../validators/produkPajakValidator");
const createError = require("http-errors");

class ProdukPajakController {
  async assign(req, res, next) {
    try {
      const validation = validateProdukPajakPayload(req.body);

      if (!validation.valid) {
        throw createError(400, validation.errors.join(", "));
      }

      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
      };

      const result = await produkPajakService.assignPajak(payload);

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getByTarget(req, res, next) {
    try {
      const { targetID } = req.params;

      const data = await produkPajakService.getPajakByTarget(
        targetID,
        req.pengguna.tenantID
      );

      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async unassign(req, res, next) {
    try {
      const result = await produkPajakService.unassignPajak(
        req.params.id,
        req.pengguna.tenantID
      );

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProdukPajakController();