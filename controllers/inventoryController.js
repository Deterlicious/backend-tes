const inventoryService = require("../services/inventoryService");

class InventoryController {
  async createInventory(req, res, next) {
    try {
      const payload = { ...req.body, tenantID: req.pengguna.tenantID };
      const data = await inventoryService.create(payload);
      res
        .status(201)
        .json({ success: true, message: "Inventory berhasil dicatat", data });
    } catch (err) {
      next(err);
    }
  }

  async getInventories(req, res, next) {
    try {
      const data = await inventoryService.getAll(req.pengguna.tenantID);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getInventoryById(req, res, next) {
    try {
      const data = await inventoryService.getById(
        req.params.id,
        req.pengguna.tenantID,
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateInventory(req, res, next) {
    try {
      const data = await inventoryService.update(
        req.params.id,
        req.pengguna.tenantID,
        req.body,
      );
      res
        .status(200)
        .json({ success: true, message: "Inventory diperbarui", data });
    } catch (err) {
      next(err);
    }
  }

  async deleteInventory(req, res, next) {
    try {
      await inventoryService.delete(req.params.id, req.pengguna.tenantID);
      res.status(200).json({ success: true, message: "Inventory dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InventoryController();
