const pajakService = require("../services/pajakService");
const createError = require("http-errors");

class PajakController {
  async simulasi(req, res, next) {
    try {
      const { produkID, harga } = req.body;
      const tenantID = req.pengguna.tenantID;

      if (!produkID || harga === undefined) {
        throw createError(
          400,
          "Produk ID dan Harga wajib diisi untuk simulasi."
        );
      }

      const hasil = await pajakService.simulasiHitung(
        produkID,
        Number(harga),
        tenantID
      );

      res.status(200).json({
        success: true,
        message: "Simulasi perhitungan berhasil",
        data: hasil,
      });
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
        req.pengguna.tenantID
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
        req.body
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
        req.pengguna.tenantID
      );

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PajakController();