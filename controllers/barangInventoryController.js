const barangInventoryService = require("../services/barangInventoryService");

class BarangInventoryController {
  async createBarangInventory(req, res, next) {
    try {
      const payload = { ...req.body, tenantID: req.pengguna.tenantID };
      const data = await barangInventoryService.create(payload);

      res.status(201).json({
        success: true,
        message: "Barang inventory berhasil dibuat",
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async getBarangInventories(req, res, next) {
    try {
      const data = await barangInventoryService.getAll(req.pengguna.tenantID);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getBarangInventoryById(req, res, next) {
    try {
      const data = await barangInventoryService.getById(
        req.params.id,
        req.pengguna.tenantID,
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateBarangInventory(req, res, next) {
    try {
      const data = await barangInventoryService.update(
        req.params.id,
        req.pengguna.tenantID,
        req.body,
      );

      res.status(200).json({
        success: true,
        message: "Barang inventory berhasil diperbarui",
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteBarangInventory(req, res, next) {
    try {
      await barangInventoryService.delete(req.params.id, req.pengguna.tenantID);

      res.status(200).json({
        success: true,
        message: "Barang inventory berhasil dihapus",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BarangInventoryController();
