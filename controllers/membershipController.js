const membershipService = require("../services/membershipService");
const createError = require("http-errors");

class MembershipController {
  // --- CREATE ---
  async createMembership(req, res, next) {
    try {
      /**
       * SINKRONISASI: Mengambil tenantID dari token (req.pengguna).
       * Mencegah user menginput tenantID milik orang lain di body.
       */
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
      };

      const newMembership = await membershipService.create(payload);

      res.status(201).json({
        success: true,
        message: "Membership berhasil ditambahkan",
        data: newMembership,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- READ ALL ---
  async getAllMembership(req, res, next) {
    try {
      // Keamanan: Abaikan tenantID dari query, gunakan dari token
      const tenantID = req.pengguna.tenantID;

      const membership = await membershipService.getAll(tenantID);

      res.status(200).json({
        success: true,
        total: membership.length,
        data: membership,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- READ BY ID ---
  async getMembershipById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      // Sertakan tenantID agar user tidak bisa intip ID milik tenant lain
      const membership = await membershipService.getById(id, tenantID);

      res.status(200).json({
        success: true,
        data: membership,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- UPDATE ---
  async updateMembership(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const updatedMembership = await membershipService.update(
        id,
        tenantID,
        req.body
      );

      res.status(200).json({
        success: true,
        message: "Membership berhasil diperbarui",
        data: updatedMembership,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- DELETE ---
  async deleteMembership(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const result = await membershipService.delete(id, tenantID);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MembershipController();
