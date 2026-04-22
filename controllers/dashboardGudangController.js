const dashboardGudangService = require("../services/dashboardGudangService");

class DashboardGudangController {
  async getSummary(req, res, next) {
    try {
      const data = await dashboardGudangService.getSummary(req.pengguna);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DashboardGudangController();
