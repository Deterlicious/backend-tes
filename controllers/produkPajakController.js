const produkPajakService = require("../services/produkPajakService");

class ProdukPajakController {
  async assign(req, res, next) {
    try {
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

  async getByProduk(req, res, next) {
    try {
      const { produkID } = req.params;
      const data = await produkPajakService.getPajakByProduk(
        produkID,
        req.pengguna.tenantID,
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
        req.pengguna.tenantID,
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProdukPajakController();
