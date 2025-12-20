const tenantService = require("../services/tenantService");
const akunService = require("../services/akunService");
const Akun = require("../models/akunModel");
const createError = require("http-errors");

class TenantController {

  async getAll(req, res, next) {
    try {
      const tenants = await tenantService.getAll();
      res.json({ data: tenants });
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const tenant = await tenantService.getById(req.params.id);
      if (!tenant) throw createError(404, "Tenant tidak ditemukan");
      res.json({ data: tenant });
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    let createdTenant = null;
    let isUserUpdated = false;

    try {
      const userId = req.userDecoded?.id;
      const deviceID = req.userDecoded?.deviceID;
      if (!userId) throw createError(401, "Identitas akun tidak valid.");

      // PRE-CHECK
      const user = await Akun.findById(userId);
      if (!user) throw createError(404, "Akun tidak ditemukan.");
      if (user.tenantID) {
        throw createError(400, "Akun ini sudah memiliki toko.");
      }

      const result = await tenantService.createWithOwner(req.body, userId);
      createdTenant = result.tenant;

      const updatedUser = await Akun.findByIdAndUpdate(
        userId,
        {
          tenantID: result.tenant._id,
          roleID: result.ownerRole._id
        },
        { new: true, runValidators: true }
      );

      if (!updatedUser) throw createError(404, "User tidak ditemukan saat update.");
      isUserUpdated = true;

      const device = updatedUser.device.find(d => d.deviceID === deviceID);
      if (!device) throw createError(401, "Sesi perangkat tidak valid.");

      const tokens = akunService.generateTokens(updatedUser, device);

      res.status(201).json({
        message: "Toko berhasil dibuat",
        data: createdTenant,
        tokens
      });

    } catch (err) {
      console.error("Gagal membuat tenant. Rollback dimulai:", err.message);

      try {
        if (createdTenant) {
          await tenantService.forceDelete(createdTenant._id);
        }

        if (isUserUpdated) {
          await Akun.findByIdAndUpdate(req.userDecoded.id, {
            tenantID: null,
            roleID: null
          });
        }
      } catch (rollbackErr) {
        console.error("CRITICAL: Rollback gagal!", rollbackErr);
      }

      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await tenantService.update(req.params.id, req.body);
      if (result?.error) return res.status(400).json({ errors: result.error });
      if (!result) throw createError(404, "Tenant tidak ditemukan");
      res.json({ message: "Data toko diperbarui", data: result });
    } catch (err) { next(err); }
  }

  async delete(req, res, next) {
    try {
      const deleted = await tenantService.delete(req.params.id);
      if (!deleted) throw createError(404, "Tenant tidak ditemukan");
      res.json({ message: "Toko berhasil dihapus" });
    } catch (err) { next(err); }
  }
}

module.exports = new TenantController();
