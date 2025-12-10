const sesiBookingService = require("../services/sesiBookingService");
const createError = require("http-errors");

class SesiBookingController {
  async getAll(req, res, next) {
    try {
      const { tenantID } = req.query;
      const result = await sesiBookingService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await sesiBookingService.getById(req.params.id);
      if (!result) throw createError(404, "Booking tidak ditemukan");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      let result;
      if (req.body.items && Array.isArray(req.body.items)) {
        result = await sesiBookingService.createBatch(req.body);
      } else {
        result = await sesiBookingService.create(req.body);
      }

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      res.status(201).json({
        data: result,
        message: "Booking berhasil dibuat",
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await sesiBookingService.update(req.params.id, req.body);

      if (result?.error) {
        return res.status(400).json({ errors: result.error });
      }

      if (!result) throw createError(404, "Booking tidak ditemukan");

      res.json({
        data: result,
        message: "Booking berhasil diperbarui",
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await sesiBookingService.delete(req.params.id);

      if (!result) throw createError(404, "Booking tidak ditemukan");

      res.json({ message: "Booking berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SesiBookingController();