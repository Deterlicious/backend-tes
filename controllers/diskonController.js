const diskonService = require("../services/diskonService");
const createError = require("http-errors");

class DiskonController {
  /**
   * ✅ CREATE: Tambah Diskon
   * tenantID diambil otomatis dari token untuk keamanan multi-tenant.
   */
  async createDiskon(req, res, next) {
    try {
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID, // Injeksi otomatis dari middleware
      };

      const newDiskon = await diskonService.create(payload);

      res.status(201).json({
        success: true,
        message: "Diskon berhasil ditambahkan",
        data: newDiskon,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ READ ALL: Daftar Diskon per Tenant
   * Menghapus ketergantungan pada req.query.tenantID.
   */
  async getAllDiskon(req, res, next) {
    try {
      const tenantID = req.pengguna.tenantID;
      const diskon = await diskonService.getAll(tenantID);

      res.status(200).json({
        success: true,
        total: diskon.length,
        data: diskon,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ READ BY ID: Detail Diskon
   * Memastikan ID yang diminta adalah milik tenant yang login.
   */
  async getDiskonById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const diskon = await diskonService.getById(id, tenantID);

      res.status(200).json({
        success: true,
        data: diskon,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ UPDATE: Ubah Data Diskon
   */
  async updateDiskon(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const updatedDiskon = await diskonService.update(id, tenantID, req.body);

      res.status(200).json({
        success: true,
        message: "Diskon berhasil diperbarui",
        data: updatedDiskon,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ DELETE: Hapus Diskon
   */
  async deleteDiskon(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const result = await diskonService.delete(id, tenantID);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DiskonController();
