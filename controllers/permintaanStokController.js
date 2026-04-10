const permintaanStokService = require("../services/permintaanStokService");

class PermintaanStokController {
  async createPermintaanStok(req, res, next) {
    try {
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
        dimintaOleh: req.pengguna._id,
      };

      const data = await permintaanStokService.create(payload);

      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async submitRequest(req, res, next) {
    try {
      const { id } = req.params;

      const data = await permintaanStokService.submit(
        id,
        req.pengguna.tenantID,
      );

      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async approveRequest(req, res, next) {
    try {
      const data = await permintaanStokService.approve(
        req.params.id,
        req.pengguna.tenantID,
        req.pengguna._id, // untuk dicatat di JurnalStok
      );

      res.status(200).json({
        success: true,
        message: "Status: COMPLETED & STOK BERPINDAH",
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async rejectRequest(req, res, next) {
    try {
      const data = await permintaanStokService.reject(
        req.params.id,
        req.pengguna.tenantID,
      );

      res.status(200).json({
        success: true,
        message: "Status: REJECTED",
        data,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PermintaanStokController();
