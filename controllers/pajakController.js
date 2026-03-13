const pajakService = require("../services/pajakService");
const createError = require("http-errors");

class PajakController {
  // Simulasi khusus pajak per produk
  async simulasiProduk(req, res, next) {
    try {
      const { produkID, harga } = req.body;
      const result = await pajakService.hitungPajakProduk(
        produkID,
        harga,
        req.pengguna.tenantID, // Pastikan menggunakan req.pengguna sesuai middleware-mu
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Simulasi khusus pajak per transaksi (global)
  async simulasiTransaksi(req, res, next) {
    try {
      const { subtotal } = req.body;
      const result = await pajakService.hitungPajakTransaksi(
        subtotal,
        req.pengguna.tenantID,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async createPajak(req, res, next) {
    try {
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
      };

      const data = await pajakService.create(payload);

      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getAllPajak(req, res, next) {
    try {
      const data = await pajakService.getAll(req.pengguna.tenantID);

      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getPajakById(req, res, next) {
    try {
      const data = await pajakService.getById(
        req.params.id,
        req.pengguna.tenantID,
      );

      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updatePajak(req, res, next) {
    try {
      const data = await pajakService.update(
        req.params.id,
        req.pengguna.tenantID,
        req.body,
      );

      res.status(200).json({
        success: true,
        message: "Pajak diperbarui",
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async deletePajak(req, res, next) {
    try {
      const result = await pajakService.delete(
        req.params.id,
        req.pengguna.tenantID,
      );

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PajakController();
