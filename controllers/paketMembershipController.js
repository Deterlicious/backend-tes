const paketMembershipService = require("../services/paketMembershipService");
const createError = require("http-errors");

class PaketMembershipController {
  // --- CREATE ---
  async createPaketMembership(req, res, next) {
    try {
      /**
       * KEAMANAN: Injeksi tenantID dari token.
       * User tidak boleh menentukan tenantID sendiri di body request.
       */
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
      };

      const newPaket = await paketMembershipService.create(payload);

      res.status(201).json({
        success: true,
        message: "Paket Membership berhasil ditambahkan",
        data: newPaket,
      });
    } catch (err) {
      next(err); // Diteruskan ke global error handler
    }
  }

  // --- READ ALL ---
  async getAllPaketMembership(req, res, next) {
    try {
      // KEAMANAN: Ambil tenantID murni dari token login
      const tenantID = req.pengguna.tenantID;

      const paketMembership = await paketMembershipService.getAll(tenantID);

      res.status(200).json({
        success: true,
        total: paketMembership.length,
        data: paketMembership,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- READ BY ID ---
  async getPaketMembershipById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      // Isolasi: Cari ID hanya di dalam tenant yang sesuai
      const paketMembership = await paketMembershipService.getById(
        id,
        tenantID
      );

      res.status(200).json({
        success: true,
        data: paketMembership,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- UPDATE ---
  async updatePaketMembership(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const updatedPaket = await paketMembershipService.update(
        id,
        tenantID,
        req.body
      );

      res.status(200).json({
        success: true,
        message: "Paket Membership berhasil diperbarui",
        data: updatedPaket,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- DELETE ---
  async deletePaketMembership(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const result = await paketMembershipService.delete(id, tenantID);

      res.status(200).json({
        success: true,
        message: result.message || "Paket Membership berhasil dihapus",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PaketMembershipController();
