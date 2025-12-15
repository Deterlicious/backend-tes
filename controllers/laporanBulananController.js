const laporanBulananService = require("../services/laporanBulananService");
const createError = require("http-errors");

class LaporanBulananController {
  // --- POST / GENERATE ---
  async generate(req, res, next) {
    try {
      const tenantID = req.user.tenantID; // Asumsi dari Auth Middleware
      const { bulan, tahun } = req.body;

      if (!bulan || !tahun)
        throw createError(
          400,
          "Bulan dan Tahun wajib diisi untuk generasi laporan."
        );
      const data = await laporanBulananService.generateLaporan(
        tenantID,
        bulan,
        tahun
      );

      res.status(201).json({
        success: true,
        message: `Laporan Bulanan untuk bulan ${bulan}/${tahun} berhasil digenerasi/diperbarui.`,
        data: data,
      });
    } catch (error) {
      next(error);
    }
  } // --- GET ALL ---

  async getAll(req, res, next) {
    try {
      const tenantID = req.user.tenantID;
      const data = await laporanBulananService.getAll(tenantID);
      res.status(200).json({
        success: true,
        message: "Daftar Laporan Bulanan berhasil diambil.",
        data: data,
      });
    } catch (error) {
      next(error);
    }
  } // --- GET BY ID ---

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.user.tenantID;
      const data = await laporanBulananService.getById(tenantID, id);
      res.status(200).json({
        success: true,
        message: "Detail Laporan Bulanan berhasil diambil.",
        data: data,
      });
    } catch (error) {
      next(error);
    }
  } // --- DELETE ---

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.user.tenantID;
      const result = await laporanBulananService.delete(tenantID, id);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LaporanBulananController();
