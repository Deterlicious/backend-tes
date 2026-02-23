const locationService = require("../services/locationService");

class LocationController {
  async createLocation(req, res, next) {
    try {
      const payload = { ...req.body, tenantID: req.pengguna.tenantID };
      const data = await locationService.create(payload);
      res
        .status(201)
        .json({ success: true, message: "Lokasi berhasil dibuat", data });
    } catch (err) {
      next(err);
    }
  }

  async getLocations(req, res, next) {
    try {
      const data = await locationService.getAll(req.pengguna.tenantID);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getLocationById(req, res, next) {
    try {
      const data = await locationService.getById(
        req.params.id,
        req.pengguna.tenantID,
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateLocation(req, res, next) {
    try {
      const data = await locationService.update(
        req.params.id,
        req.pengguna.tenantID,
        req.body,
      );
      res
        .status(200)
        .json({ success: true, message: "Lokasi berhasil diperbarui", data });
    } catch (err) {
      next(err);
    }
  }

  async deleteLocation(req, res, next) {
    try {
      await locationService.delete(req.params.id, req.pengguna.tenantID);
      res
        .status(200)
        .json({ success: true, message: "Lokasi berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LocationController();
