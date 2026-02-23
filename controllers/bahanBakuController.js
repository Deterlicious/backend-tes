const bahanBakuService = require("../services/bahanBakuService");

class BahanBakuController {
  async createBahanBaku(req, res, next) {
    try {
      const payload = { ...req.body, tenantID: req.pengguna.tenantID };
      const data = await bahanBakuService.create(payload);
      res
        .status(201)
        .json({ success: true, message: "Bahan baku berhasil dibuat", data });
    } catch (err) {
      next(err);
    }
  }

  async getBahanBakus(req, res, next) {
    try {
      const data = await bahanBakuService.getAll(req.pengguna.tenantID);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getBahanBakuById(req, res, next) {
    try {
      const data = await bahanBakuService.getById(
        req.params.id,
        req.pengguna.tenantID,
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateBahanBaku(req, res, next) {
    try {
      const data = await bahanBakuService.update(
        req.params.id,
        req.pengguna.tenantID,
        req.body,
      );
      res
        .status(200)
        .json({
          success: true,
          message: "Bahan baku berhasil diperbarui",
          data,
        });
    } catch (err) {
      next(err);
    }
  }

  async deleteBahanBaku(req, res, next) {
    try {
      await bahanBakuService.delete(req.params.id, req.pengguna.tenantID);
      res
        .status(200)
        .json({ success: true, message: "Bahan baku berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BahanBakuController();
