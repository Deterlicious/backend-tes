const laporanHarianService = require("../services/laporanHarianService");

class LaporanHarianController {
  // --- GET ALL ---
  async getAll(req, res, next) {
    try {
      // Asumsi tenantID diambil dari Auth Middleware (req.user.tenantID)
      const tenantID = req.user.tenantID;
      const data = await laporanHarianService.getAll(tenantID);
      res.status(200).json({
        success: true,
        message: "Daftar Laporan Harian berhasil diambil.",
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
      const data = await laporanHarianService.getById(tenantID, id);
      res.status(200).json({
        success: true,
        message: "Detail Laporan Harian berhasil diambil.",
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
      const result = await laporanHarianService.delete(tenantID, id);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LaporanHarianController();
