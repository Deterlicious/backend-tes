const tenantService = require("../services/tenantService");
const akunService = require("../services/akunService");
const Akun = require("../models/akunModel");
const createError = require("http-errors");

class TenantController {
  async getAll(req, res, next) {
    try {
      const tenants = await tenantService.getAll();
      res.json({ data: tenants });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenant = await tenantService.getById(req.params.id);
      if (!tenant) throw createError(404, "Tenant tidak ditemukan");
      res.json({ data: tenant });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const userId = req.userDecoded?.id;
      const deviceID = req.userDecoded?.deviceID;

      if (!userId || !deviceID) {
        throw createError(401, "Identitas akun tidak valid.");
      }

      const { tenant, akun } = await tenantService.createWithOwner(
        req.body,
        userId
      );

      const device = akun.device.find((d) => d.deviceID === deviceID);
      if (!device) {
        throw createError(401, "Sesi perangkat tidak valid.");
      }

      const tokens = akunService.generateTokens(akun, device);

      res.status(201).json({
        message: "Toko berhasil dibuat",
        data: tenant,
        tokens,
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await tenantService.update(req.params.id, req.body);
      if (result?.error) return res.status(400).json({ errors: result.error });
      if (!result) throw createError(404, "Tenant tidak ditemukan");
      res.json({ message: "Data toko diperbarui", data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const deleted = await tenantService.delete(req.params.id);
      if (!deleted) throw createError(404, "Tenant tidak ditemukan");
      res.json({ message: "Toko berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TenantController();
